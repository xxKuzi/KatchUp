import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDeckSnapshot } from "../../_lib/spacedRepetition";

interface RouteContext {
  params: Promise<{ deckId: string }>;
}

/**
 * The download behind "Available offline": the deck's whole word list plus the
 * user's history for each word, in one request.
 *
 * Only custom decks may be taken offline for now. Topic decks are topped up
 * server-side and their levels mint keys, so a stale copy of one on a device
 * would be a copy of a moving target; custom decks are the user's own list and
 * change only when they edit it.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { deckId } = await context.params;
  const snapshot = await getDeckSnapshot(session.user.id, deckId);
  if (!snapshot) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  return NextResponse.json(
    { snapshot },
    // Account data: never store it in a shared cache, and never re-serve it.
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
