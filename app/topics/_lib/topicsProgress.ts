"use client";

import { Language } from "@/app/_lib/translations";

export type GameMode = "flip-cards" | "one-of-three";

export interface TopicDefinition {
  id: string;
  icon: string;
  color: "yellow" | "red" | "blue" | "green";
  names: Record<Language, string>;
  descriptions: Record<Language, string>;
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
    icon: "AUTO",
    color: "yellow",
    names: {
      english: "Cars",
      czech: "Auta",
      deutsch: "Autos",
    },
    descriptions: {
      english: "Road words and driving basics",
      czech: "Silnicni slova a zaklady rizeni",
      deutsch: "Worter fur Strasse und Fahren",
    },
  },
  {
    id: "essen",
    icon: "FOOD",
    color: "red",
    names: {
      english: "Food",
      czech: "Jidlo",
      deutsch: "Essen",
    },
    descriptions: {
      english: "Meals, drinks and table talk",
      czech: "Jidla, napoje a konverzace u stolu",
      deutsch: "Mahlzeiten, Getranke und Tischgesprache",
    },
  },
  {
    id: "obst-gemuese",
    icon: "FRUIT",
    color: "green",
    names: {
      english: "Fruits & Vegetables",
      czech: "Ovoce a zelenina",
      deutsch: "Obst & Gemuse",
    },
    descriptions: {
      english: "Fresh words from market life",
      czech: "Cerstva slovni zasoba z trhu",
      deutsch: "Frische Worter aus dem Marktalltag",
    },
  },
  {
    id: "reisen",
    icon: "TRAVEL",
    color: "blue",
    names: {
      english: "Travel",
      czech: "Cestovani",
      deutsch: "Reisen",
    },
    descriptions: {
      english: "Transport, hotel and booking vocab",
      czech: "Doprava, hotel a rezervace",
      deutsch: "Verkehr, Hotel und Buchungswortschatz",
    },
  },
  {
    id: "alltag",
    icon: "DAILY",
    color: "yellow",
    names: {
      english: "Daily Life",
      czech: "Kazdy den",
      deutsch: "Alltag",
    },
    descriptions: {
      english: "Routines and useful everyday phrases",
      czech: "Rutina a uzitecne kazdodenni fraze",
      deutsch: "Routine und nutzliche Alltagsphrasen",
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
    topicProgress: TOPIC_IDS.reduce<Record<string, TopicProgress>>((acc, id) => {
      acc[id] = createDefaultTopicProgress();
      return acc;
    }, {}),
  };
}

function getStorageKey(language: Language): string {
  return `${STORAGE_KEY}-${language}`;
}

function normalizeState(raw: unknown): TopicsState {
  const safe = (raw ?? {}) as Partial<TopicsState>;
  const base = createDefaultState();

  const unlocked = Array.isArray(safe.unlockedTopicIds)
    ? safe.unlockedTopicIds.filter((id): id is string => TOPIC_IDS.includes(String(id)))
    : base.unlockedTopicIds;

  const progressMap = TOPIC_IDS.reduce<Record<string, TopicProgress>>((acc, topicId) => {
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
  }, {});

  return {
    unlockedTopicIds: unlocked.length > 0 ? unlocked : base.unlockedTopicIds,
    keys: typeof safe.keys === "number" && safe.keys >= 0 ? Math.floor(safe.keys) : 0,
    topicProgress: progressMap,
  };
}

export function loadTopicsState(language: Language): TopicsState {
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

export function saveTopicsState(language: Language, state: TopicsState): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getStorageKey(language), JSON.stringify(state));
}

export function getLevelsForTopic(state: TopicsState, topicId: string): TopicLevel[] {
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

  const completedLevels = [...progress.completedLevels, level].sort((a, b) => a - b);
  const topicJustCompleted = completedLevels.length === 5 && !progress.isCompleted;

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
