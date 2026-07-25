"use client";

import type { CefrLevel, Lang } from "@/app/_lib/languages";

/** Mirrors the payload of GET /api/words. */
export interface WordPair {
  conceptId: string;
  prompt: string;
  answer: string;
  level: CefrLevel;
}

export type Direction = "recognition" | "recall";

export interface FetchWordPairsOptions {
  speak: Lang;
  learning: Lang;
  direction: Direction;
  /** Always refers to the language being learned. */
  level?: CefrLevel;
  count?: number;
  signal?: AbortSignal;
}

/**
 * Fetch vocabulary for a round. Unauthenticated, so this works for anonymous
 * players mid-onboarding as well as signed-in ones.
 */
export async function fetchWordPairs({
  speak,
  learning,
  direction,
  level,
  count = 10,
  signal,
}: FetchWordPairsOptions): Promise<WordPair[]> {
  const params = new URLSearchParams({
    speak,
    learning,
    direction,
    count: String(count),
  });
  if (level) {
    params.set("level", level);
  }

  const response = await fetch(`/api/words?${params.toString()}`, { signal });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? `Failed to load words (${response.status})`);
  }

  const data = (await response.json()) as { words?: WordPair[] };
  return data.words ?? [];
}

/**
 * Build multiple-choice options for a pair, drawing wrong answers from the
 * other pairs in the same round so they're the same language and difficulty.
 */
export function buildOptions(
  pair: WordPair,
  pool: WordPair[],
  optionCount = 4,
): string[] {
  const wrong = pool
    .filter(
      (candidate) =>
        candidate.conceptId !== pair.conceptId &&
        candidate.answer.toLowerCase() !== pair.answer.toLowerCase(),
    )
    .map((candidate) => candidate.answer);

  return shuffle([...shuffle(wrong).slice(0, optionCount - 1), pair.answer]);
}

export function shuffle<T>(items: T[]): T[] {
  const cloned = [...items];
  for (let i = cloned.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }
  return cloned;
}
