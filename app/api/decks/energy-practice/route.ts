import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { selectKnownWordsForReview } from "../_lib/spacedRepetition";

/**
 * Returns a randomised batch of the user's known words for energy-practice.
 * GET /api/decks/energy-practice
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const words = await selectKnownWordsForReview(session.user.id);
  return NextResponse.json({ words });
}
