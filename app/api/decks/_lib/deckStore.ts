import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { deckWords, decks } from "@/db/schema";
import {
  SEED_FOREIGN_LANGUAGES,
  TOPIC_NATIVE_LANG,
  TOPIC_SEEDS,
} from "./topicSeedData";

export type DeckKind = "topic" | "custom";

export interface DeckWordRecord {
  id: string;
  native: string;
  foreign: string;
  orderIndex: number;
}

export interface DeckRecord {
  id: string;
  ownerUserId: string | null;
  kind: DeckKind;
  topicKey: string | null;
  name: string;
  nativeLang: string;
  foreignLang: string;
  wordCount: number;
}

export interface DeckWithWords extends DeckRecord {
  words: DeckWordRecord[];
}

export interface WordInput {
  id?: string;
  native: string;
  foreign: string;
}

function toDeckRecord(
  row: typeof decks.$inferSelect,
  wordCount = 0,
): DeckRecord {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    kind: row.kind as DeckKind,
    topicKey: row.topicKey,
    name: row.name,
    nativeLang: row.nativeLang,
    foreignLang: row.foreignLang,
    wordCount,
  };
}

/** Returns a map of deckId -> word count for the given deck ids. */
async function countWordsByDeck(
  deckIds: string[],
): Promise<Map<string, number>> {
  if (deckIds.length === 0) {
    return new Map();
  }
  const rows = await db
    .select({
      deckId: deckWords.deckId,
      count: sql<number>`count(*)::int`,
    })
    .from(deckWords)
    .where(inArray(deckWords.deckId, deckIds))
    .groupBy(deckWords.deckId);

  return new Map(rows.map((row) => [row.deckId, row.count]));
}

/**
 * Creates the canonical topic decks and their words if they do not yet exist.
 * Idempotent: an existing topic deck (matched by topicKey + native/foreign
 * language pair) is
 * left untouched so re-running never duplicates words or disturbs user stats.
 */
export async function seedTopicDecks(): Promise<{
  createdDecks: number;
  createdWords: number;
}> {
  let createdDecks = 0;
  let createdWords = 0;

  for (const seed of TOPIC_SEEDS) {
    for (const foreignLang of SEED_FOREIGN_LANGUAGES) {
      const existing = await db
        .select({ id: decks.id })
        .from(decks)
        .where(
          and(
            eq(decks.topicKey, seed.topicKey),
            eq(decks.nativeLang, TOPIC_NATIVE_LANG),
            eq(decks.foreignLang, foreignLang),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        continue;
      }

      const [deck] = await db
        .insert(decks)
        .values({
          ownerUserId: null,
          kind: "topic",
          topicKey: seed.topicKey,
          name: seed.name[foreignLang],
          nativeLang: TOPIC_NATIVE_LANG,
          foreignLang,
        })
        .returning({ id: decks.id });

      createdDecks += 1;

      await db.insert(deckWords).values(
        seed.words.map((word, index) => ({
          deckId: deck.id,
          native: word.native,
          foreign: word[foreignLang],
          orderIndex: index,
        })),
      );

      createdWords += seed.words.length;
    }
  }

  return { createdDecks, createdWords };
}

async function loadWords(deckId: string): Promise<DeckWordRecord[]> {
  const rows = await db
    .select({
      id: deckWords.id,
      native: deckWords.native,
      foreign: deckWords.foreign,
      orderIndex: deckWords.orderIndex,
    })
    .from(deckWords)
    .where(eq(deckWords.deckId, deckId))
    .orderBy(asc(deckWords.orderIndex), asc(deckWords.createdAt));

  return rows;
}

/** All decks a user may practice: their own custom decks plus every topic deck. */
export async function listDecksForUser(userId: string): Promise<DeckRecord[]> {
  const rows = await db
    .select()
    .from(decks)
    .where(or(eq(decks.kind, "topic"), eq(decks.ownerUserId, userId)))
    .orderBy(desc(decks.updatedAt));

  const counts = await countWordsByDeck(rows.map((row) => row.id));
  return rows.map((row) => toDeckRecord(row, counts.get(row.id) ?? 0));
}

/** Only the user's own custom decks. */
export async function listCustomDecks(userId: string): Promise<DeckRecord[]> {
  const rows = await db
    .select()
    .from(decks)
    .where(and(eq(decks.kind, "custom"), eq(decks.ownerUserId, userId)))
    .orderBy(desc(decks.updatedAt));

  const counts = await countWordsByDeck(rows.map((row) => row.id));
  return rows.map((row) => toDeckRecord(row, counts.get(row.id) ?? 0));
}

/**
 * Fetches a single deck with its words if the user is allowed to see it
 * (a topic deck, or a custom deck they own). Returns null otherwise.
 */
export async function getDeckForUser(
  deckId: string,
  userId: string,
): Promise<DeckWithWords | null> {
  const [row] = await db
    .select()
    .from(decks)
    .where(
      and(
        eq(decks.id, deckId),
        or(eq(decks.kind, "topic"), eq(decks.ownerUserId, userId)),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  const words = await loadWords(row.id);
  return { ...toDeckRecord(row, words.length), words };
}

/**
 * Looks up a topic deck by its stable key + foreign language, optionally
 * narrowed to a native language. Omitting `nativeLang` returns whichever
 * variant exists, which keeps callers that only know the target working.
 */
export async function getTopicDeck(
  topicKey: string,
  foreignLang: string,
  nativeLang?: string,
): Promise<DeckWithWords | null> {
  const [row] = await db
    .select()
    .from(decks)
    .where(
      and(
        eq(decks.kind, "topic"),
        eq(decks.topicKey, topicKey),
        eq(decks.foreignLang, foreignLang),
        ...(nativeLang ? [eq(decks.nativeLang, nativeLang)] : []),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  const words = await loadWords(row.id);
  return { ...toDeckRecord(row, words.length), words };
}

export interface CreateDeckInput {
  name: string;
  nativeLang: string;
  foreignLang: string;
  words?: WordInput[];
}

export async function createCustomDeck(
  userId: string,
  input: CreateDeckInput,
): Promise<DeckWithWords> {
  const [deck] = await db
    .insert(decks)
    .values({
      ownerUserId: userId,
      kind: "custom",
      topicKey: null,
      name: input.name,
      nativeLang: input.nativeLang,
      foreignLang: input.foreignLang,
    })
    .returning();

  const words = input.words ?? [];
  if (words.length > 0) {
    await db.insert(deckWords).values(
      words.map((word, index) => ({
        deckId: deck.id,
        native: word.native,
        foreign: word.foreign,
        orderIndex: index,
      })),
    );
  }

  const created = await loadWords(deck.id);
  return { ...toDeckRecord(deck, created.length), words: created };
}

/** Confirms the deck exists and is a custom deck owned by the user. */
async function assertOwnedDeck(
  userId: string,
  deckId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: decks.id })
    .from(decks)
    .where(
      and(
        eq(decks.id, deckId),
        eq(decks.kind, "custom"),
        eq(decks.ownerUserId, userId),
      ),
    )
    .limit(1);

  return Boolean(row);
}

export interface UpdateDeckInput {
  name?: string;
  nativeLang?: string;
  foreignLang?: string;
}

export async function updateCustomDeck(
  userId: string,
  deckId: string,
  input: UpdateDeckInput,
): Promise<DeckWithWords | null> {
  if (!(await assertOwnedDeck(userId, deckId))) {
    return null;
  }

  await db
    .update(decks)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.nativeLang !== undefined
        ? { nativeLang: input.nativeLang }
        : {}),
      ...(input.foreignLang !== undefined
        ? { foreignLang: input.foreignLang }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(decks.id, deckId));

  return getDeckForUser(deckId, userId);
}

export async function deleteCustomDeck(
  userId: string,
  deckId: string,
): Promise<boolean> {
  if (!(await assertOwnedDeck(userId, deckId))) {
    return false;
  }

  await db.delete(decks).where(eq(decks.id, deckId));
  return true;
}

/**
 * Syncs a custom deck's word list against what's stored (used by the
 * editor's Save). Words matched by id with unchanged text keep their row
 * (and therefore their `user_word_stats` progress) untouched; words that no
 * longer appear are deleted; new words are inserted. A word whose id matches
 * but whose text changed is treated as removed-then-reinserted, so editing a
 * word intentionally resets its practice stats via the FK cascade.
 */
export async function syncDeckWords(
  userId: string,
  deckId: string,
  words: WordInput[],
): Promise<DeckWithWords | null> {
  if (!(await assertOwnedDeck(userId, deckId))) {
    return null;
  }

  const existing = await db
    .select({
      id: deckWords.id,
      native: deckWords.native,
      foreign: deckWords.foreign,
    })
    .from(deckWords)
    .where(eq(deckWords.deckId, deckId));

  const existingById = new Map(existing.map((row) => [row.id, row]));

  const unchangedIds = new Set<string>();
  const orderUpdates: { id: string; orderIndex: number }[] = [];
  const toInsert: {
    deckId: string;
    native: string;
    foreign: string;
    orderIndex: number;
  }[] = [];

  words.forEach((word, index) => {
    const native = word.native.trim();
    const foreign = word.foreign.trim();
    const match = word.id ? existingById.get(word.id) : undefined;

    if (match && match.native === native && match.foreign === foreign) {
      unchangedIds.add(match.id);
      orderUpdates.push({ id: match.id, orderIndex: index });
    } else {
      toInsert.push({ deckId, native, foreign, orderIndex: index });
    }
  });

  // Rows not carried over unchanged: either edited (replaced below with a
  // fresh row) or actually removed. Either way the old row—and its cascaded
  // stats—goes away.
  const idsToDelete = existing
    .map((row) => row.id)
    .filter((id) => !unchangedIds.has(id));

  if (idsToDelete.length > 0) {
    await db.delete(deckWords).where(inArray(deckWords.id, idsToDelete));
  }

  if (toInsert.length > 0) {
    await db.insert(deckWords).values(toInsert);
  }

  for (const update of orderUpdates) {
    await db
      .update(deckWords)
      .set({ orderIndex: update.orderIndex })
      .where(eq(deckWords.id, update.id));
  }

  await db
    .update(decks)
    .set({ updatedAt: new Date() })
    .where(eq(decks.id, deckId));

  return getDeckForUser(deckId, userId);
}

/** Marks a custom deck as just practiced (bumps updatedAt). */
export async function touchDeck(
  userId: string,
  deckId: string,
): Promise<void> {
  await db
    .update(decks)
    .set({ updatedAt: new Date() })
    .where(and(eq(decks.id, deckId), eq(decks.ownerUserId, userId)));
}
