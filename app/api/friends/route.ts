import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userProfiles, friendships, duoQuests, userWordStats } from "@/db/schema";
import { eq, sql, and, or, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import type { FriendPlayer } from "@/app/friends/_lib/league";
import { pusher } from "@/lib/realtime/pusher-server";

function getWeekStart(date: Date): Date {
  const value = new Date(date);
  value.setUTCHours(0, 0, 0, 0);
  const day = value.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  value.setUTCDate(value.getUTCDate() - daysSinceMonday);
  return value;
}

function getWeekKey(date = new Date()): string {
  return getWeekStart(date).toISOString().slice(0, 10);
}

async function getLearnedWordsCount(userId: string, weekStart: Date): Promise<number> {
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userWordStats)
    .where(
      and(
        eq(userWordStats.userId, userId),
        eq(userWordStats.known, true),
        sql`${userWordStats.updatedAt} >= ${weekStart}`
      )
    );
  return countResult?.count ?? 0;
}

async function updateFriendsCount(userId: string) {
  const [friendsCountResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(eq(friendships.userId, userId), eq(friendships.friendUserId, userId))
      )
    );

  const count = friendsCountResult?.count ?? 0;

  await db
    .update(userProfiles)
    .set({ friendsCount: count })
    .where(eq(userProfiles.userId, userId));
}

async function triggerRealtimeUpdate(userIdA: string, userIdB: string) {
  try {
    const [profileA, profileB] = await Promise.all([
      db.query.userProfiles.findFirst({ where: eq(userProfiles.userId, userIdA) }),
      db.query.userProfiles.findFirst({ where: eq(userProfiles.userId, userIdB) }),
    ]);

    if (profileA?.profileCode) {
      await pusher.trigger(`user-profile-${profileA.profileCode}`, "friend-updated", {});
    }
    if (profileB?.profileCode) {
      await pusher.trigger(`user-profile-${profileB.profileCode}`, "friend-updated", {});
    }
  } catch (err) {
    console.error("Failed to trigger Pusher event:", err);
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const currentUserId = session.user.id;

  // 1. Fetch accepted friendships where current user is the initiator (userId)
  const sentAccepted = await db
    .select({
      profileCode: userProfiles.profileCode,
      nickname: userProfiles.nickname,
      currentXp: userProfiles.currentXp,
      joinedAt: friendships.createdAt,
      friendUserId: friendships.friendUserId,
    })
    .from(friendships)
    .innerJoin(userProfiles, eq(friendships.friendUserId, userProfiles.userId))
    .where(and(eq(friendships.userId, currentUserId), eq(friendships.status, "accepted")));

  // 2. Fetch accepted friendships where current user is the receiver (friendUserId)
  const receivedAccepted = await db
    .select({
      profileCode: userProfiles.profileCode,
      nickname: userProfiles.nickname,
      currentXp: userProfiles.currentXp,
      joinedAt: friendships.createdAt,
      friendUserId: friendships.userId,
    })
    .from(friendships)
    .innerJoin(userProfiles, eq(friendships.userId, userProfiles.userId))
    .where(and(eq(friendships.friendUserId, currentUserId), eq(friendships.status, "accepted")));

  const acceptedFriends = [...sentAccepted, ...receivedAccepted];
  const friendUserIds = acceptedFriends.map((row) => row.friendUserId);

  // Real learned-word counts (userWordStats rows only ever come from actual
  // practice — the level test only raises userLevelProgress.wordFloor, so
  // known=true here already excludes anything "given" at placement).
  const learnedCounts = friendUserIds.length
    ? await db
        .select({ userId: userWordStats.userId, count: sql<number>`count(*)::int` })
        .from(userWordStats)
        .where(and(inArray(userWordStats.userId, friendUserIds), eq(userWordStats.known, true)))
        .groupBy(userWordStats.userId)
    : [];
  const learnedWordsByUserId = new Map(learnedCounts.map((row) => [row.userId, row.count]));

  const friendsList: FriendPlayer[] = acceptedFriends.map((row) => ({
    id: row.profileCode,
    name: row.nickname,
    xp: row.currentXp,
    joinedAt: row.joinedAt.toISOString(),
    profileCode: row.profileCode,
    learnedWords: learnedWordsByUserId.get(row.friendUserId) ?? 0,
  }));

  // 3. Fetch incoming pending requests (friendUserId = currentUserId)
  const incomingRows = await db
    .select({
      profileCode: userProfiles.profileCode,
      nickname: userProfiles.nickname,
      currentXp: userProfiles.currentXp,
      createdAt: friendships.createdAt,
    })
    .from(friendships)
    .innerJoin(userProfiles, eq(friendships.userId, userProfiles.userId))
    .where(and(eq(friendships.friendUserId, currentUserId), eq(friendships.status, "pending")));

  // 4. Fetch outgoing pending requests (userId = currentUserId)
  const outgoingRows = await db
    .select({
      profileCode: userProfiles.profileCode,
      nickname: userProfiles.nickname,
      currentXp: userProfiles.currentXp,
      createdAt: friendships.createdAt,
    })
    .from(friendships)
    .innerJoin(userProfiles, eq(friendships.friendUserId, userProfiles.userId))
    .where(and(eq(friendships.userId, currentUserId), eq(friendships.status, "pending")));

  // 5. Fetch weekly duo quest if exists
  const currentWeekKey = getWeekKey();
  const weekStart = getWeekStart(new Date());

  const currentQuest = await db.query.duoQuests.findFirst({
    where: and(
      eq(duoQuests.weekKey, currentWeekKey),
      or(eq(duoQuests.userAId, currentUserId), eq(duoQuests.userBId, currentUserId))
    ),
  });

  let formattedDuoQuest = null;

  if (currentQuest) {
    const partnerId = currentQuest.userAId === currentUserId ? currentQuest.userBId : currentQuest.userAId;
    const partnerProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, partnerId),
    });

    const [wordsLearnedA, wordsLearnedB] = await Promise.all([
      getLearnedWordsCount(currentQuest.userAId, weekStart),
      getLearnedWordsCount(currentQuest.userBId, weekStart),
    ]);

    const wordsLearnedTotal = wordsLearnedA + wordsLearnedB;
    const isClaimed = currentQuest.userAId === currentUserId ? currentQuest.claimedA : currentQuest.claimedB;
    const tasksJson = (currentQuest.tasksJson as any) || [];

    // Construct local-storage compatible FriendTask list
    const combinedTasks = [
      {
        id: "words-task",
        label: `Learn ${currentQuest.targetWordCount} words together`,
        done: wordsLearnedTotal >= currentQuest.targetWordCount,
        current: wordsLearnedTotal,
        target: currentQuest.targetWordCount,
      },
    ];

    formattedDuoQuest = {
      weekKey: currentQuest.weekKey,
      partnerId: partnerProfile?.profileCode || null, // Map to partner profileCode for client identity compatibility
      partnerName: partnerProfile?.nickname || null,
      tasks: combinedTasks,
      claimed: isClaimed,
    };
  }

  return NextResponse.json({
    friends: friendsList,
    incomingRequests: incomingRows.map((row) => ({
      id: row.profileCode,
      name: row.nickname,
      xp: row.currentXp,
      joinedAt: row.createdAt.toISOString(),
      profileCode: row.profileCode,
    })),
    outgoingRequests: outgoingRows.map((row) => ({
      id: row.profileCode,
      name: row.nickname,
      xp: row.currentXp,
      joinedAt: row.createdAt.toISOString(),
      profileCode: row.profileCode,
    })),
    duoQuest: formattedDuoQuest,
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const currentUserId = session.user.id;

  const body = (await request.json().catch(() => null)) as {
    profileCode?: string;
  } | null;

  if (!body || typeof body.profileCode !== "string") {
    return NextResponse.json({ error: "Profile code is required" }, { status: 400 });
  }

  const targetProfileCode = body.profileCode.trim().toLowerCase();

  // Find the target user profile
  const friendProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.profileCode, targetProfileCode),
  });

  if (!friendProfile) {
    return NextResponse.json({ error: "User profile not found" }, { status: 404 });
  }

  const friendUserId = friendProfile.userId;

  if (friendUserId === currentUserId) {
    return NextResponse.json({ error: "You cannot add yourself as a friend" }, { status: 400 });
  }

  try {
    // Check if a relationship already exists
    const existing = await db.query.friendships.findFirst({
      where: or(
        and(eq(friendships.userId, currentUserId), eq(friendships.friendUserId, friendUserId)),
        and(eq(friendships.userId, friendUserId), eq(friendships.friendUserId, currentUserId))
      ),
    });

    if (existing) {
      if (existing.status === "accepted") {
        return NextResponse.json({
          status: "accepted",
          friend: {
            id: friendProfile.profileCode,
            name: friendProfile.nickname,
            xp: friendProfile.currentXp,
            joinedAt: existing.createdAt.toISOString(),
            profileCode: friendProfile.profileCode,
          } as FriendPlayer,
        });
      } else {
        // One is pending. If target user sent request to current user, auto-accept it!
        if (existing.userId === friendUserId) {
          await db
            .update(friendships)
            .set({ status: "accepted" })
            .where(eq(friendships.id, existing.id));

          await updateFriendsCount(currentUserId);
          await updateFriendsCount(friendUserId);
          await triggerRealtimeUpdate(currentUserId, friendUserId);

          return NextResponse.json({
            status: "accepted",
            friend: {
              id: friendProfile.profileCode,
              name: friendProfile.nickname,
              xp: friendProfile.currentXp,
              joinedAt: existing.createdAt.toISOString(),
              profileCode: friendProfile.profileCode,
            } as FriendPlayer,
          });
        } else {
          // Already pending outgoing request
          return NextResponse.json({
            status: "pending",
            friend: {
              id: friendProfile.profileCode,
              name: friendProfile.nickname,
              xp: friendProfile.currentXp,
              joinedAt: existing.createdAt.toISOString(),
              profileCode: friendProfile.profileCode,
            } as FriendPlayer,
          });
        }
      }
    }

    // No existing relationship, create pending outgoing request
    const insertedRows = await db
      .insert(friendships)
      .values({
        userId: currentUserId,
        friendUserId: friendUserId,
        status: "pending",
      })
      .returning({ createdAt: friendships.createdAt });

    await triggerRealtimeUpdate(currentUserId, friendUserId);

    const createdAt = insertedRows[0]?.createdAt ?? new Date();

    return NextResponse.json({
      status: "pending",
      friend: {
        id: friendProfile.profileCode,
        name: friendProfile.nickname,
        xp: friendProfile.currentXp,
        joinedAt: createdAt.toISOString(),
        profileCode: friendProfile.profileCode,
      } as FriendPlayer,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Failed to process request" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const currentUserId = session.user.id;

  const body = (await request.json().catch(() => null)) as {
    profileCode?: string;
  } | null;

  if (!body || typeof body.profileCode !== "string") {
    return NextResponse.json({ error: "Profile code is required" }, { status: 400 });
  }

  const targetProfileCode = body.profileCode.trim().toLowerCase();

  // Find the target user profile
  const friendProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.profileCode, targetProfileCode),
  });

  if (!friendProfile) {
    return NextResponse.json({ error: "User profile not found" }, { status: 404 });
  }

  const friendUserId = friendProfile.userId;

  try {
    // Delete friendship row (decline, cancel or remove)
    await db
      .delete(friendships)
      .where(
        or(
          and(eq(friendships.userId, currentUserId), eq(friendships.friendUserId, friendUserId)),
          and(eq(friendships.userId, friendUserId), eq(friendships.friendUserId, currentUserId))
        )
      );

    // Clean up active weekly duo quest if exists between A and B
    const currentWeekKey = getWeekKey();
    await db
      .delete(duoQuests)
      .where(
        and(
          eq(duoQuests.weekKey, currentWeekKey),
          or(
            and(eq(duoQuests.userAId, currentUserId), eq(duoQuests.userBId, friendUserId)),
            and(eq(duoQuests.userAId, friendUserId), eq(duoQuests.userBId, currentUserId))
          )
        )
      );

    await updateFriendsCount(currentUserId);
    await updateFriendsCount(friendUserId);
    await triggerRealtimeUpdate(currentUserId, friendUserId);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Failed to remove friend" }, { status: 500 });
  }
}
