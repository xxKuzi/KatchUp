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
