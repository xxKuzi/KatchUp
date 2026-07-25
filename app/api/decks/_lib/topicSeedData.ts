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
  /** English concept words, matched against `word_concepts.concept_key`. */
  english: string[];
}

export const TOPIC_SEEDS: TopicSeed[] = [
  {
    topicKey: "autos",
    name: { en: "Cars", de: "Autos", es: "Coches", cs: "Auta" },
    english: [
      "car",
      "road",
      "wheel",
      "engine",
      "brake",
      "driver",
      "fuel",
      "traffic",
      "speed",
      "highway",
    ],
  },
  {
    topicKey: "essen",
    name: { en: "Food", de: "Essen", es: "Comida", cs: "Jídlo" },
    english: [
      "bread",
      "water",
      "meat",
      "cheese",
      "soup",
      "breakfast",
      "dinner",
      "coffee",
      "sugar",
      "plate",
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
      "apple",
      "banana",
      "orange",
      "tomato",
      "potato",
      "carrot",
      "onion",
      "lemon",
      "grape",
      "salad",
    ],
  },
  {
    topicKey: "reisen",
    name: { en: "Travel", de: "Reisen", es: "Viajes", cs: "Cestování" },
    english: [
      "airport",
      "ticket",
      "hotel",
      "luggage",
      "passport",
      "train",
      "map",
      "beach",
      "station",
      "journey",
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
      "morning",
      "work",
      "house",
      "money",
      "friend",
      "phone",
      "time",
      "week",
      "sleep",
      "shopping",
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
