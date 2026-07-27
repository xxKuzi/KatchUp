import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { CefrLevel, Lang } from "@/app/_lib/languages";
import {
  dedupeByAnswer,
  resolveDirection,
  type Direction,
  type WordPair,
} from "./wordPool";

/**
 * Word selection for a signed-in player.
 *
 * The plain pool draws at random inside one CEFR level, so a word you mastered
 * yesterday is as likely as one you have never met, and two rounds in a row
 * share words only by luck. This builds a round out of three buckets instead:
 *
 *   carry-over  words from your last session you have not mastered — so a round
 *               visibly continues the one before it rather than starting over
 *   review      words whose Leitner box says they are about to be forgotten
 *   new         words you have never seen
 *
 * A bucket that cannot fill its share passes the slack to the next, so a round
 * is always the length that was asked for.
 */

/** Words carried over from the last session, at most. */
const CARRY_OVER = 5;
/** Share of the round given to words due for review. */
const REVIEW_SHARE = 0.3;
/** How recently a word must have been seen to count as "last session". */
const CARRY_OVER_WINDOW = "24 hours";

/**
 * How long a word rests before it is worth asking again, by Leitner box.
 *
 * A word only becomes `known` at streak 3, which puts it at box 3 or higher —
 * so mastering something buries it for a week, and mastering it thoroughly for
 * a month. That is the "stop showing me what I already learned" half. It never
 * disappears for good, which is the other half.
 */
const BOX_INTERVALS = [
  "0 days", // 0 — never answered right, or just got it wrong
  "1 day", // 1
  "3 days", // 2
  "7 days", // 3 — first box that counts as known
  "14 days", // 4
  "30 days", // 5 — fully mastered
];

export interface PersonalPoolOptions {
  userId: string;
  speak: Lang;
  learning: Lang;
  direction: Direction;
  level?: CefrLevel;
  count: number;
}

/**
 * One statement, three buckets.
 *
 * Deliberately not three queries: on Neon's HTTP driver each one is a separate
 * request, and the network round trip costs roughly ten times the query itself.
 * Deliberately not one `ORDER BY priority` either — that returns an all-review
 * or an all-new round depending on the day, which is the behaviour being
 * replaced. The quotas are the feature.
 */
export async function getPersonalWordPairs({
  userId,
  speak,
  learning,
  direction,
  level,
  count,
}: PersonalPoolOptions): Promise<WordPair[]> {
  if (speak === learning || count <= 0) {
    return [];
  }

  const { promptLang, answerLang } = resolveDirection(speak, learning, direction);
  const reviewQuota = Math.max(1, Math.round(count * REVIEW_SHARE));
  // Over-fetch: the same-answer filter and the bucket overlap both drop rows,
  // and it is the same round trip either way.
  const newQuota = count * 3;

  const boxInterval = sql.raw(
    BOX_INTERVALS.map(
      (interval, box) => `when ${box} then interval '${interval}'`,
    ).join(" "),
  );

  interface PoolRow extends Record<string, unknown> {
    concept_id: string;
    prompt: string;
    answer: string;
    level: CefrLevel;
    bucket: string;
  }

  const result = await db.execute<PoolRow>(sql`
    with pairs as (
      select
        learn_side.concept_id,
        prompt_side.text as prompt,
        answer_side.text as answer,
        learn_side.level as level
      from concept_translations learn_side
      join concept_translations prompt_side
        on prompt_side.concept_id = learn_side.concept_id
       and prompt_side.lang = ${promptLang}
      join concept_translations answer_side
        on answer_side.concept_id = learn_side.concept_id
       and answer_side.lang = ${answerLang}
      where learn_side.lang = ${learning}
        ${level ? sql`and learn_side.level = ${level}` : sql``}
    ),
    stats as (
      select concept_id, box, known, last_seen_at, streak, times_wrong
      from user_word_stats
      where user_id = ${userId}
        and foreign_lang = ${learning}
        and concept_id is not null
    ),
    -- Words the player already knows, by their *answer text*. Once "groß" is
    -- mastered as "big", being taught it again as "large" is not new material.
    known_answers as (
      select distinct lower(p.answer) as answer
      from stats s join pairs p on p.concept_id = s.concept_id
      where s.known
    )
    (
      select p.*, 'carry' as bucket
      from pairs p join stats s on s.concept_id = p.concept_id
      where not s.known
        and s.last_seen_at is not null
        and s.last_seen_at >= now() - interval '${sql.raw(CARRY_OVER_WINDOW)}'
      order by s.last_seen_at desc
      limit ${CARRY_OVER}
    )
    union all
    (
      select p.*, 'review' as bucket
      from pairs p join stats s on s.concept_id = p.concept_id
      where s.last_seen_at is null
         or s.last_seen_at <= now() - (case s.box ${boxInterval} else interval '30 days' end)
      -- Weakest first: most wrong answers, then longest unseen.
      order by s.times_wrong - s.streak desc, s.last_seen_at asc nulls first
      limit ${reviewQuota}
    )
    union all
    (
      select p.*, 'new' as bucket
      from pairs p
      where not exists (select 1 from stats s where s.concept_id = p.concept_id)
        and lower(p.answer) not in (select answer from known_answers)
      order by random()
      limit ${newQuota}
    )
  `);

  // The Neon HTTP driver returns a result object on some paths and a bare array
  // on others, so normalise before touching it.
  const rows: PoolRow[] = Array.isArray(result)
    ? (result as PoolRow[])
    : ((result as { rows?: PoolRow[] }).rows ?? []);

  const byBucket = (name: string) =>
    rows
      .filter((row) => row.bucket === name)
      .map(
        (row): WordPair => ({
          conceptId: row.concept_id,
          prompt: row.prompt,
          answer: row.answer,
          level: row.level,
        }),
      );

  // Carry-over first so it is never squeezed out — it is the continuity the
  // round is built around — then review, then new fills whatever is left.
  const ordered = [
    ...byBucket("carry"),
    ...byBucket("review"),
    ...byBucket("new"),
  ];

  const seen = new Set<string>();
  const unique = ordered.filter((pair) => {
    if (seen.has(pair.conceptId)) {
      return false;
    }
    seen.add(pair.conceptId);
    return true;
  });

  return dedupeByAnswer(unique).slice(0, count);
}
