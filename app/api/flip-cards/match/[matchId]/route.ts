import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { matchPlayers, matchQuestions, matches, users } from "@/db/schema";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { WINNING_CORRECT_ANSWERS } from "@/app/api/flip-cards/_lib/server";

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

  const players = await db
    .select({
      id: users.id,
      // Duels show the friends-profile nickname; the account name is only a
      // fallback for matches created before nicknames were recorded.
      name: matchPlayers.displayName,
      accountName: users.name,
      avatar: matchPlayers.displayAvatar,
      accountAvatar: users.image,
      progress: matchPlayers.progress,
      correct: matchPlayers.correctCount,
      side: matchPlayers.side,
      acceptedAt: matchPlayers.acceptedAt,
      nativeLang: matchPlayers.nativeLang,
      language: matchPlayers.language,
      level: matchPlayers.level,
    })
    .from(matchPlayers)
    .innerJoin(users, eq(matchPlayers.userId, users.id))
    .where(eq(matchPlayers.matchId, matchId));

  const toPlayer = (row: (typeof players)[number]) => ({
    id: row.id,
    name: row.name ?? row.accountName ?? "Player",
    avatar:
      row.avatar ??
      row.accountAvatar ??
      "https://i.pravatar.cc/100?img=12",
    progress: row.progress,
    correct: row.correct,
    side: row.side,
    accepted: row.acceptedAt !== null,
  });

  const meRow = players.find((player) => player.id === userId) ?? null;

  if (!meRow) {
    return NextResponse.json({ error: "Not in match" }, { status: 403 });
  }

  // In personal mode each player has their own set of prompts; returning the
  // whole table would both leak the opponent's questions and inflate the
  // player's question count.
  const questions = await db
    .select()
    .from(matchQuestions)
    .where(
      and(
        eq(matchQuestions.matchId, matchId),
        or(isNull(matchQuestions.userId), eq(matchQuestions.userId, userId)),
      ),
    )
    .orderBy(asc(matchQuestions.orderIndex));

  const me = toPlayer(meRow);
  const opponentRow = players.find((player) => player.id !== userId) ?? null;
  const opponent = opponentRow ? toPlayer(opponentRow) : null;
  const mapped = questions.map((question) => ({
    id: question.id,
    prompt: question.prompt,
    options: question.options,
    correctOption: question.correctOption,
  }));

  return NextResponse.json({
    match: {
      id: match.id,
      status: match.status,
      winnerId: match.winnerUserId,
      totalQuestions: mapped.length,
      targetCorrect: WINNING_CORRECT_ANSWERS,
      language: meRow.language ?? match.language,
      level: meRow.level ?? match.level,
      mode: match.mode,
      // Null until both players accept - that is when the shared clock is set.
      startAt: match.startAt?.getTime() ?? null,
    },
    me,
    opponent,
    nextQuestion: mapped[me.progress] ?? null,
    questions: mapped,
  });
}
