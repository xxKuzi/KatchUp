import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { seedTopicDecks } from "@/app/api/decks/_lib/deckStore";

// Idempotent: creates the canonical topic decks + words if missing, no-ops
// otherwise. Any signed-in user may trigger it; re-running is harmless.
//
// Vocabulary seeding used to live here too, reading public/data/words-*.json
// into the retired `global_words` table. The unified corpus is seeded from the
// CLI instead (scripts/seed-concepts.ts), since data/concepts.json isn't served
// as a static asset and a ~4000-row load has no business behind a web request.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deckResult = await seedTopicDecks();

  return NextResponse.json({ ok: true, ...deckResult });
}
