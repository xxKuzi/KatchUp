import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userWordStats, deckWords, decks, userWordProgress } from "@/db/schema";
import { WORDS_DATABASE } from "@/app/games/_lib/learning/wordDatabase";
import type { SupportedLanguage } from "@/app/games/_lib/learning/types";

export interface LearnedWordItem {
  id: string;
  native: string;
  foreign: string;
  source: "deck" | "lecture";
  sourceLabel: string;
  status: "learned" | "skipped";
  times: number | null;
  updatedAt: string | null;
}

export interface LearnedWordsPage {
  items: LearnedWordItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// wordId -> static text/lecture lookup, built once from the in-code lecture
// database (the source of truth for `userWordProgress.wordId`).
const LECTURE_WORD_INDEX = new Map<
  string,
  { native: string; foreign: string; language: SupportedLanguage; lecture: number }
>();
for (const language of Object.keys(WORDS_DATABASE) as SupportedLanguage[]) {
  for (const lecture of WORDS_DATABASE[language]) {
    for (const word of lecture.words) {
      LECTURE_WORD_INDEX.set(word.id, {
        native: word.native,
        foreign: word.foreign,
        language,
        lecture: lecture.number,
      });
    }
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

async function fetchDeckItems(userId: string): Promise<LearnedWordItem[]> {
  const rows = await db
    .select({
      id: userWordStats.deckWordId,
      native: deckWords.native,
      foreign: deckWords.foreign,
      timesCorrect: userWordStats.timesCorrect,
      known: userWordStats.known,
      updatedAt: userWordStats.updatedAt,
      deckName: decks.name,
    })
    .from(userWordStats)
    .innerJoin(deckWords, eq(deckWords.id, userWordStats.deckWordId))
    .innerJoin(decks, eq(decks.id, deckWords.deckId))
    .where(eq(userWordStats.userId, userId));

  return rows.map((row) => ({
    id: row.id,
    native: row.native,
    foreign: row.foreign,
    source: "deck",
    sourceLabel: row.deckName,
    status: row.known ? "learned" : "skipped",
    times: row.timesCorrect,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  }));
}

async function fetchLectureItems(userId: string): Promise<LearnedWordItem[]> {
  const rows = await db
    .select({
      wordId: userWordProgress.wordId,
      isMastered: userWordProgress.isMastered,
      streak: userWordProgress.streak,
      updatedAt: userWordProgress.updatedAt,
    })
    .from(userWordProgress)
    .where(eq(userWordProgress.userId, userId));

  const items: LearnedWordItem[] = [];
  for (const row of rows) {
    const word = LECTURE_WORD_INDEX.get(row.wordId);
    if (!word) continue;
    items.push({
      id: row.wordId,
      native: word.native,
      foreign: word.foreign,
      source: "lecture",
      sourceLabel: `${capitalize(word.language)} · Lecture ${word.lecture}`,
      status: row.isMastered ? "learned" : "skipped",
      times: row.isMastered ? row.streak : null,
      updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
    });
  }
  return items;
}

/**
 * Combined, paginated view over both progress systems (deck words +
 * lecture/global words). Per-user row counts are small (a handful of decks
 * plus at most ~90 lecture words), so both sources are fetched in full and
 * merged in memory; only the requested page is ever sent to the client.
 */
export async function fetchLearnedWords(
  userId: string,
  page: number,
  pageSize: number,
): Promise<LearnedWordsPage> {
  const [deckItems, lectureItems] = await Promise.all([
    fetchDeckItems(userId),
    fetchLectureItems(userId),
  ]);

  const all = [...deckItems, ...lectureItems].sort((a, b) => {
    const aTime = a.updatedAt ? Date.parse(a.updatedAt) : 0;
    const bTime = b.updatedAt ? Date.parse(b.updatedAt) : 0;
    return bTime - aTime;
  });

  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: all.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    total,
    totalPages,
  };
}
