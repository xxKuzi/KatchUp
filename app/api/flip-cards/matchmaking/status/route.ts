import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { SupportedLanguage } from "@/app/games/_lib/learning/types";
import { db } from "@/lib/db";
import { matchPlayers, matches, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";

function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return value === "german" || value === "spanish" || value === "czech";
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = request.nextUrl;
  const language = searchParams.get("language");
  const level = searchParams.get("level");

  if (!level || !isSupportedLanguage(language)) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  // Search for the user's active match
  const activePlayerMatches = await db
    .select({
      matchId: matchPlayers.matchId,
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
  });
}
