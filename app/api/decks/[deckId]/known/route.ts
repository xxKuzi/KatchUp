import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { setWordKnown } from "../../_lib/spacedRepetition";

interface RouteContext {
  params: Promise<{ deckId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { deckId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    deckWordId?: unknown;
    known?: unknown;
  } | null;

  const deckWordId =
    typeof body?.deckWordId === "string" ? body.deckWordId : "";
  if (!deckWordId) {
    return NextResponse.json(
      { error: "deckWordId is required" },
      { status: 400 },
    );
  }

  // Defaults to marking known; pass known:false to bring a word back.
  const known = body?.known !== false;

  const result = await setWordKnown(
    session.user.id,
    deckId,
    deckWordId,
    known,
  );
  if (!result) {
    return NextResponse.json({ error: "Word not found" }, { status: 404 });
  }

  return NextResponse.json(result);
}
