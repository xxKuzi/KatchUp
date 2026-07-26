import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeLang } from "@/app/_lib/languages";
import { normalizeState } from "@/app/topics/_lib/topicsModel";
import {
  mergeTopicsStateForUser,
  readTopicsState,
} from "../_lib/topicProgressStore";

/**
 * The account's topic ladder — keys, unlocked packs, cleared levels and crowns.
 *
 * GET reads it; POST posts what a browser has and gets everything back merged,
 * which is both how a device catches up and how it saves. Progress is tracked
 * per UI language, so the language always comes along.
 */

function readLanguage(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return normalizeLang(value);
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const language = readLanguage(params.get("language"));
  if (!language) {
    return NextResponse.json({ error: "Unknown language" }, { status: 400 });
  }

  // The language being learned resolves the packs' decks, which is what lets
  // cleared levels be counted from the word stats rather than taken on trust.
  const foreignLang = readLanguage(params.get("foreignLang"));
  const state = await readTopicsState(session.user.id, language, foreignLang);
  return NextResponse.json({ state });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    language?: string;
    foreignLang?: string;
    state?: unknown;
  } | null;

  const language = readLanguage(body?.language ?? null);
  if (!language) {
    return NextResponse.json({ error: "Unknown language" }, { status: 400 });
  }

  // Whatever arrives is run through the same normaliser the browser uses, and
  // the store then takes only the two fields a browser owns. Cleared levels,
  // finished packs and crowns in this body are ignored outright — they are
  // counted from the word stats and from graded rounds instead.
  const incoming = normalizeState(body?.state);
  const state = await mergeTopicsStateForUser(
    session.user.id,
    language,
    incoming,
    readLanguage(body?.foreignLang ?? null),
  );

  return NextResponse.json({ state });
}
