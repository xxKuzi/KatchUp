"use client";

import { useSyncExternalStore } from "react";
import type { Lang } from "@/app/_lib/languages";

export type GameMode = "flip-cards" | "one-of-three";

export interface TopicDefinition {
  id: string;
  color: "yellow" | "red" | "blue" | "green";
  // Keyed by Lang so a topic can be shown in the language being learned, not
  // just in the three languages the UI happens to be translated into.
  names: Record<Lang, string>;
  descriptions: Record<Lang, string>;
}

export interface TopicLevel {
  level: number;
  mode: GameMode;
  completed: boolean;
}

export interface TopicProgress {
  completedLevels: number[];
  isCompleted: boolean;
  isAscended: boolean;
}

export interface TopicsState {
  unlockedTopicIds: string[];
  keys: number;
  topicProgress: Record<string, TopicProgress>;
}

const STORAGE_KEY = "katchup-topics-state-v1";

export const TOPICS: TopicDefinition[] = [
  {
    id: "autos",
    color: "yellow",
    names: {
      en: "Cars",
      cs: "Auta",
      de: "Autos",
      es: "Coches",
    },
    descriptions: {
      en: "Road words and driving basics",
      cs: "Silnicni slova a zaklady rizeni",
      de: "Worter fur Strasse und Fahren",
      es: "Palabras de carretera y conduccion basica",
    },
  },
  {
    id: "essen",
    color: "red",
    names: {
      en: "Food",
      cs: "Jidlo",
      de: "Essen",
      es: "Comida",
    },
    descriptions: {
      en: "Meals, drinks and table talk",
      cs: "Jidla, napoje a konverzace u stolu",
      de: "Mahlzeiten, Getranke und Tischgesprache",
      es: "Comidas, bebidas y conversacion en la mesa",
    },
  },
  {
    id: "obst-gemuese",
    color: "green",
    names: {
      en: "Fruits & Vegetables",
      cs: "Ovoce a zelenina",
      de: "Obst & Gemuse",
      es: "Frutas y verduras",
    },
    descriptions: {
      en: "Fresh words from market life",
      cs: "Cerstva slovni zasoba z trhu",
      de: "Frische Worter aus dem Marktalltag",
      es: "Vocabulario fresco del mercado",
    },
  },
  {
    id: "reisen",
    color: "blue",
    names: {
      en: "Travel",
      cs: "Cestovani",
      de: "Reisen",
      es: "Viajes",
    },
    descriptions: {
      en: "Transport, hotel and booking vocab",
      cs: "Doprava, hotel a rezervace",
      de: "Verkehr, Hotel und Buchungswortschatz",
      es: "Transporte, hotel y reservas",
    },
  },
  {
    id: "alltag",
    color: "yellow",
    names: {
      en: "Daily Life",
      cs: "Kazdy den",
      de: "Alltag",
      es: "Vida diaria",
    },
    descriptions: {
      en: "Routines and useful everyday phrases",
      cs: "Rutina a uzitecne kazdodenni fraze",
      de: "Routine und nutzliche Alltagsphrasen",
      es: "Rutinas y frases utiles del dia a dia",
    },
  },
];

const TOPIC_IDS = TOPICS.map((topic) => topic.id);

const DEFAULT_UNLOCKED = TOPIC_IDS.slice(0, 3);

const GAME_MODES: GameMode[] = ["flip-cards", "one-of-three"];

function getDeterministicMode(topicId: string, level: number): GameMode {
  const source = `${topicId}-${level}`;
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }

  return GAME_MODES[hash % GAME_MODES.length];
}

function createDefaultTopicProgress(): TopicProgress {
  return {
    completedLevels: [],
    isCompleted: false,
    isAscended: false,
  };
}

function createDefaultState(): TopicsState {
  return {
    unlockedTopicIds: DEFAULT_UNLOCKED,
    keys: 0,
    topicProgress: TOPIC_IDS.reduce<Record<string, TopicProgress>>(
      (acc, id) => {
        acc[id] = createDefaultTopicProgress();
        return acc;
      },
      {},
    ),
  };
}

function getStorageKey(language: Lang): string {
  return `${STORAGE_KEY}-${language}`;
}

function normalizeState(raw: unknown): TopicsState {
  const safe = (raw ?? {}) as Partial<TopicsState>;
  const base = createDefaultState();

  const unlocked = Array.isArray(safe.unlockedTopicIds)
    ? safe.unlockedTopicIds.filter((id): id is string =>
        TOPIC_IDS.includes(String(id)),
      )
    : base.unlockedTopicIds;

  const progressMap = TOPIC_IDS.reduce<Record<string, TopicProgress>>(
    (acc, topicId) => {
      const existing = safe.topicProgress?.[topicId];
      const completedLevels = Array.isArray(existing?.completedLevels)
        ? existing.completedLevels
            .filter((value): value is number => typeof value === "number")
            .filter((value) => value >= 1 && value <= 5)
        : [];

      acc[topicId] = {
        completedLevels,
        isCompleted: Boolean(existing?.isCompleted),
        isAscended: Boolean(existing?.isAscended),
      };

      return acc;
    },
    {},
  );

  return {
    unlockedTopicIds: unlocked.length > 0 ? unlocked : base.unlockedTopicIds,
    keys:
      typeof safe.keys === "number" && safe.keys >= 0
        ? Math.floor(safe.keys)
        : 0,
    topicProgress: progressMap,
  };
}

export function loadTopicsState(language: Lang): TopicsState {
  if (typeof window === "undefined") {
    return createDefaultState();
  }

  const raw = window.localStorage.getItem(getStorageKey(language));

  if (!raw) {
    const initial = createDefaultState();
    saveTopicsState(language, initial);
    return initial;
  }

  try {
    return normalizeState(JSON.parse(raw) as unknown);
  } catch {
    const initial = createDefaultState();
    saveTopicsState(language, initial);
    return initial;
  }
}

export function saveTopicsState(language: Lang, state: TopicsState): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getStorageKey(language), JSON.stringify(state));
  listeners.forEach((listener) => listener());
}

// --- Reading the state during render -----------------------------------------
//
// Progress lives in localStorage, which the server can't see, so reading it
// straight into render made the server send `keys: 0` while the client rendered
// the real number — a hydration mismatch. useSyncExternalStore is the supported
// way out: React renders the server snapshot (defaults) through hydration, then
// swaps in the stored one, and `saveTopicsState` notifies every subscriber so
// two topic views never drift apart.

const listeners = new Set<() => void>();

/** The parsed state, memoised per raw string so the snapshot is referentially
 * stable — returning a fresh object each read would loop forever. */
let snapshotCache: { key: string; raw: string | null; value: TopicsState } | null =
  null;

const SERVER_SNAPSHOT = createDefaultState();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab writing the same key counts as a change too.
  window.addEventListener("storage", listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getSnapshot(language: Lang): TopicsState {
  const key = getStorageKey(language);
  const raw = window.localStorage.getItem(key);

  if (snapshotCache && snapshotCache.key === key && snapshotCache.raw === raw) {
    return snapshotCache.value;
  }

  let value: TopicsState;
  try {
    value = raw ? normalizeState(JSON.parse(raw) as unknown) : createDefaultState();
  } catch {
    value = createDefaultState();
  }

  snapshotCache = { key, raw, value };
  return value;
}

/** Topic progress for `language`, kept in sync with every write to it. */
export function useTopicsState(language: Lang): TopicsState {
  return useSyncExternalStore(
    subscribe,
    () => getSnapshot(language),
    () => SERVER_SNAPSHOT,
  );
}

/**
 * True once the client has taken over.
 *
 * For the handful of bits that can only be known in the browser (a query param
 * read at mount, say) — render them behind this so the hydration pass still
 * matches the server.
 */
export function useHasMounted(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

function subscribeNever(): () => void {
  return () => {};
}

export function getLevelsForTopic(
  state: TopicsState,
  topicId: string,
): TopicLevel[] {
  const progress = state.topicProgress[topicId] ?? createDefaultTopicProgress();

  return Array.from({ length: 5 }, (_, index) => {
    const level = index + 1;

    return {
      level,
      mode: getDeterministicMode(topicId, level),
      completed: progress.completedLevels.includes(level),
    };
  });
}

export function completeTopicLevel(
  state: TopicsState,
  topicId: string,
  level: number,
): { nextState: TopicsState; topicJustCompleted: boolean } {
  if (!TOPIC_IDS.includes(topicId) || level < 1 || level > 5) {
    return { nextState: state, topicJustCompleted: false };
  }

  const progress = state.topicProgress[topicId] ?? createDefaultTopicProgress();
  if (progress.completedLevels.includes(level)) {
    return { nextState: state, topicJustCompleted: false };
  }

  const completedLevels = [...progress.completedLevels, level].sort(
    (a, b) => a - b,
  );
  const topicJustCompleted =
    completedLevels.length === 5 && !progress.isCompleted;

  const nextState: TopicsState = {
    ...state,
    keys: topicJustCompleted ? state.keys + 1 : state.keys,
    topicProgress: {
      ...state.topicProgress,
      [topicId]: {
        ...progress,
        completedLevels,
        isCompleted: completedLevels.length === 5,
      },
    },
  };

  return { nextState, topicJustCompleted };
}

export function unlockTopic(state: TopicsState, topicId: string): TopicsState {
  if (!TOPIC_IDS.includes(topicId)) {
    return state;
  }

  if (state.unlockedTopicIds.includes(topicId) || state.keys < 1) {
    return state;
  }

  return {
    ...state,
    keys: state.keys - 1,
    unlockedTopicIds: [...state.unlockedTopicIds, topicId],
  };
}

export function ascendTopic(state: TopicsState, topicId: string): TopicsState {
  const progress = state.topicProgress[topicId];

  if (!progress || !progress.isCompleted || progress.isAscended) {
    return state;
  }

  return {
    ...state,
    topicProgress: {
      ...state.topicProgress,
      [topicId]: {
        ...progress,
        isAscended: true,
      },
    },
  };
}

export function topicName(topic: TopicDefinition, lang: Lang): string {
  return topic.names[lang] ?? topic.names.en;
}

export interface TopicTitle {
  /** The topic in the language being learned — what the pack teaches. */
  learning: string;
  /** The same topic in the user's own language, or null when it reads the same. */
  native: string | null;
}

/**
 * A topic headline: the word you're learning first, your own language second.
 *
 * Showing only the UI language meant a Czech speaker learning German never saw
 * "Autos" anywhere, which is the word the pack is actually about.
 */
export function topicTitle(
  topic: TopicDefinition,
  learningLang: Lang,
  nativeLang: Lang,
): TopicTitle {
  const learning = topicName(topic, learningLang);
  const native = topicName(topic, nativeLang);

  return { learning, native: native === learning ? null : native };
}

export function topicDescription(topic: TopicDefinition, lang: Lang): string {
  return topic.descriptions[lang] ?? topic.descriptions.en;
}
