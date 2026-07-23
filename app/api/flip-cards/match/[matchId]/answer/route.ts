import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { matchAnswers, matchPlayers, matchQuestions } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { submitLiveAnswer } from "@/app/api/flip-cards/_lib/server";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ matchId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const { matchId } = await context.params;
  const body = (await request.json()) as {
    questionId?: string;
    selectedOption?: string;
    responseMs?: number;
  };

  if (!body.questionId || !body.selectedOption) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const player = await db.query.matchPlayers.findFirst({
    where: and(
      eq(matchPlayers.matchId, matchId),
      eq(matchPlayers.userId, userId),
    ),
  });
  const question = await db.query.matchQuestions.findFirst({
    where: and(
      eq(matchQuestions.matchId, matchId),
      eq(matchQuestions.id, body.questionId),
    ),
  });

  if (!player || !question) {
    return NextResponse.json({ error: "Match state invalid" }, { status: 400 });
  }

  const result = await submitLiveAnswer({
    matchId,
    userId,
    questionId: body.questionId,
    selectedOption: body.selectedOption,
    responseMs: body.responseMs ?? 0,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    isCorrect: result.isCorrect,
    status: result.status,
    winnerId: result.winnerUserId,
    progress: result.progress,
    correctCount: result.correctCount,
    nextQuestion: result.nextQuestion,
  });
}
