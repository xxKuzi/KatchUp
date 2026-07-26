import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getDeckProgress,
  TOPIC_LEVEL_COUNT,
} from "../../_lib/spacedRepetition";

interface RouteContext {
  params: Promise<{ deckId: string }>;
}

/**
 * Current mastery counts for a deck.
 *
 * The `summary` inside a session response is computed when the session starts,
 * so it's already stale by the end-of-round screen. This gives that screen a
 * fresh count without refetching a whole session.
 *
 * `?level=1..5` scopes the count to one topic level's slice of the deck.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { deckId } = await context.params;

  const levelParam = request.nextUrl.searchParams.get("level");
  const parsedLevel = levelParam ? Number.parseInt(levelParam, 10) : NaN;
  const level =
    Number.isFinite(parsedLevel) &&
    parsedLevel >= 1 &&
    parsedLevel <= TOPIC_LEVEL_COUNT
      ? parsedLevel
      : undefined;

  const progress = await getDeckProgress(session.user.id, deckId, level);

  if (!progress) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  return NextResponse.json({ progress });
}
