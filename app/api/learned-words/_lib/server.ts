import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userWordStats, deckWords, decks } from "@/db/schema";

export interface LearnedWordItem {
  id: string;
  native: string;
  foreign: string;
  source: "deck";
  sourceLabel: string;
  status: "learned" | "practicing";
  /**
   * Mastery progress, not a count of answers. A confident flip-card answer moves
   * this by two, so the badge reads the same number the "learned" label is
   * decided from — `times_correct` used to be shown here and told a player who
   * had just mastered a word in two answers that they had practised it twice.
   */
  streak: number | null;
  /**
   * Plain count of correct answers, shown while a word is still in practice —
   * mastery progress means little before it is reached, but "you have had this
   * one right twice" is something a player can act on.
   */
  timesCorrect: number | null;
  updatedAt: string | null;
}

export interface LearnedWordsPage {
  items: LearnedWordItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

async function fetchDeckItems(userId: string): Promise<LearnedWordItem[]> {
  const rows = await db
    .select({
      // The stat row, not the deck word: a word can outlive the deck it was
      // learned in, and the id is only ever used as a list key.
      id: userWordStats.id,
      vocabKey: userWordStats.vocabKey,
      nativeLang: userWordStats.nativeLang,
      foreignLang: userWordStats.foreignLang,
      // Off the stat row, so a word survives its deck being edited or deleted.
      native: userWordStats.nativeText,
      foreign: userWordStats.foreignText,
      streak: userWordStats.streak,
      timesCorrect: userWordStats.timesCorrect,
      known: userWordStats.known,
      updatedAt: userWordStats.updatedAt,
      deckName: decks.name,
    })
    .from(userWordStats)
    // Provenance only: names the deck the word was first practised in, and does
    // not decide whether the word is listed.
    .leftJoin(deckWords, eq(deckWords.id, userWordStats.deckWordId))
    .leftJoin(decks, eq(decks.id, deckWords.deckId))
    .where(eq(userWordStats.userId, userId));

  // One entry per word, not per deck row: the same word practised in two decks
  // used to be listed twice. Mastery wins, then the more-practised copy.
  const byIdentity = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!row.native || !row.foreign) {
      continue;
    }
    const key = `${row.nativeLang}|${row.foreignLang}|${row.vocabKey ?? row.id}`;
    const existing = byIdentity.get(key);
    if (
      !existing ||
      (row.known && !existing.known) ||
      (row.known === existing.known && row.streak > existing.streak)
    ) {
      byIdentity.set(key, row);
    }
  }

  return [...byIdentity.values()].map((row) => ({
    id: row.id,
    native: row.native as string,
    foreign: row.foreign as string,
    source: "deck",
    sourceLabel: row.deckName ?? "",
    // Anything short of mastery is still in rotation — it was never a word the
    // user chose to skip, so the label says so.
    status: row.known ? "learned" : "practicing",
    streak: row.streak,
    timesCorrect: row.timesCorrect,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  }));
}

/**
 * Paginated view over every word the user has practised.
 *
 * Previously this merged two progress systems; the lecture one was retired
 * along with its hardcoded word list, so decks are now the only source.
 * Per-user row counts are small, so everything is fetched and sorted in memory
 * and only the requested page is sent to the client.
 */
export async function fetchLearnedWords(
  userId: string,
  page: number,
  pageSize: number,
): Promise<LearnedWordsPage> {
  // Learned words come first — the page is what the user has to show for the
  // practice, so the mastered ones lead and the in-practice tail follows.
  // Recency orders each group.
  const all = (await fetchDeckItems(userId)).sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === "learned" ? -1 : 1;
    }
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
