import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { seedTopicDecks } from "@/app/api/decks/_lib/deckStore";

// Idempotent: creates the canonical topic decks + words if missing, no-ops
// otherwise. Any signed-in user may trigger it; re-running is harmless.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await seedTopicDecks();
  return NextResponse.json({ ok: true, ...result });
}
