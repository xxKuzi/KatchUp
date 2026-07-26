import type {
  DeckProgressSummary,
  SessionWord,
  WordStatSummary,
} from "./deckSessionClient";

/** A word counts as met once it has been answered right at least once. */
export function isWordCleared(stat: WordStatSummary | null): boolean {
  return Boolean(stat?.known) || (stat?.timesCorrect ?? 0) > 0;
}

/**
 * Whether the round that just ended finished its topic level, worked out from
 * the session snapshot plus the words that were got right in it.
 *
 * The bar is the one the topic page's "Done" badge uses (`isLevelCleared` in
 * topics/[topicId]/page.tsx): every word in the level met at least once. The
 * summary that comes with a session is scoped to the level and taken at the
 * round's start, so adding this round's newly met words to it is enough — and
 * beats asking the server, which answers a network round trip later and may not
 * have the round's last answers written yet.
 */
export function predictLevelCleared(
  summary: DeckProgressSummary,
  words: SessionWord[],
  correctWordIds: Set<string>,
): boolean {
  if (summary.total === 0) {
    return false;
  }

  const newlyCleared = words.filter(
    (word) => correctWordIds.has(word.id) && !isWordCleared(word.stat),
  ).length;

  return summary.cleared + newlyCleared >= summary.total;
}
