import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  WordInput,
  deleteCustomDeck,
  getDeckForUser,
  syncDeckWords,
  updateCustomDeck,
} from "../_lib/deckStore";

interface RouteContext {
  params: Promise<{ deckId: string }>;
}

function sanitizeWords(value: unknown): WordInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const word = (item ?? {}) as Partial<WordInput>;
      return {
        id: typeof word.id === "string" ? word.id : undefined,
        native: typeof word.native === "string" ? word.native.trim() : "",
        foreign: typeof word.foreign === "string" ? word.foreign.trim() : "",
      };
    })
    .filter((word) => word.native.length > 0 && word.foreign.length > 0);
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { deckId } = await context.params;
  const deck = await getDeckForUser(deckId, session.user.id);
  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  return NextResponse.json({ deck });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { deckId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    nativeLang?: string;
    foreignLang?: string;
    words?: unknown;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const meta = {
    ...(typeof body.name === "string" ? { name: body.name.trim() } : {}),
    ...(typeof body.nativeLang === "string"
      ? { nativeLang: body.nativeLang.trim() }
      : {}),
    ...(typeof body.foreignLang === "string"
      ? { foreignLang: body.foreignLang.trim() }
      : {}),
  };

  let updated = await updateCustomDeck(session.user.id, deckId, meta);
  if (!updated) {
    return NextResponse.json(
      { error: "Deck not found or not editable" },
      { status: 404 },
    );
  }

  // If the caller sent a word list, sync it against what's stored so
  // unedited words keep their practice stats.
  if (body.words !== undefined) {
    updated = await syncDeckWords(
      session.user.id,
      deckId,
      sanitizeWords(body.words),
    );
  }

  return NextResponse.json({ deck: updated });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { deckId } = await context.params;
  const deleted = await deleteCustomDeck(session.user.id, deckId);
  if (!deleted) {
    return NextResponse.json(
      { error: "Deck not found or not editable" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
