import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeLang } from "@/app/_lib/languages";
import { db } from "@/lib/db";
import { matchPlayers, matches, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { MATCH_COUNTDOWN_MS } from "@/app/api/flip-cards/_lib/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = request.nextUrl;
  const language = searchParams.get("language");
  const level = searchParams.get("level");

  if (!level || !normalizeLang(language)) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  // Search for the user's active match
  const activePlayerMatches = await db
    .select({
      matchId: matchPlayers.matchId,
      createdAt: matches.createdAt,
    })
    .from(matchPlayers)
    .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
    .where(
      and(
        eq(matchPlayers.userId, userId),
        eq(matches.status, "active")
      )
    )
    .limit(1);

  if (activePlayerMatches.length === 0) {
    return NextResponse.json({ status: "waiting" });
  }

  const activeMatchId = activePlayerMatches[0].matchId;
  const matchStartAt =
    activePlayerMatches[0].createdAt.getTime() + MATCH_COUNTDOWN_MS;

  const opponent = await db
    .select({ id: users.id, name: users.name, avatar: users.image })
    .from(matchPlayers)
    .innerJoin(users, eq(matchPlayers.userId, users.id))
    .where(eq(matchPlayers.matchId, activeMatchId))
    .limit(2);

  return NextResponse.json({
    status: "matched",
    matchId: activeMatchId,
    opponent: opponent.find((player) => player.id !== userId) ?? null,
    matchStartAt,
  });
}
