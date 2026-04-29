import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { SupportedLanguage } from "@/app/games/_lib/learning/types";
import { db } from "@/lib/db";
import { matchPlayers, matches, users } from "@/db/schema";
import { eq } from "drizzle-orm";

function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return value === "german" || value === "spanish";
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

  const playerMatch = await db.query.matchPlayers.findFirst({
    where: eq(matchPlayers.userId, userId),
  });

  if (!playerMatch) {
    return NextResponse.json({ status: "waiting" });
  }

  const match = await db.query.matches.findFirst({
    where: eq(matches.id, playerMatch.matchId),
  });

  if (!match) {
    return NextResponse.json({ status: "waiting" });
  }

  const opponent = await db
    .select({ id: users.id, name: users.name, avatar: users.image })
    .from(matchPlayers)
    .innerJoin(users, eq(matchPlayers.userId, users.id))
    .where(eq(matchPlayers.matchId, match.id))
    .limit(2);

  return NextResponse.json({
    status: "matched",
    matchId: match.id,
    opponent: opponent.find((player) => player.id !== userId) ?? null,
  });
}
