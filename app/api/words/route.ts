import { NextRequest, NextResponse } from "next/server";
import { isCefrLevel, normalizeLang } from "@/app/_lib/languages";
import { auth } from "@/auth";
import { getWordPairs, type Direction } from "./_lib/wordPool";
import { getPersonalWordPairs } from "./_lib/personalPool";

/**
 * Vocabulary for the games.
 *
 * Works without a session: visitors get a round before signing in, so a missing
 * session is a normal case rather than an error.
 *
 * With one, the round is personalised — a few words carried over from the last
 * session, some due for review, the rest new — so play builds on itself instead
 * of re-drawing at random every time. See `getPersonalWordPairs`.
 *
 *   GET /api/words?speak=de&learning=en&direction=recognition&level=A1&count=10
 *
 * `level` always refers to the language being learned, never to the prompt
 * side, so it means the same thing whichever direction a game quizzes in.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const speak = normalizeLang(searchParams.get("speak"));
  const learning = normalizeLang(searchParams.get("learning"));

  if (!speak || !learning) {
    return NextResponse.json(
      { error: "Query params 'speak' and 'learning' must be valid languages" },
      { status: 400 },
    );
  }

  if (speak === learning) {
    return NextResponse.json(
      { error: "'speak' and 'learning' must differ" },
      { status: 400 },
    );
  }

  const directionParam = searchParams.get("direction") ?? "recognition";
  if (directionParam !== "recognition" && directionParam !== "recall") {
    return NextResponse.json(
      { error: `Unknown direction "${directionParam}"` },
      { status: 400 },
    );
  }
  const direction = directionParam as Direction;

  const levelParam = searchParams.get("level");
  const level = levelParam?.toUpperCase();
  if (levelParam && !isCefrLevel(level)) {
    return NextResponse.json(
      { error: `Unknown level "${levelParam}"` },
      { status: 400 },
    );
  }

  const countParam = Number(searchParams.get("count"));
  const count = Number.isFinite(countParam) && countParam > 0 ? countParam : 10;

  // Signed in, the round is built from what this player already knows: a few
  // words carried over from last time, some due for review, the rest new.
  // Signed out it stays a plain random draw — that path only has to serve the
  // single round played before signing in.
  const session = await auth();
  const userId = session?.user?.id;

  const words = userId
    ? await getPersonalWordPairs({
        userId,
        speak,
        learning,
        direction,
        level: isCefrLevel(level) ? level : undefined,
        count,
      })
    : await getWordPairs({
        speak,
        learning,
        direction,
        level: isCefrLevel(level) ? level : undefined,
        count,
      });

  return NextResponse.json(
    { speak, learning, direction, level: level ?? null, words },
    {
      // Never cache: each request is randomised, so a shared cache would hand
      // the same words to everyone replaying inside the window.
      headers: { "Cache-Control": "no-store" },
    },
  );
}
