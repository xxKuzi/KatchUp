import { NextRequest, NextResponse } from "next/server";
import { isCefrLevel, normalizeLang } from "@/app/_lib/languages";
import { getWordPairs, type Direction } from "./_lib/wordPool";

/**
 * Vocabulary for the games.
 *
 * Deliberately unauthenticated: anonymous visitors get a free Score Rush round
 * before signing in, so this must work without a session. Vocabulary is static
 * reference data, not user data.
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

  const words = await getWordPairs({
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
