import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isLang } from "@/app/_lib/languages";
import { normalizeArticle } from "@/app/_lib/articles";
import {
  WordInput,
  createCustomDeck,
  ensureDefaultDeck,
  listCustomDecks,
  listDecksForUser,
} from "./_lib/deckStore";

function sanitizeWords(value: unknown): WordInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const word = (item ?? {}) as Partial<WordInput>;
      return {
        native: typeof word.native === "string" ? word.native.trim() : "",
        foreign: typeof word.foreign === "string" ? word.foreign.trim() : "",
        // Left undefined when the client sent no opinion, so `prepareWords` may
        // adopt the corpus's article; an explicit value is validated there
        // again, against the deck's own foreign language.
        ...("article" in word
          ? { article: normalizeArticle(word.article) }
          : {}),
      };
    })
    .filter((word) => word.native.length > 0 && word.foreign.length > 0);
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The pair the client is studying. When it is known, make sure the account
  // owns a starter deck for it before listing, so a fresh user never sees an
  // empty deck list.
  const nativeLang = request.nextUrl.searchParams.get("nativeLang");
  const foreignLang = request.nextUrl.searchParams.get("foreignLang");
  if (isLang(nativeLang) && isLang(foreignLang)) {
    await ensureDefaultDeck(session.user.id, nativeLang, foreignLang);
  }

  // ?scope=all also returns the shared topic decks; default is custom only.
  const scope = request.nextUrl.searchParams.get("scope");
  const decks =
    scope === "all"
      ? await listDecksForUser(session.user.id)
      : await listCustomDecks(session.user.id);

  return NextResponse.json({ decks });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    name?: string;
    nativeLang?: string;
    foreignLang?: string;
    words?: unknown;
  } | null;

  const name = body?.name?.trim();
  const nativeLang = body?.nativeLang?.trim();
  const foreignLang = body?.foreignLang?.trim();

  if (!name || !nativeLang || !foreignLang) {
    return NextResponse.json(
      { error: "name, nativeLang and foreignLang are required" },
      { status: 400 },
    );
  }
  if (name.length > 120) {
    return NextResponse.json({ error: "Name is too long" }, { status: 400 });
  }

  const deck = await createCustomDeck(session.user.id, {
    name,
    nativeLang,
    foreignLang,
    words: sanitizeWords(body?.words),
  });

  return NextResponse.json({ deck }, { status: 201 });
}
