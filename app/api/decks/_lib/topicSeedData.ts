import type { Lang } from "@/app/_lib/languages";

// Topic decks no longer carry their own translations. Each topic just names the
// English concepts it covers; the words themselves are resolved from the shared
// vocabulary corpus (word_concepts + concept_translations) at seed time.
//
// That means a topic deck can be built for ANY language pair the corpus
// supports, instead of only the two that happened to be hand-translated here.
// Adding a language is now a corpus job, not an edit to this file.

export interface TopicSeed {
  topicKey: string;
  /** Display name per language; falls back to the English name if absent. */
  name: Partial<Record<Lang, string>> & { en: string };
  /**
   * English concept words, matched against `word_concepts.concept_key`.
   *
   * Order matters: a topic's five levels each practice one consecutive slice of
   * this list (see `levelWindow` in spacedRepetition.ts), so the words are
   * grouped roughly easiest-first and by sub-theme rather than shuffled.
   */
  english: string[];
}

/**
 * Words per topic. Kept at a multiple of `TOPIC_LEVEL_COUNT` so every level gets
 * an equal slice — 30 words means 6 per level, which is one practice round.
 */
export const WORDS_PER_TOPIC = 30;

export const TOPIC_SEEDS: TopicSeed[] = [
  {
    topicKey: "autos",
    name: { en: "Cars", de: "Autos", es: "Coches", cs: "Auta" },
    english: [
      // 1 — the car itself
      "car",
      "road",
      "wheel",
      "engine",
      "brake",
      "driver",
      // 2 — running one
      "fuel",
      "traffic",
      "speed",
      "highway",
      "street",
      "bridge",
      // 3 — parts & keeping it going
      "garage",
      "mechanic",
      "key",
      "lock",
      "mirror",
      "repair",
      // 4 — driving
      "drive",
      "ride",
      "stop",
      "turn",
      "direction",
      "map",
      // 5 — on the road
      "police",
      "fix",
      "fast",
      "slow",
      "safe",
      "dangerous",
    ],
  },
  {
    topicKey: "essen",
    name: { en: "Food", de: "Essen", es: "Comida", cs: "Jídlo" },
    english: [
      // 1 — staples
      "food",
      "bread",
      "water",
      "milk",
      "meat",
      "cheese",
      // 2 — meals
      "soup",
      "breakfast",
      "dinner",
      "coffee",
      "tea",
      "sugar",
      // 3 — tastes
      "sweet",
      "sour",
      "salty",
      "bitter",
      "taste",
      "smell",
      // 4 — the kitchen
      "plate",
      "table",
      "kitchen",
      "cook",
      "ingredient",
      "portion",
      // 5 — eating out & appetite
      "waiter",
      "eat",
      "drink",
      "hungry",
      "thirsty",
      "hot",
    ],
  },
  {
    topicKey: "obst-gemuese",
    name: {
      en: "Fruit & Vegetables",
      de: "Obst & Gemuese",
      es: "Frutas y verduras",
      cs: "Ovoce a zelenina",
    },
    english: [
      // 1 — fruit
      "apple",
      "banana",
      "orange",
      "lemon",
      "grape",
      "tomato",
      // 2 — vegetables
      "potato",
      "carrot",
      "onion",
      "salad",
      "tree",
      "flower",
      // 3 — where it grows
      "garden",
      "farmer",
      "grow",
      "market",
      "shop",
      "buy",
      // 4 — preparing
      "wash",
      "cut",
      "clean",
      "healthy",
      "soft",
      "hard",
      // 5 — describing
      "dry",
      "wet",
      "light",
      "dark",
      "cheap",
      "expensive",
    ],
  },
  {
    topicKey: "reisen",
    name: { en: "Travel", de: "Reisen", es: "Viajes", cs: "Cestování" },
    english: [
      // 1 — getting there
      "travel",
      "trip",
      "journey",
      "train",
      "station",
      "airport",
      // 2 — paperwork
      "ticket",
      "passport",
      "hotel",
      "luggage",
      "suitcase",
      "backpack",
      // 3 — planning
      "holiday",
      "vacation",
      "destination",
      "guide",
      "map",
      "compass",
      // 4 — doing it
      "visit",
      "arrive",
      "depart",
      "pack",
      "tourist",
      "voyage",
      // 5 — places
      "city",
      "country",
      "place",
      "island",
      "beach",
      "baggage",
    ],
  },
  {
    topicKey: "alltag",
    name: {
      en: "Daily Life",
      de: "Alltag",
      es: "Vida diaria",
      cs: "Každodenní život",
    },
    english: [
      // 1 — the day
      "day",
      "morning",
      "evening",
      "night",
      "time",
      "week",
      // 2 — when
      "today",
      "tomorrow",
      "yesterday",
      "year",
      "always",
      "never",
      // 3 — the routine
      "work",
      "sleep",
      "shopping",
      "wash",
      "clean",
      "wait",
      // 4 — at home
      "house",
      "room",
      "bed",
      "door",
      "window",
      "chair",
      // 5 — people & things
      "friend",
      "phone",
      "money",
      "sometimes",
      "busy",
      "ready",
    ],
  },
];

/**
 * Pairs to seed topic decks for. English speakers learning the other three,
 * plus two reverses — the case the old two-language seed data could not
 * express at all.
 */
export const TOPIC_DECK_PAIRS: Array<{ nativeLang: Lang; foreignLang: Lang }> = [
  { nativeLang: "en", foreignLang: "de" },
  { nativeLang: "en", foreignLang: "es" },
  { nativeLang: "en", foreignLang: "cs" },
  { nativeLang: "de", foreignLang: "en" },
  { nativeLang: "cs", foreignLang: "en" },
];

export function topicDeckName(seed: TopicSeed, lang: Lang): string {
  return seed.name[lang] ?? seed.name.en;
}
