import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDeckProgress } from "../../_lib/spacedRepetition";

interface RouteContext {
  params: Promise<{ deckId: string }>;
}

/**
 * Current mastery counts for a deck.
 *
 * The `summary` inside a session response is computed when the session starts,
 * so it's already stale by the end-of-round screen. This gives that screen a
 * fresh count without refetching a whole session.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { deckId } = await context.params;
  const progress = await getDeckProgress(session.user.id, deckId);

  if (!progress) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  return NextResponse.json({ progress });
}
