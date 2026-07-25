import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { countKnownWordsForLanguage } from "../_lib/spacedRepetition";

/**
 * Returns how many words the signed-in user has mastered in a given
 * language, used to derive the navbar's CEFR-style level badge.
 * GET /api/decks/level?language=deutsch
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const language = request.nextUrl.searchParams.get("language")?.trim();
  if (!language) {
    return NextResponse.json(
      { error: "language is required" },
      { status: 400 },
    );
  }

  const masteredCount = await countKnownWordsForLanguage(
    session.user.id,
    language,
  );

  return NextResponse.json({ masteredCount });
}
