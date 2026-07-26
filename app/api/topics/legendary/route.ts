import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeLang } from "@/app/_lib/languages";
import { getTopicDeck } from "@/app/api/decks/_lib/deckStore";
import { LEGENDARY_REVIEW_SIZE } from "@/app/api/decks/_lib/spacedRepetition";
import { LEGENDARY_PASS_PERCENT } from "@/app/games/_lib/deckSessionClient";
import { TOPIC_IDS } from "@/app/topics/_lib/topicsModel";
import { awardLegendary, readTopicsState } from "../_lib/topicProgressStore";

/**
 * Grades a pack's review round and crowns it if it passed.
 *
 * The browser used to decide this on its own and save a flag, which meant the
 * crown was a line in localStorage anyone could write. It now submits the round
 * itself — which word got which verdict — and the score is counted here, against
 * the deck the round was drawn from. A short round, or one padded with words
 * from somewhere else, is not a round.
 */

interface RoundVerdict {
  deckWordId: string;
  correct: boolean;
}

function readVerdicts(value: unknown): RoundVerdict[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const verdicts: RoundVerdict[] = [];

  for (const entry of value) {
    const deckWordId = (entry as RoundVerdict | null)?.deckWordId;
    // One verdict per word: replaying the same card thirty times is not a round.
    if (typeof deckWordId !== "string" || seen.has(deckWordId)) {
      continue;
    }
    seen.add(deckWordId);
    verdicts.push({
      deckWordId,
      correct: Boolean((entry as RoundVerdict).correct),
    });
  }

  return verdicts;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    language?: string;
    foreignLang?: string;
    topicId?: string;
    results?: unknown;
  } | null;

  const language = normalizeLang(body?.language);
  const foreignLang = normalizeLang(body?.foreignLang);
  const topicId = body?.topicId;

  if (!language || !foreignLang || !topicId || !TOPIC_IDS.includes(topicId)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const deck = await getTopicDeck(topicId, foreignLang);
  if (!deck) {
    return NextResponse.json({ error: "Topic deck not found" }, { status: 404 });
  }

  // Only words of this pack count, so a round cannot be padded out with easy
  // words from elsewhere to reach the pass mark.
  const deckWordIds = new Set(deck.words.map((word) => word.id));
  const verdicts = readVerdicts(body?.results).filter((verdict) =>
    deckWordIds.has(verdict.deckWordId),
  );

  // A pack smaller than a full round is graded over everything it has.
  const required = Math.min(LEGENDARY_REVIEW_SIZE, deck.words.length);
  const correct = verdicts.filter((verdict) => verdict.correct).length;
  const score = verdicts.length
    ? Math.round((correct / verdicts.length) * 100)
    : 0;
  const passed =
    verdicts.length >= required && score >= LEGENDARY_PASS_PERCENT;

  const state = passed
    ? await awardLegendary(session.user.id, language, topicId, foreignLang)
    : await readTopicsState(session.user.id, language, foreignLang);

  return NextResponse.json({
    passed,
    score,
    counted: verdicts.length,
    required,
    state,
  });
}
