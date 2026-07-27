import type { Lang } from "@/app/_lib/languages";

/**
 * How a vocabulary item is identified, independently of the deck row it happens
 * to sit in.
 *
 * Progress used to hang off `deck_words.id`, which meant the same word in two
 * decks was two unrelated learnings: the level double-counted it, the learned
 * list showed it twice, and mastering it in one deck left the other still
 * drilling it. Identity moves that anchor onto the word itself.
 */

/**
 * Normalisation used for *identity*.
 *
 * Deliberately keeps diacritics. Czech `být` (to be) and `byt` (flat) are
 * different words, as are Spanish `año` and `ano`; folding them would merge two
 * learnings into one row, and no later migration can pull them apart again.
 * NFC rather than NFD so the same accented letter typed two ways compares equal
 * without the marks being separable.
 */
export function normalizeVocabText(value: string): string {
  return value
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

/** Articles worth ignoring when hunting for a concept. Czech has none. */
const LEADING_ARTICLES: Record<Lang, string[]> = {
  en: ["the", "a", "an", "to"],
  de: ["der", "die", "das", "ein", "eine"],
  es: ["el", "la", "los", "las", "un", "una"],
  cs: [],
};

/**
 * Normalisation used only to *find* a concept in the corpus, never stored.
 *
 * Looser than `normalizeVocabText` on purpose: it has to match a user's "der
 * Hund" against the corpus's "Hund", and the ASCII transliterations left in the
 * oldest topic decks ("Strasse", "Kaese") against the corrected orthography.
 * Because it can collapse two genuinely different words onto one key, every
 * caller must require the match to be *unique* before trusting it.
 */
export function matchKey(value: string, lang?: Lang): string {
  let text = normalizeVocabText(value);

  // German's ASCII fallback spells umlauts as digraphs ("Kaese", "Strasse"), so
  // both spellings have to land on the same key. Stripping the diacritic would
  // send "K\u00e4se" to "kase" and leave "Kaese" unmatched, which is the whole case
  // this pass exists for \u2014 expand instead, before the generic strip below.
  if (lang === "de") {
    text = text
      .replace(/\u00e4/g, "ae")
      .replace(/\u00f6/g, "oe")
      .replace(/\u00fc/g, "ue")
      .replace(/\u00df/g, "ss");
  }

  text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const articles = lang ? LEADING_ARTICLES[lang] : [];
  for (const article of articles) {
    if (text.startsWith(`${article} `)) {
      text = text.slice(article.length + 1);
      break;
    }
  }

  return text.trim();
}

/** Mirrors the slug rule used when the corpus was built. */
export function slugifyConceptKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The stable key a stat row is stored under, scoped by the pair of languages.
 *
 * Corpus-backed words key on the concept, so the same idea is one learning
 * across every deck and every game. Words the corpus doesn't know — free text
 * typed into a custom deck — fall back to their own normalised texts, which
 * still de-duplicates them against themselves.
 */
export function buildVocabKey(params: {
  conceptId: string | null;
  nativeKey: string;
  foreignKey: string;
}): string {
  return params.conceptId
    ? `c:${params.conceptId}`
    : `t:${params.nativeKey}|${params.foreignKey}`;
}

export interface VocabIdentity {
  conceptId: string | null;
  nativeLang: Lang;
  foreignLang: Lang;
  nativeKey: string;
  foreignKey: string;
  vocabKey: string;
  nativeText: string;
  foreignText: string;
}

/** Builds a full identity from the two texts and whatever concept backs them. */
export function buildVocabIdentity(params: {
  conceptId: string | null;
  nativeLang: Lang;
  foreignLang: Lang;
  nativeText: string;
  foreignText: string;
}): VocabIdentity {
  const nativeKey = normalizeVocabText(params.nativeText);
  const foreignKey = normalizeVocabText(params.foreignText);

  return {
    conceptId: params.conceptId,
    nativeLang: params.nativeLang,
    foreignLang: params.foreignLang,
    nativeKey,
    foreignKey,
    vocabKey: buildVocabKey({
      conceptId: params.conceptId,
      nativeKey,
      foreignKey,
    }),
    nativeText: params.nativeText,
    foreignText: params.foreignText,
  };
}
