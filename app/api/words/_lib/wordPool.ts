import { and, eq, notInArray, sql } from "drizzle-orm";
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
 * means (recognition, the easier task), while flip-cards and quick-guess show
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

  const rows = await db
    .select({
      conceptId: learnSide.conceptId,
      prompt: isRecognition ? learnSide.text : speakSide.text,
      answer: isRecognition ? speakSide.text : learnSide.text,
      level: learnSide.level,
    })
    .from(learnSide)
    .innerJoin(speakSide, eq(speakSide.conceptId, learnSide.conceptId))
    .where(and(...filters))
    .orderBy(sql`random()`)
    .limit(limit);

  const pairs = rows as WordPair[];

  // A thin level would make a round repetitive, so widen to the whole language
  // rather than handing back a stunted set.
  if (level && pairs.length < limit) {
    const topUp = await getWordPairs({ speak, learning, direction, count: limit });
    const seen = new Set(pairs.map((pair) => pair.conceptId));
    for (const pair of topUp) {
      if (pairs.length >= limit) break;
      if (!seen.has(pair.conceptId)) {
        seen.add(pair.conceptId);
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
