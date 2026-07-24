import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTopicDeck } from "../_lib/deckStore";

/**
 * Resolves a topic deck ID from its stable key + foreign language.
 * GET /api/decks/topic-lookup?topicKey=autos&foreignLang=german
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const topicKey = request.nextUrl.searchParams.get("topicKey");
  const foreignLang = request.nextUrl.searchParams.get("foreignLang");

  if (!topicKey || !foreignLang) {
    return NextResponse.json(
      { error: "topicKey and foreignLang are required" },
      { status: 400 },
    );
  }

  const deck = await getTopicDeck(topicKey, foreignLang);
  if (!deck) {
    return NextResponse.json(
      { error: "Topic deck not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ deckId: deck.id, name: deck.name });
}
