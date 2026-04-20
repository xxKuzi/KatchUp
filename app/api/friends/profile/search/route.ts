import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import {
  normalizeStoredProfileCode,
  type PublicFriendProfile,
} from "@/app/friends/_lib/profile";

const PROFILE_KEY_PREFIX = "katchup-friends-public-profile-v1";
const MAX_RESULTS = 20;

function isPublicFriendProfile(value: unknown): value is PublicFriendProfile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.profileCode === "string" &&
    typeof record.nickname === "string" &&
    typeof record.avatarBackgroundId === "string" &&
    typeof record.avatarIcon === "string" &&
    typeof record.currentXp === "number" &&
    typeof record.leagueName === "string" &&
    typeof record.friendsCount === "number" &&
    typeof record.matchesPlayed === "number" &&
    typeof record.updatedAt === "string"
  );
}

function toSearchNeedle(value: string): string {
  return normalizeStoredProfileCode(value).slice(0, 16);
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query") ?? "";
  const needle = toSearchNeedle(query);

  if (needle.length < 2) {
    return NextResponse.json({ results: [] as PublicFriendProfile[] });
  }

  const keys = await redis.keys(`${PROFILE_KEY_PREFIX}:*`);

  if (!Array.isArray(keys) || keys.length === 0) {
    return NextResponse.json({ results: [] as PublicFriendProfile[] });
  }

  const rawProfiles = await Promise.all(
    keys.map((key) => redis.get<string>(key).catch(() => null)),
  );

  const parsedProfiles: PublicFriendProfile[] = [];

  for (const rawProfile of rawProfiles) {
    if (!rawProfile || typeof rawProfile !== "string") {
      continue;
    }

    try {
      const parsed = JSON.parse(rawProfile) as unknown;

      if (isPublicFriendProfile(parsed)) {
        parsedProfiles.push(parsed);
      }
    } catch {
      // Ignore malformed records and continue scanning.
    }
  }

  const filtered = parsedProfiles
    .filter((profile) => {
      const code = normalizeStoredProfileCode(profile.profileCode);
      const name = profile.nickname.trim().toLowerCase();
      return code.includes(needle) || name.includes(needle);
    })
    .sort((left, right) => {
      const leftTime = new Date(left.updatedAt).getTime();
      const rightTime = new Date(right.updatedAt).getTime();
      return rightTime - leftTime;
    })
    .slice(0, MAX_RESULTS);

  return NextResponse.json({ results: filtered });
}
