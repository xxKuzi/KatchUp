import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userProfiles } from "@/db/schema";
import { or, ilike, desc } from "drizzle-orm";
import {
  normalizeStoredProfileCode,
  type PublicFriendProfile,
} from "@/app/friends/_lib/profile";

const MAX_RESULTS = 20;

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query") ?? "";
  const needle = normalizeStoredProfileCode(query);

  if (needle.length < 2) {
    return NextResponse.json({ results: [] as PublicFriendProfile[] });
  }

  // Database-level wildcard search matching either tag or nickname case-insensitively
  const rows = await db
    .select()
    .from(userProfiles)
    .where(
      or(
        ilike(userProfiles.profileCode, `%${needle}%`),
        ilike(userProfiles.nickname, `%${needle}%`),
      ),
    )
    .orderBy(desc(userProfiles.updatedAt))
    .limit(MAX_RESULTS);

  const results: PublicFriendProfile[] = rows.map((row) => ({
    profileCode: row.profileCode,
    nickname: row.nickname,
    avatarBackgroundId: row.avatarBackgroundId,
    avatarIcon: row.avatarIcon,
    currentXp: row.currentXp,
    leagueName: row.leagueName,
    friendsCount: row.friendsCount,
    matchesPlayed: row.matchesPlayed,
    updatedAt: row.updatedAt.toISOString(),
  }));

  return NextResponse.json({ results });
}
