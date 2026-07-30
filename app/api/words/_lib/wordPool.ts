import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { conceptTranslations } from "@/db/schema";
import type { CefrLevel, Lang } from "@/app/_lib/languages";

/**
 * Vocabulary access for every game.
 *
 * A "pair" is a prompt in one language and its answer in another, joined on the
 * shared concept. Because every concept carries all four languages, any of the
 * 12 directed pairs works — including ones with English as the *target*, which
 * the old per-language word tables could not express.
 */

/**
 * Which side of the pair is shown as the question.
 *
 * Games differ deliberately: score-rush shows the target word and asks what it
 * means (recognition, the easier task), while flip-cards and speed-spelling show
 * your own language and ask you to produce the target (recall, harder).
 */
export type Direction = "recognition" | "recall";

export interface WordPair {
  conceptId: string;
  prompt: string;
  answer: string;
  /** CEFR level in the language being learned. */
  level: CefrLevel;
}

export interface GetWordPairsOptions {
  /** The language the user already speaks. */
  speak: Lang;
  /** The language the user is learning. */
  learning: Lang;
  direction: Direction;
  /** Always interpreted against `learning` — difficulty belongs to the target. */
  level?: CefrLevel;
  count?: number;
}

const DEFAULT_COUNT = 10;
const MAX_COUNT = 100;
/** How many extra rows to draw so the same-answer filter can still fill a round. */
const OVERFETCH = 3;
const MAX_OVERFETCH = 300;

/**
 * Keeps one word per answer.
 *
 * German writes both "big" and "large" as `groß`, and anger, fury and rage all
 * as `Wut`. Two such words in one round is not a harder round, it is a broken
 * one: Guess Match would show two identical tiles with no way to tell which
 * English word each belongs to, and a multiple-choice round would offer the
 * same word as two different options, one of them marked wrong.
 *
 * Both words stay in the corpus and both can still be taught — just never in
 * the same round. Rows arrive shuffled, so which one survives is random.
 */
export function dedupeByAnswer<T extends { answer: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = row.answer.trim().toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/** Which language ends up on each side, given the game's direction. */
export function resolveDirection(
  speak: Lang,
  learning: Lang,
  direction: Direction,
): { promptLang: Lang; answerLang: Lang } {
  return direction === "recognition"
    ? { promptLang: learning, answerLang: speak }
    : { promptLang: speak, answerLang: learning };
}

/**
 * Concepts that exist in both languages, optionally restricted to a CEFR level.
 *
 * The level is deliberately tied to `learning` rather than to whichever side
 * happens to be the answer: "voyage" is A1 in Spanish but B2 in German, and
 * that difficulty belongs to the language you're studying regardless of which
 * direction the game happens to quiz you in.
 */
export async function getWordPairs({
  speak,
  learning,
  direction,
  level,
  count = DEFAULT_COUNT,
}: GetWordPairsOptions): Promise<WordPair[]> {
  if (speak === learning) {
    return [];
  }

  const learnSide = alias(conceptTranslations, "learn_side");
  const speakSide = alias(conceptTranslations, "speak_side");

  const filters = [eq(learnSide.lang, learning), eq(speakSide.lang, speak)];
  if (level) {
    filters.push(eq(learnSide.level, level));
  }

  const limit = Math.min(Math.max(1, count), MAX_COUNT);
  const isRecognition = direction === "recognition";
  const answerSide = isRecognition ? speakSide : learnSide;
  const promptSide = isRecognition ? learnSide : speakSide;

  const rows = await db
    .select({
      conceptId: learnSide.conceptId,
      prompt: promptSide.text,
      answer: answerSide.text,
      level: learnSide.level,
    })
    .from(learnSide)
    .innerJoin(speakSide, eq(speakSide.conceptId, learnSide.conceptId))
    .where(and(...filters))
    .orderBy(sql`random()`)
    // Over-fetch so the same-answer filter below still has enough to fill the
    // round. Costs nothing worth measuring: it is the same round trip, and the
    // rows are a few hundred bytes each.
    .limit(Math.min(limit * OVERFETCH, MAX_OVERFETCH));

  const pairs = dedupeByAnswer(rows as WordPair[]).slice(0, limit);

  // A thin level would make a round repetitive, so widen to the whole language
  // rather than handing back a stunted set.
  if (level && pairs.length < limit) {
    const topUp = await getWordPairs({
      speak,
      learning,
      direction,
      count: limit,
    });
    const seen = new Set(pairs.map((pair) => pair.conceptId));
    const seenAnswers = new Set(pairs.map((pair) => pair.answer.toLowerCase()));
    for (const pair of topUp) {
      if (pairs.length >= limit) break;
      const answer = pair.answer.toLowerCase();
      if (!seen.has(pair.conceptId) && !seenAnswers.has(answer)) {
        seen.add(pair.conceptId);
        seenAnswers.add(answer);
        pairs.push(pair);
      }
    }
  }

  return pairs;
}

/**
 * Wrong answers for a multiple-choice question: other words in the *answer*
 * language, excluding the concepts already on screen.
 */
export async function getDistractors({
  lang,
  level,
  excludeConceptIds = [],
  count = 3,
}: {
  lang: Lang;
  level?: CefrLevel;
  excludeConceptIds?: string[];
  count?: number;
}): Promise<string[]> {
  const filters = [eq(conceptTranslations.lang, lang)];
  if (level) {
    filters.push(eq(conceptTranslations.level, level));
  }
  if (excludeConceptIds.length) {
    filters.push(notInArray(conceptTranslations.conceptId, excludeConceptIds));
  }

  const rows = await db
    .select({ text: conceptTranslations.text })
    .from(conceptTranslations)
    .where(and(...filters))
    .orderBy(sql`random()`)
    .limit(Math.min(Math.max(1, count), MAX_COUNT));

  return rows.map((row) => row.text);
}

/**
 * The wording of specific concepts in one language, keyed by concept id.
 *
 * Lets a server-graded quiz re-derive the right answer from the database
 * instead of trusting whatever the client says the answer was.
 */
export async function getTranslationsForConcepts(
  conceptIds: string[],
  lang: Lang,
): Promise<Map<string, string>> {
  if (conceptIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      conceptId: conceptTranslations.conceptId,
      text: conceptTranslations.text,
    })
    .from(conceptTranslations)
    .where(
      and(
        eq(conceptTranslations.lang, lang),
        inArray(conceptTranslations.conceptId, conceptIds.slice(0, MAX_COUNT)),
      ),
    );

  return new Map(rows.map((row) => [row.conceptId, row.text]));
}

/**
 * The difficulty each concept carries in one language.
 *
 * The placement test needs this at grading time: it tallies answers by band, and
 * which band a question belonged to has to come from the corpus rather than from
 * whatever the client says it was sitting.
 */
export async function getLevelsForConcepts(
  conceptIds: string[],
  lang: Lang,
): Promise<Map<string, CefrLevel>> {
  if (conceptIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      conceptId: conceptTranslations.conceptId,
      level: conceptTranslations.level,
    })
    .from(conceptTranslations)
    .where(
      and(
        eq(conceptTranslations.lang, lang),
        inArray(conceptTranslations.conceptId, conceptIds.slice(0, MAX_COUNT)),
      ),
    );

  return new Map(rows.map((row) => [row.conceptId, row.level as CefrLevel]));
}

/** How many concepts a pair has available — used to validate a selection. */
export async function countWordPairs({
  speak,
  learning,
  level,
}: {
  speak: Lang;
  learning: Lang;
  level?: CefrLevel;
}): Promise<number> {
  if (speak === learning) {
    return 0;
  }

  const learnSide = alias(conceptTranslations, "learn_side");
  const speakSide = alias(conceptTranslations, "speak_side");

  const filters = [eq(learnSide.lang, learning), eq(speakSide.lang, speak)];
  if (level) {
    filters.push(eq(learnSide.level, level));
  }

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(learnSide)
    .innerJoin(speakSide, eq(speakSide.conceptId, learnSide.conceptId))
    .where(and(...filters));

  return Number(row?.count ?? 0);
}
