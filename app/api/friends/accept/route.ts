import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userProfiles, friendships } from "@/db/schema";
import { eq, sql, and, or } from "drizzle-orm";
import { auth } from "@/auth";
import type { FriendPlayer } from "@/app/friends/_lib/league";
import { pusher } from "@/lib/realtime/pusher-server";

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

  try {
    // Find the pending request where the friend is the initiator and current user is receiver
    const pendingRequest = await db.query.friendships.findFirst({
      where: and(
        eq(friendships.userId, friendUserId),
        eq(friendships.friendUserId, currentUserId),
        eq(friendships.status, "pending")
      ),
    });

    if (!pendingRequest) {
      return NextResponse.json({ error: "No pending friend request found" }, { status: 404 });
    }

    // Update status to accepted
    await db
      .update(friendships)
      .set({ status: "accepted" })
      .where(eq(friendships.id, pendingRequest.id));

    // Update friendsCount for both
    await updateFriendsCount(currentUserId);
    await updateFriendsCount(friendUserId);

    // Trigger Pusher update
    try {
      const [profileCurrent, profileFriend] = await Promise.all([
        db.query.userProfiles.findFirst({ where: eq(userProfiles.userId, currentUserId) }),
        db.query.userProfiles.findFirst({ where: eq(userProfiles.userId, friendUserId) }),
      ]);

      if (profileCurrent?.profileCode) {
        await pusher.trigger(`user-profile-${profileCurrent.profileCode}`, "friend-updated", {});
      }
      if (profileFriend?.profileCode) {
        await pusher.trigger(`user-profile-${profileFriend.profileCode}`, "friend-updated", {});
      }
    } catch (err) {
      console.error("Failed to trigger Pusher event:", err);
    }

    const friendData: FriendPlayer = {
      id: friendProfile.profileCode,
      name: friendProfile.nickname,
      xp: friendProfile.currentXp,
      joinedAt: pendingRequest.createdAt.toISOString(),
      profileCode: friendProfile.profileCode,
    };

    return NextResponse.json(friendData);
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Failed to accept friend request" }, { status: 500 });
  }
}
