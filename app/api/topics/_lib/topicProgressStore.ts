import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  deckWords,
  decks,
  userDeckWordClears,
  userTopicProgress,
} from "@/db/schema";
import {
  createDefaultTopicProgress,
  DEFAULT_UNLOCKED,
  normalizeState,
  TOPIC_IDS,
  TOPIC_LEVEL_COUNT,
  type TopicProgress,
  type TopicsState,
} from "@/app/topics/_lib/topicsModel";

/**
 * The account's copy of the topic ladder.
 *
 * Rows are per (user, language, topic); the client works in one `TopicsState`
 * object, so this reads rows into that shape and writes it back out.
 *
 * What the browser is allowed to assert is deliberately narrow. Cleared levels
 * and finished packs are **derived** from `user_deck_word_clears` — what the
 * player actually answered inside the pack — because a state object sent by a
 * browser can say anything, and a pack marked finished by hand would mint a key. The crown is set only by
 * `awardLegendary`, off a graded round. That leaves the browser owning two
 * harmless things: which packs it spent keys on, and whether the key popup has
 * been seen.
 */

function rowToProgress(row: typeof userTopicProgress.$inferSelect): TopicProgress {
  return {
    completedLevels: [...row.completedLevels]
      .filter((level) => level >= 1 && level <= TOPIC_LEVEL_COUNT)
      .sort((a, b) => a - b),
    isCompleted: row.isCompleted,
    isLegendary: row.isLegendary,
    keyCelebrated: row.keyCelebrated,
  };
}

/**
 * Which levels of each topic pack the player has cleared inside the pack.
 *
 * A level is cleared when every word in its slice has been answered right at
 * least once *in that deck* — `isLevelCleared` on the client, `buildSummary` on
 * the deck side, the same bar. Knowing a word from somewhere else counts toward
 * mastery but not toward the ladder, so keys stay earned. One query covers all
 * five packs: the alternative is five deck reads plus five stat reads per sync.
 *
 * Returns an empty map when the packs for this language were never seeded, so a
 * missing deck can only fail to *add* progress, never take any away.
 */
async function deriveClearedLevels(
  userId: string,
  foreignLang: string,
): Promise<Map<string, number[]>> {
  const rows = await db
    .select({
      topicKey: decks.topicKey,
      wordId: deckWords.id,
      orderIndex: deckWords.orderIndex,
      timesCorrect: userDeckWordClears.timesCorrect,
    })
    .from(decks)
    .innerJoin(deckWords, eq(deckWords.deckId, decks.id))
    // Deck-scoped on purpose. Mastery is shared across decks and games, but a
    // pack level is only cleared by answering its words *in the pack* — else
    // playing from the games hub would hand out keys for packs never opened.
    .leftJoin(
      userDeckWordClears,
      and(
        eq(userDeckWordClears.deckWordId, deckWords.id),
        eq(userDeckWordClears.userId, userId),
      ),
    )
    .where(
      and(
        eq(decks.kind, "topic"),
        eq(decks.foreignLang, foreignLang),
        inArray(decks.topicKey, TOPIC_IDS),
      ),
    )
    .orderBy(asc(decks.topicKey), asc(deckWords.orderIndex), asc(deckWords.id));

  const byTopic = new Map<string, { cleared: boolean }[]>();
  for (const row of rows) {
    if (!row.topicKey) {
      continue;
    }
    const words = byTopic.get(row.topicKey) ?? [];
    words.push({ cleared: (row.timesCorrect ?? 0) > 0 });
    byTopic.set(row.topicKey, words);
  }

  const cleared = new Map<string, number[]>();
  for (const [topicKey, words] of byTopic) {
    if (words.length === 0) {
      continue;
    }

    // Mirrors `levelWindow`: consecutive slices of the deck in seed order.
    const size = Math.ceil(words.length / TOPIC_LEVEL_COUNT);
    const levels: number[] = [];

    for (let level = 1; level <= TOPIC_LEVEL_COUNT; level += 1) {
      const window = words.slice((level - 1) * size, level * size);
      if (window.length > 0 && window.every((word) => word.cleared)) {
        levels.push(level);
      }
    }

    cleared.set(topicKey, levels);
  }

  return cleared;
}

/** A read of the ladder, in both the shapes the callers need. */
interface TopicsRead {
  /** Stored rows plus the levels the word stats show as cleared. */
  state: TopicsState;
  /**
   * Only what the rows themselves say.
   *
   * Writes diff against this rather than against `state`: cleared levels are
   * derived on every read, so a state that has already had them folded in
   * compares equal to itself and the row never catches up. This is the baseline
   * that makes `completed_levels` follow the stats instead of drifting.
   */
  rows: TopicsState;
}

/**
 * The ladder as the account knows it. Pass the language being learned to fold in
 * levels the word stats show as cleared; without it the stored rows stand alone
 * (a push from a game round, say, which only knows the UI language).
 */
export async function readTopicsState(
  userId: string,
  language: string,
  foreignLang?: string | null,
): Promise<TopicsState> {
  return (await readTopics(userId, language, foreignLang)).state;
}

async function readTopics(
  userId: string,
  language: string,
  foreignLang?: string | null,
): Promise<TopicsRead> {
  const [rows, derived] = await Promise.all([
    db
      .select()
      .from(userTopicProgress)
      .where(
        and(
          eq(userTopicProgress.userId, userId),
          eq(userTopicProgress.language, language),
        ),
      ),
    foreignLang
      ? deriveClearedLevels(userId, foreignLang)
      : Promise.resolve(new Map<string, number[]>()),
  ]);

  const rowProgress: Record<string, TopicProgress> = {};
  const topicProgress: Record<string, TopicProgress> = {};
  const unlockedTopicIds = [...DEFAULT_UNLOCKED];

  for (const row of rows) {
    if (!TOPIC_IDS.includes(row.topicId)) {
      continue;
    }
    rowProgress[row.topicId] = rowToProgress(row);
    if (row.unlocked && !unlockedTopicIds.includes(row.topicId)) {
      unlockedTopicIds.push(row.topicId);
    }
  }

  for (const topicId of TOPIC_IDS) {
    const stored = rowProgress[topicId] ?? createDefaultTopicProgress();
    // Union rather than replacement: levels recorded before the word counts
    // existed stay recorded, because dropping them would revoke a key already
    // spent on an unlock.
    const completedLevels = Array.from(
      new Set([...stored.completedLevels, ...(derived.get(topicId) ?? [])]),
    ).sort((a, b) => a - b);

    rowProgress[topicId] = stored;
    topicProgress[topicId] = {
      ...stored,
      completedLevels,
      isCompleted: completedLevels.length === TOPIC_LEVEL_COUNT,
    };
  }

  return {
    state: normalizeState({ unlockedTopicIds, keys: 0, topicProgress }),
    rows: normalizeState({
      unlockedTopicIds,
      keys: 0,
      topicProgress: rowProgress,
    }),
  };
}

/**
 * Folds what a browser reports into the account's ladder and hands back the
 * result — which is both how a device saves and how it catches up.
 *
 * Only the two browser-owned fields are taken from `incoming`; everything else
 * comes from the stats or from a graded round.
 */
export async function mergeTopicsStateForUser(
  userId: string,
  language: string,
  incoming: TopicsState,
  foreignLang?: string | null,
): Promise<TopicsState> {
  const { state: stored, rows } = await readTopics(userId, language, foreignLang);

  const topicProgress = TOPIC_IDS.reduce<Record<string, TopicProgress>>(
    (acc, topicId) => {
      const base = stored.topicProgress[topicId] ?? createDefaultTopicProgress();
      const claimed =
        incoming.topicProgress[topicId] ?? createDefaultTopicProgress();

      acc[topicId] = {
        ...base,
        // Purely cosmetic — whether the key popup has been shown — so the
        // browser is the only thing that knows it.
        keyCelebrated: base.keyCelebrated || claimed.keyCelebrated,
      };

      return acc;
    },
    {},
  );

  const merged = affordableUnlocks(
    stored,
    normalizeState({
      unlockedTopicIds: TOPIC_IDS.filter(
        (id) =>
          stored.unlockedTopicIds.includes(id) ||
          incoming.unlockedTopicIds.includes(id),
      ),
      keys: 0,
      topicProgress,
    }),
  );

  await writeChangedRows(userId, language, rows, merged);
  return merged;
}

/**
 * Crowns a pack. The only way `is_legendary` is ever set — and it only ever goes
 * up, so a crown taken away by hand in the database stays away until another
 * round earns it back.
 */
export async function awardLegendary(
  userId: string,
  language: string,
  topicId: string,
  foreignLang?: string | null,
): Promise<TopicsState> {
  const { state: stored, rows } = await readTopics(userId, language, foreignLang);
  const progress = stored.topicProgress[topicId];

  if (!progress || progress.isLegendary) {
    return stored;
  }

  const merged: TopicsState = {
    ...stored,
    topicProgress: {
      ...stored.topicProgress,
      [topicId]: { ...progress, isLegendary: true },
    },
  };

  await writeChangedRows(userId, language, rows, merged);
  return merged;
}

/**
 * Writes only the packs that actually moved.
 *
 * `before` must be the rows as they stand in the table — not the derived state —
 * so that levels the word stats have cleared since the last write are seen as a
 * change and land in `completed_levels`. The column stays a mirror of the
 * derivation rather than the source of it: nothing reads it back as authority,
 * so a row that somehow goes wrong is repaired by the next sync.
 */
async function writeChangedRows(
  userId: string,
  language: string,
  before: TopicsState,
  after: TopicsState,
): Promise<void> {
  const changed = TOPIC_IDS.filter((topicId) => {
    const was = before.topicProgress[topicId] ?? createDefaultTopicProgress();
    const now = after.topicProgress[topicId] ?? createDefaultTopicProgress();

    return (
      before.unlockedTopicIds.includes(topicId) !==
        after.unlockedTopicIds.includes(topicId) ||
      was.isCompleted !== now.isCompleted ||
      was.isLegendary !== now.isLegendary ||
      was.keyCelebrated !== now.keyCelebrated ||
      was.completedLevels.join(",") !== now.completedLevels.join(",")
    );
  });

  if (changed.length === 0) {
    return;
  }

  const now = new Date();
  await db
    .insert(userTopicProgress)
    .values(
      changed.map((topicId) => {
        const progress =
          after.topicProgress[topicId] ?? createDefaultTopicProgress();

        return {
          userId,
          language,
          topicId,
          completedLevels: progress.completedLevels,
          unlocked: after.unlockedTopicIds.includes(topicId),
          isCompleted: progress.isCompleted,
          isLegendary: progress.isLegendary,
          keyCelebrated: progress.keyCelebrated,
          updatedAt: now,
        };
      }),
    )
    .onConflictDoUpdate({
      target: [
        userTopicProgress.userId,
        userTopicProgress.language,
        userTopicProgress.topicId,
      ],
      set: {
        completedLevels: sqlExcluded("completed_levels"),
        unlocked: sqlExcluded("unlocked"),
        isCompleted: sqlExcluded("is_completed"),
        isLegendary: sqlExcluded("is_legendary"),
        keyCelebrated: sqlExcluded("key_celebrated"),
        updatedAt: now,
      },
    });
}

/**
 * Drops any pack the incoming state claims to have unlocked but has no key for.
 *
 * Unlocking is the one thing a browser genuinely decides — a key is *spent*, and
 * nothing in the word stats records that it was. Packs the account already had
 * are never revoked; only newly claimed ones have to be paid for.
 */
function affordableUnlocks(
  stored: TopicsState,
  merged: TopicsState,
): TopicsState {
  const earned = TOPIC_IDS.filter(
    (id) => merged.topicProgress[id]?.isCompleted,
  ).length;
  const paid = merged.unlockedTopicIds.filter(
    (id) => !DEFAULT_UNLOCKED.includes(id),
  );

  if (paid.length <= earned) {
    return merged;
  }

  const kept = paid.filter((id) => stored.unlockedTopicIds.includes(id));
  const added = paid.filter((id) => !stored.unlockedTopicIds.includes(id));
  const allowed = [
    ...kept,
    ...added.slice(0, Math.max(earned - kept.length, 0)),
  ];

  return normalizeState({
    ...merged,
    unlockedTopicIds: [...DEFAULT_UNLOCKED, ...allowed],
  });
}

/**
 * The value this statement is trying to insert, for the update half of an
 * upsert. Safe against a concurrent write from another device: the row being
 * written is already the merge of what was read and what arrived.
 */
function sqlExcluded(column: string) {
  return sql.raw(`excluded.${column}`);
}
