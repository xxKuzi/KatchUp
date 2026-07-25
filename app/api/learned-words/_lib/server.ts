import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userWordStats, deckWords, decks } from "@/db/schema";

export interface LearnedWordItem {
  id: string;
  native: string;
  foreign: string;
  source: "deck";
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
  const all = (await fetchDeckItems(userId)).sort((a, b) => {
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
