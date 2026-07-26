import type { Lang } from "@/app/_lib/languages";

/**
 * The topic ladder itself: what the packs are, and every rule for moving through
 * them. No React and no storage — the browser store (`topicsProgress`) and the
 * API route that persists it to Postgres both run on this, so a pack unlocked on
 * a phone means the same thing as one unlocked on a laptop.
 */

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
  /** Earned by scoring 85% on the review round over the whole pack. */
  isLegendary: boolean;
  /** True once the key the pack earned has been shown to the player. */
  keyCelebrated: boolean;
}

export interface TopicsState {
  unlockedTopicIds: string[];
  keys: number;
  topicProgress: Record<string, TopicProgress>;
}

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

export const TOPIC_IDS = TOPICS.map((topic) => topic.id);

export const DEFAULT_UNLOCKED = TOPIC_IDS.slice(0, 3);

/** Levels a topic is split into. Mirrors TOPIC_LEVEL_COUNT on the server. */
export const TOPIC_LEVEL_COUNT = 5;

const GAME_MODES: GameMode[] = ["flip-cards", "one-of-three"];

function getDeterministicMode(topicId: string, level: number): GameMode {
  const source = `${topicId}-${level}`;
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }

  return GAME_MODES[hash % GAME_MODES.length];
}

export function createDefaultTopicProgress(): TopicProgress {
  return {
    completedLevels: [],
    isCompleted: false,
    isLegendary: false,
    keyCelebrated: false,
  };
}

export function createDefaultState(): TopicsState {
  return {
    unlockedTopicIds: DEFAULT_UNLOCKED,
    keys: 0,
    topicProgress: TOPIC_IDS.reduce<Record<string, TopicProgress>>((acc, id) => {
      acc[id] = createDefaultTopicProgress();
      return acc;
    }, {}),
  };
}

/**
 * Keys held, worked out from the ladder rather than counted along the way.
 *
 * One key per finished pack, one spent per pack unlocked beyond the three that
 * start open. A stored counter was fine while progress lived in one browser, but
 * two devices merging their progress can't merge a number — they'd double-count
 * the same key, or lose one. This can only ever agree with itself.
 */
export function deriveKeys(state: TopicsState): number {
  const earned = TOPIC_IDS.filter(
    (id) => state.topicProgress[id]?.isCompleted,
  ).length;
  const spent = state.unlockedTopicIds.filter(
    (id) => !DEFAULT_UNLOCKED.includes(id),
  ).length;

  return Math.max(earned - spent, 0);
}

function withDerivedKeys(state: TopicsState): TopicsState {
  const keys = deriveKeys(state);
  return keys === state.keys ? state : { ...state, keys };
}

/** Parses anything (stored JSON, an API body) into a state we can trust. */
export function normalizeState(raw: unknown): TopicsState {
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
            .filter((value) => value >= 1 && value <= TOPIC_LEVEL_COUNT)
        : [];

      acc[topicId] = {
        completedLevels,
        isCompleted: Boolean(existing?.isCompleted),
        // Legendary replaced the old one-click "ascend", so a stored ascend flag
        // is deliberately not carried over: the title is a round now, not a tap.
        isLegendary: Boolean(existing?.isLegendary),
        // Packs finished before the key popup existed keep their key without
        // being congratulated for it out of nowhere on the next visit.
        keyCelebrated: Boolean(existing?.keyCelebrated ?? existing?.isCompleted),
      };

      return acc;
    },
    {},
  );

  return withDerivedKeys({
    unlockedTopicIds: unlocked.length > 0 ? unlocked : base.unlockedTopicIds,
    keys: 0,
    topicProgress: progressMap,
  });
}

/**
 * Two versions of the same ladder, combined.
 *
 * Every field only ever moves one way — a cleared level is never uncleared, a
 * crown is never taken back — so the merge is a union and needs no clocks or
 * conflict rules. That is what lets a round played offline on one device land
 * safely on top of whatever another device did in the meantime.
 */
export function mergeTopicsState(a: TopicsState, b: TopicsState): TopicsState {
  const unlockedTopicIds = TOPIC_IDS.filter(
    (id) => a.unlockedTopicIds.includes(id) || b.unlockedTopicIds.includes(id),
  );

  const topicProgress = TOPIC_IDS.reduce<Record<string, TopicProgress>>(
    (acc, topicId) => {
      const left = a.topicProgress[topicId] ?? createDefaultTopicProgress();
      const right = b.topicProgress[topicId] ?? createDefaultTopicProgress();

      acc[topicId] = {
        completedLevels: Array.from(
          new Set([...left.completedLevels, ...right.completedLevels]),
        ).sort((x, y) => x - y),
        isCompleted: left.isCompleted || right.isCompleted,
        isLegendary: left.isLegendary || right.isLegendary,
        keyCelebrated: left.keyCelebrated || right.keyCelebrated,
      };

      return acc;
    },
    {},
  );

  return withDerivedKeys({ unlockedTopicIds, keys: 0, topicProgress });
}

export function getLevelsForTopic(
  state: TopicsState,
  topicId: string,
): TopicLevel[] {
  const progress = state.topicProgress[topicId] ?? createDefaultTopicProgress();

  return Array.from({ length: TOPIC_LEVEL_COUNT }, (_, index) => {
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
  if (!TOPIC_IDS.includes(topicId) || level < 1 || level > TOPIC_LEVEL_COUNT) {
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
    completedLevels.length === TOPIC_LEVEL_COUNT && !progress.isCompleted;

  // The key that comes with a finished pack is not added here — `deriveKeys`
  // reads it back off `isCompleted`, so finishing the same pack twice, or on two
  // devices, can never hand out two keys.
  const nextState = withDerivedKeys({
    ...state,
    topicProgress: {
      ...state.topicProgress,
      [topicId]: {
        ...progress,
        completedLevels,
        isCompleted: completedLevels.length === TOPIC_LEVEL_COUNT,
      },
    },
  });

  return { nextState, topicJustCompleted };
}

export function unlockTopic(state: TopicsState, topicId: string): TopicsState {
  if (!TOPIC_IDS.includes(topicId)) {
    return state;
  }

  if (state.unlockedTopicIds.includes(topicId) || state.keys < 1) {
    return state;
  }

  return withDerivedKeys({
    ...state,
    unlockedTopicIds: [...state.unlockedTopicIds, topicId],
  });
}

/**
 * Marks a finished pack legendary. Earned by scoring 85% on the review round
 * over the whole pack, not by pressing a button — which is all the old "ascend"
 * was.
 */
export function makeTopicLegendary(
  state: TopicsState,
  topicId: string,
): TopicsState {
  const progress = state.topicProgress[topicId];

  if (!progress || !progress.isCompleted || progress.isLegendary) {
    return state;
  }

  return {
    ...state,
    topicProgress: {
      ...state.topicProgress,
      [topicId]: {
        ...progress,
        isLegendary: true,
      },
    },
  };
}

/** Records that the key celebration for a pack has been played. */
export function markKeyCelebrated(
  state: TopicsState,
  topicId: string,
): TopicsState {
  const progress = state.topicProgress[topicId];

  if (!progress || progress.keyCelebrated) {
    return state;
  }

  return {
    ...state,
    topicProgress: {
      ...state.topicProgress,
      [topicId]: {
        ...progress,
        keyCelebrated: true,
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
