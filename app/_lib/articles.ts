// Definite articles, as structured data.
//
// The corpus stores nouns bare — "Hund", not "der Hund" — because the bare form
// is what identity, matching and de-duplication key on. The article lives
// beside it in its own column, so it can be shown, graded, or ignored per game
// rather than being baked into the text.
//
// Two rules the rest of the app depends on:
//
//  1. `withArticle` output is DISPLAY ONLY. Never compare it with `===`.
//     Equality stays on ids (word pairing), on option objects (one-of-three), or
//     on bare text plus an explicit article rule (speed spelling). A rendered
//     string is a presentation of a word, not the word.
//
//  2. `withArticle` guards against doubling. If the text already starts with the
//     article, it is returned unchanged. Custom decks are free text, so someone
//     will type "der Hund" into the foreign field and then pick "der" from the
//     dropdown; that must render "der Hund", not "der der Hund".
//
// Not to be confused with LEADING_ARTICLES in app/api/decks/_lib/vocabIdentity.ts,
// which is deliberately wider (ein/eine, un/una, English "to") because its job is
// fuzzy corpus lookup rather than a closed set of storable values.

import { normalizeLang, type Lang } from "./languages";

/**
 * The articles a word may be stored with, per language.
 *
 * Definite only, plus English's indefinite pair, which is short enough to be
 * worth offering. Czech has no articles at all, which is precisely the gap this
 * feature exists to teach: a Czech speaker's own grammar gives them nothing to
 * transfer.
 */
export const ARTICLES: Record<Lang, readonly string[]> = {
  de: ["der", "die", "das"],
  es: ["el", "la", "los", "las"],
  en: ["the", "a", "an"],
  cs: [],
};

/** Every language whose articles are storable values. Czech has none. */
const LANGS_WITH_ARTICLES: Lang[] = ["de", "es", "en"];

/** Whether a language has articles worth asking the user about. */
export function hasArticles(lang: Lang | null | undefined): lang is Lang {
  return Boolean(lang && ARTICLES[lang].length > 0);
}

/**
 * The validator for anything arriving from a client, an LLM, or an old row.
 *
 * Returns null rather than throwing — an unrecognised article is the same
 * situation as no article, and nothing downstream is made worse by dropping it.
 * When `lang` is known the value must belong to that language, so a German deck
 * can't end up holding "la".
 */
export function normalizeArticle(
  value: unknown,
  lang?: Lang | null,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  if (lang) {
    return ARTICLES[lang].includes(trimmed) ? trimmed : null;
  }

  return LANGS_WITH_ARTICLES.some((code) => ARTICLES[code].includes(trimmed))
    ? trimmed
    : null;
}

/**
 * Which language an article belongs to, when it belongs to exactly one.
 *
 * "la" is Spanish only, but a shared string would be ambiguous, so anything
 * claimed by two languages returns null rather than guessing.
 */
export function articleLang(article: string): Lang | null {
  const normalized = article.trim().toLowerCase();
  const owners = LANGS_WITH_ARTICLES.filter((code) =>
    ARTICLES[code].includes(normalized),
  );
  return owners.length === 1 ? owners[0] : null;
}

/**
 * The other articles of the same language — the distractors for an article
 * question. German returns two, Spanish's "el" returns "la" (the plurals are
 * poor distractors for a singular noun, and vice versa).
 */
export function siblingArticles(article: string): string[] {
  const normalized = article.trim().toLowerCase();
  const lang = articleLang(normalized);
  if (!lang) {
    return [];
  }

  if (lang === "es") {
    const singular = ["el", "la"];
    const plural = ["los", "las"];
    const family = singular.includes(normalized) ? singular : plural;
    return family.filter((candidate) => candidate !== normalized);
  }

  return ARTICLES[lang].filter((candidate) => candidate !== normalized);
}

/** True when `text` already carries `article` as its first word. */
function startsWithArticle(text: string, article: string): boolean {
  const prefix = `${article.toLowerCase()} `;
  return text.trim().toLowerCase().startsWith(prefix);
}

/**
 * "der Hund". Display only — never compare the result with `===`.
 *
 * Returns the text unchanged when there is no article, so every call site can
 * pass a nullable field without branching, and a null-everywhere rollout
 * renders exactly as it did before.
 */
export function withArticle(
  text: string,
  article: string | null | undefined,
): string {
  if (!article) {
    return text;
  }
  if (startsWithArticle(text, article)) {
    return text;
  }
  return `${article} ${text}`;
}

/** "(der) Hund" — the article is shown but not being asked for. */
export function withOptionalArticle(
  text: string,
  article: string | null | undefined,
): string {
  if (!article) {
    return text;
  }
  if (startsWithArticle(text, article)) {
    return text;
  }
  return `(${article}) ${text}`;
}

/**
 * Pulls a leading article out of free text a user typed.
 *
 * Used only in the deck editor, as a visible nudge the user can undo before
 * saving. Never run server-side: rewriting `foreign` changes the word's
 * vocabKey and orphans every stat row filed under the old one.
 */
export function splitInlineArticle(
  text: string,
  lang: Lang | null | undefined,
): { article: string | null; text: string } {
  const resolved = normalizeLang(lang);
  if (!hasArticles(resolved)) {
    return { article: null, text };
  }

  const trimmed = text.trim();
  for (const article of ARTICLES[resolved]) {
    const match = trimmed.match(
      new RegExp(`^${article}\\s+(?=\\S)`, "i"),
    );
    if (match) {
      return { article, text: trimmed.slice(match[0].length).trim() };
    }
  }

  return { article: null, text };
}
