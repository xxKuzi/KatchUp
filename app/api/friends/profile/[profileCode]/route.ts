import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import {
  createPublicFriendProfile,
  normalizeStoredProfileCode,
  type PublicFriendProfile,
} from "@/app/friends/_lib/profile";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ profileCode: string }> },
) {
  const { profileCode } = await context.params;
  const normalized = normalizeStoredProfileCode(profileCode);

  const storedProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.profileCode, normalized),
  });

  if (!storedProfile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Map Date to string format expected by client
  return NextResponse.json({
    ...storedProfile,
    updatedAt: storedProfile.updatedAt.toISOString(),
  } satisfies PublicFriendProfile);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ profileCode: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const { profileCode } = await context.params;
  const normalized = normalizeStoredProfileCode(profileCode);

  const body = (await request
    .json()
    .catch(() => null)) as Partial<PublicFriendProfile> | null;

  if (
    !body ||
    typeof body.nickname !== "string" ||
    typeof body.avatarBackgroundId !== "string" ||
    typeof body.avatarIcon !== "string" ||
    typeof body.currentXp !== "number" ||
    typeof body.leagueName !== "string" ||
    typeof body.friendsCount !== "number" ||
    typeof body.matchesPlayed !== "number"
  ) {
    return NextResponse.json(
      { error: "Invalid profile payload" },
      { status: 400 },
    );
  }

  const storedProfile = createPublicFriendProfile({
    identity: {
      profileCode: normalized,
      nickname: body.nickname,
      avatarBackgroundId: body.avatarBackgroundId,
      avatarIcon: body.avatarIcon,
      updatedAt: new Date().toISOString(),
    },
    currentXp: body.currentXp,
    leagueName: body.leagueName,
    friendsCount: body.friendsCount,
    matchesPlayed: body.matchesPlayed,
  });

  try {
    await db
      .insert(userProfiles)
      .values({
        userId,
        profileCode: storedProfile.profileCode,
        nickname: storedProfile.nickname,
        avatarBackgroundId: storedProfile.avatarBackgroundId,
        avatarIcon: storedProfile.avatarIcon,
        currentXp: storedProfile.currentXp,
        leagueName: storedProfile.leagueName,
        friendsCount: storedProfile.friendsCount,
        matchesPlayed: storedProfile.matchesPlayed,
        updatedAt: new Date(storedProfile.updatedAt),
      })
      .onConflictDoUpdate({
        target: [userProfiles.userId],
        set: {
          profileCode: storedProfile.profileCode,
          nickname: storedProfile.nickname,
          avatarBackgroundId: storedProfile.avatarBackgroundId,
          avatarIcon: storedProfile.avatarIcon,
          currentXp: storedProfile.currentXp,
          leagueName: storedProfile.leagueName,
          friendsCount: storedProfile.friendsCount,
          matchesPlayed: storedProfile.matchesPlayed,
          updatedAt: new Date(storedProfile.updatedAt),
        },
      });
  } catch (err: any) {
    // Unique violation in Postgres
    if (err?.code === "23505") {
      return NextResponse.json(
        { error: "Profile code already taken" },
        { status: 409 },
      );
    }
    throw err;
  }

  return NextResponse.json(storedProfile);
}

export async function DELETE(
  _request: NextRequest,
  _context: { params: Promise<{ profileCode: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  await db.delete(userProfiles).where(eq(userProfiles.userId, userId));

  return NextResponse.json({ ok: true });
}
