import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDeckLevelProgress } from "../../../_lib/spacedRepetition";

interface RouteContext {
  params: Promise<{ deckId: string }>;
}

/**
 * Mastery counts for each of a deck's topic levels, in seed order.
 *
 * The topic page shows five level cards at once and needs to know which ones
 * are actually finished — `/progress?level=n` would mean five round trips.
 */
export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { deckId } = await context.params;
  const levels = await getDeckLevelProgress(session.user.id, deckId);

  if (!levels) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  return NextResponse.json({ levels });
}
