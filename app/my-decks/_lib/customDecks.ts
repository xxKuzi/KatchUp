export interface DeckWord {
  id: string;
  native: string;
  foreign: string;
}

export interface CustomDeck {
  id: string;
  name: string;
  nativeLang: string;
  foreignLang: string;
  lastPracticed: string;
  words: DeckWord[];
}

export const CUSTOM_DECKS_STORAGE_KEY = "katchup-custom-decks";

const DEFAULT_CUSTOM_DECKS: CustomDeck[] = [
  {
    id: "deck-101",
    name: "Travel Basics",
    nativeLang: "english",
    foreignLang: "deutsch",
    lastPracticed: "2026-04-02T12:00:00Z",
    words: [
      { id: "w1", native: "beer", foreign: "Bier" },
      { id: "w2", native: "hello", foreign: "Hallo" },
    ],
  },
  {
    id: "deck-102",
    name: "Zaklady cestovani",
    nativeLang: "czech",
    foreignLang: "deutsch",
    lastPracticed: "2026-04-01T09:30:00Z",
    words: [
      { id: "w3", native: "pivo", foreign: "Bier" },
      { id: "w4", native: "ahoj", foreign: "Hallo" },
    ],
  },
];

function toStringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeWord(value: unknown): DeckWord {
  const item = (value ?? {}) as Partial<DeckWord>;

  return {
    id: toStringValue(item.id, generateId()),
    native: toStringValue(item.native),
    foreign: toStringValue(item.foreign),
  };
}

function normalizeDeck(value: unknown): CustomDeck {
  const item = (value ?? {}) as Partial<CustomDeck>;
  const words = Array.isArray(item.words) ? item.words.map(normalizeWord) : [];

  return {
    id: toStringValue(item.id, generateId()),
    name: toStringValue(item.name, "New Custom Deck"),
    nativeLang: toStringValue(item.nativeLang, "english"),
    foreignLang: toStringValue(item.foreignLang, "deutsch"),
    lastPracticed: toStringValue(item.lastPracticed, new Date(0).toISOString()),
    words,
  };
}

function cloneDefaults(): CustomDeck[] {
  return DEFAULT_CUSTOM_DECKS.map((deck) => ({
    ...deck,
    words: deck.words.map((word) => ({ ...word })),
  }));
}

export function generateId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createDeck(
  input?: Partial<Pick<CustomDeck, "name" | "nativeLang" | "foreignLang">>,
): CustomDeck {
  return {
    id: generateId(),
    name: toStringValue(input?.name, "New Custom Deck"),
    nativeLang: toStringValue(input?.nativeLang, "english"),
    foreignLang: toStringValue(input?.foreignLang, "deutsch"),
    lastPracticed: new Date().toISOString(),
    words: [],
  };
}

export function createWord(native = "", foreign = ""): DeckWord {
  return {
    id: generateId(),
    native,
    foreign,
  };
}

export function loadCustomDecks(): CustomDeck[] {
  if (typeof window === "undefined") {
    return cloneDefaults();
  }

  const raw = window.localStorage.getItem(CUSTOM_DECKS_STORAGE_KEY);

  if (!raw) {
    const seeded = cloneDefaults();
    window.localStorage.setItem(
      CUSTOM_DECKS_STORAGE_KEY,
      JSON.stringify(seeded),
    );
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      throw new Error("Deck data must be an array.");
    }

    return parsed.map(normalizeDeck);
  } catch {
    const seeded = cloneDefaults();
    window.localStorage.setItem(
      CUSTOM_DECKS_STORAGE_KEY,
      JSON.stringify(seeded),
    );
    return seeded;
  }
}

export function saveCustomDecks(decks: CustomDeck[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CUSTOM_DECKS_STORAGE_KEY, JSON.stringify(decks));
}

const MISTAKES_DECK_PREFIX = "auto-mistakes";
export const MISTAKES_DECK_NAME = "Words to review - mistakes";
export const MISTAKES_PRACTICE_ENERGY_REWARD = 5;

function mistakesDeckId(nativeLang: string, foreignLang: string): string {
  return `${MISTAKES_DECK_PREFIX}:${nativeLang}:${foreignLang}`;
}

export function isMistakesDeck(deck: CustomDeck): boolean {
  return deck.id.startsWith(`${MISTAKES_DECK_PREFIX}:`);
}

export function getMistakesDeck(
  nativeLang: string,
  foreignLang: string,
): CustomDeck | null {
  if (typeof window === "undefined") {
    return null;
  }

  const deckId = mistakesDeckId(nativeLang, foreignLang);
  return loadCustomDecks().find((deck) => deck.id === deckId) ?? null;
}

/**
 * Adds a missed word to the auto-collected "Words to review" deck for that
 * language pair, creating the deck on first miss. Silently dedupes and no-ops
 * outside the browser.
 */
export function recordMistake(
  word: { native: string; foreign: string },
  languagePair: { nativeLang: string; foreignLang: string },
): void {
  if (typeof window === "undefined") {
    return;
  }

  const native = word.native.trim();
  const foreign = word.foreign.trim();

  if (!native || !foreign) {
    return;
  }

  const deckId = mistakesDeckId(
    languagePair.nativeLang,
    languagePair.foreignLang,
  );
  const decks = loadCustomDecks();
  const existingDeck = decks.find((deck) => deck.id === deckId);

  if (!existingDeck) {
    const newDeck: CustomDeck = {
      id: deckId,
      name: MISTAKES_DECK_NAME,
      nativeLang: languagePair.nativeLang,
      foreignLang: languagePair.foreignLang,
      lastPracticed: new Date(0).toISOString(),
      words: [createWord(native, foreign)],
    };
    saveCustomDecks([newDeck, ...decks]);
    return;
  }

  const alreadyTracked = existingDeck.words.some(
    (existing) =>
      existing.native.trim().toLowerCase() === native.toLowerCase() &&
      existing.foreign.trim().toLowerCase() === foreign.toLowerCase(),
  );

  if (alreadyTracked) {
    return;
  }

  const updatedDecks = decks.map((deck) =>
    deck.id === deckId
      ? { ...deck, words: [...deck.words, createWord(native, foreign)] }
      : deck,
  );
  saveCustomDecks(updatedDecks);
}

export function groupDecksByLanguages(
  decks: CustomDeck[],
): Record<string, CustomDeck[]> {
  return decks.reduce<Record<string, CustomDeck[]>>((acc, deck) => {
    const key = `${deck.nativeLang} -> ${deck.foreignLang}`;

    if (!acc[key]) {
      acc[key] = [];
    }

    acc[key].push(deck);
    return acc;
  }, {});
}
