import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { matchPlayers, matchQuestions, matches, users } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ matchId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const { matchId } = await context.params;
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
  });

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const me = await db.query.matchPlayers.findFirst({
    where: and(
      eq(matchPlayers.matchId, matchId),
      eq(matchPlayers.userId, userId),
    ),
  });

  if (!me) {
    return NextResponse.json({ error: "Not in match" }, { status: 403 });
  }

  const players = await db
    .select({
      id: users.id,
      name: users.name,
      avatar: users.image,
      progress: matchPlayers.progress,
      correctCount: matchPlayers.correctCount,
      side: matchPlayers.side,
    })
    .from(matchPlayers)
    .innerJoin(users, eq(matchPlayers.userId, users.id))
    .where(eq(matchPlayers.matchId, matchId));

  const questions = await db
    .select()
    .from(matchQuestions)
    .where(eq(matchQuestions.matchId, matchId))
    .orderBy(asc(matchQuestions.orderIndex));

  const nextQuestion = questions[me.progress] ?? null;
  const opponent = players.find((player) => player.id !== userId) ?? null;

  return NextResponse.json({
    match: {
      id: match.id,
      status: match.status,
      winnerId: match.winnerUserId,
      totalQuestions: questions.length,
      language: match.language,
      level: match.level,
    },
    me,
    opponent,
    nextQuestion,
    questions: questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      options: q.options,
      correctOption: q.correctOption,
    })),
  });
}
