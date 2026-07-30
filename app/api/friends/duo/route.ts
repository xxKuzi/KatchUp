import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userProfiles, friendships, duoQuests, userWordStats } from "@/db/schema";
import { eq, sql, and, or } from "drizzle-orm";
import { auth } from "@/auth";
import { pusher } from "@/lib/realtime/pusher-server";

const DUO_TASK_POOL = [
  "Complete 3 practice sessions each",
  "Score 500+ XP together in Flip Cards",
  "Study on the same day at least twice",
  "Beat your previous week's best score",
  "Review 50 flashcards each",
  "Keep a shared 3-day streak",
  "Finish a full deck without a mistake",
  "Try a brand new subject together",
  "Send each other one hard question",
  "Practice for 20 minutes back to back",
];

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

async function triggerPartnerUpdate(userIdA: string, userIdB: string) {
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

// POST: Select partner and initialize duo quest
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const currentUserId = session.user.id;

  // We reuse the same endpoint with sub-actions or distinguish by body payload
  const body = (await request.json().catch(() => null)) as {
    partnerProfileCode?: string;
    action?: "claim";
  } | null;

  if (body?.action === "claim") {
    // CLAIM action
    const currentWeekKey = getWeekKey();
    const currentQuest = await db.query.duoQuests.findFirst({
      where: and(
        eq(duoQuests.weekKey, currentWeekKey),
        or(eq(duoQuests.userAId, currentUserId), eq(duoQuests.userBId, currentUserId))
      ),
    });

    if (!currentQuest) {
      return NextResponse.json({ error: "No active duo quest found" }, { status: 404 });
    }

    const isUserA = currentQuest.userAId === currentUserId;
    const alreadyClaimed = isUserA ? currentQuest.claimedA : currentQuest.claimedB;

    if (alreadyClaimed) {
      return NextResponse.json({ error: "Reward already claimed" }, { status: 400 });
    }

    try {
      // Update claimed status
      await db
        .update(duoQuests)
        .set(isUserA ? { claimedA: true } : { claimedB: true })
        .where(eq(duoQuests.id, currentQuest.id));

      // Award 2000 XP
      await db
        .update(userProfiles)
        .set({ currentXp: sql`${userProfiles.currentXp} + 2000` })
        .where(eq(userProfiles.userId, currentUserId));

      await triggerPartnerUpdate(currentQuest.userAId, currentQuest.userBId);

      return NextResponse.json({ ok: true });
    } catch (error: any) {
      return NextResponse.json({ error: error.message ?? "Failed to claim reward" }, { status: 500 });
    }
  }

  // SELECT partner action
  if (!body || typeof body.partnerProfileCode !== "string") {
    return NextResponse.json({ error: "partnerProfileCode is required" }, { status: 400 });
  }

  const partnerProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.profileCode, body.partnerProfileCode.trim().toLowerCase()),
  });

  if (!partnerProfile) {
    return NextResponse.json({ error: "Partner profile not found" }, { status: 404 });
  }

  const partnerUserId = partnerProfile.userId;

  // Verify friendship exists and is accepted
  const friendship = await db.query.friendships.findFirst({
    where: and(
      eq(friendships.status, "accepted"),
      or(
        and(eq(friendships.userId, currentUserId), eq(friendships.friendUserId, partnerUserId)),
        and(eq(friendships.userId, partnerUserId), eq(friendships.friendUserId, currentUserId))
      )
    ),
  });

  if (!friendship) {
    return NextResponse.json({ error: "You must be accepted friends to start a duo quest" }, { status: 400 });
  }

  const weekKey = getWeekKey();
  const [userAId, userBId] = [currentUserId, partnerUserId].sort();

  try {
    // Check if quest already exists for current week
    const existing = await db.query.duoQuests.findFirst({
      where: and(
        eq(duoQuests.weekKey, weekKey),
        eq(duoQuests.userAId, userAId),
        eq(duoQuests.userBId, userBId)
      ),
    });

    if (existing) {
      return NextResponse.json({ ok: true });
    }

    // Clean up any other quests current user has this week (only 1 quest per user per week)
    await db
      .delete(duoQuests)
      .where(
        and(
          eq(duoQuests.weekKey, weekKey),
          or(eq(duoQuests.userAId, currentUserId), eq(duoQuests.userBId, currentUserId))
        )
      );

    // Clean up partner's other quests this week too
    await db
      .delete(duoQuests)
      .where(
        and(
          eq(duoQuests.weekKey, weekKey),
          or(eq(duoQuests.userAId, partnerUserId), eq(duoQuests.userBId, partnerUserId))
        )
      );

    // Initialize random target (20-50 words)
    const targetWordCount = Math.floor(Math.random() * 31) + 20;

    await db
      .insert(duoQuests)
      .values({
        weekKey,
        userAId,
        userBId,
        targetWordCount,
        tasksJson: [],
      });

    await triggerPartnerUpdate(userAId, userBId);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Failed to initialize quest" }, { status: 500 });
  }
}

// PUT: Toggle static task
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const currentUserId = session.user.id;

  const body = (await request.json().catch(() => null)) as {
    taskId?: string;
  } | null;

  if (!body || typeof body.taskId !== "string") {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  const currentWeekKey = getWeekKey();

  const currentQuest = await db.query.duoQuests.findFirst({
    where: and(
      eq(duoQuests.weekKey, currentWeekKey),
      or(eq(duoQuests.userAId, currentUserId), eq(duoQuests.userBId, currentUserId))
    ),
  });

  if (!currentQuest) {
    return NextResponse.json({ error: "No active duo quest found" }, { status: 404 });
  }

  const tasksList = (currentQuest.tasksJson as any[]) || [];
  const updatedTasks = tasksList.map((task) =>
    task.id === body.taskId ? { ...task, done: !task.done } : task
  );

  try {
    await db
      .update(duoQuests)
      .set({ tasksJson: updatedTasks })
      .where(eq(duoQuests.id, currentQuest.id));

    await triggerPartnerUpdate(currentQuest.userAId, currentQuest.userBId);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Failed to toggle task" }, { status: 500 });
  }
}

// DELETE: Cancel duo partnership
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const currentUserId = session.user.id;

  const currentWeekKey = getWeekKey();

  const currentQuest = await db.query.duoQuests.findFirst({
    where: and(
      eq(duoQuests.weekKey, currentWeekKey),
      or(eq(duoQuests.userAId, currentUserId), eq(duoQuests.userBId, currentUserId))
    ),
  });

  if (!currentQuest) {
    return NextResponse.json({ error: "No active duo quest found" }, { status: 404 });
  }

  try {
    await db.delete(duoQuests).where(eq(duoQuests.id, currentQuest.id));

    await triggerPartnerUpdate(currentQuest.userAId, currentQuest.userBId);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Failed to cancel partnership" }, { status: 500 });
  }
}
