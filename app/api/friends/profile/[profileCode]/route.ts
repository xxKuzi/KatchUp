import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import {
  createPublicFriendProfile,
  normalizeStoredProfileCode,
  type PublicFriendProfile,
} from "@/app/friends/_lib/profile";

const PROFILE_KEY_PREFIX = "katchup-friends-public-profile-v1";

function profileKey(profileCode: string): string {
  return `${PROFILE_KEY_PREFIX}:${normalizeStoredProfileCode(profileCode)}`;
}

async function readStoredProfile(
  profileCode: string,
): Promise<PublicFriendProfile | null> {
  const rawValue = await redis.get<string>(profileKey(profileCode));

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as PublicFriendProfile;
    if (
      typeof parsed.profileCode !== "string" ||
      typeof parsed.nickname !== "string" ||
      typeof parsed.avatarBackgroundId !== "string" ||
      typeof parsed.avatarIcon !== "string" ||
      typeof parsed.currentXp !== "number" ||
      typeof parsed.leagueName !== "string" ||
      typeof parsed.friendsCount !== "number" ||
      typeof parsed.matchesPlayed !== "number" ||
      typeof parsed.updatedAt !== "string"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ profileCode: string }> },
) {
  const { profileCode } = await context.params;
  const storedProfile = await readStoredProfile(profileCode);

  if (!storedProfile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json(storedProfile);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ profileCode: string }> },
) {
  const { profileCode } = await context.params;
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
      profileCode,
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

  await redis.set(profileKey(profileCode), JSON.stringify(storedProfile));

  return NextResponse.json(storedProfile);
}
