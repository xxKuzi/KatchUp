// Canonical language identity for the whole app.
//
// This replaces three divergent enums that used to disagree with each other:
//   - `Language`          ("english" | "czech" | "deutsch")  — UI language
//   - `SupportedLanguage` ("german" | "spanish" | "czech")   — learning target (now removed)
//   - `DeckLanguage`      ("english" | "czech" | "deutsch")  — deck generation
// Note that the same language was spelled both "deutsch" and "german", and
// Spanish existed as a target but never as a UI/deck language.
//
// Every language here is usable as BOTH the language you speak and the one
// you're learning, which is what makes pairs like German -> English possible.

export const LANGS = ["en", "de", "es", "cs"] as const;

export type Lang = (typeof LANGS)[number];

export const LANG_LABELS: Record<Lang, string> = {
  en: "English",
  de: "Deutsch",
  es: "Español",
  cs: "Čeština",
};

/** English names, for LLM prompts where the endonym would be ambiguous. */
export const LANG_ENGLISH_NAMES: Record<Lang, string> = {
  en: "English",
  de: "German",
  es: "Spanish",
  cs: "Czech",
};

export const LANG_FLAGS: Record<Lang, string> = {
  en: "🇬🇧",
  de: "🇩🇪",
  es: "🇪🇸",
  cs: "🇨🇿",
};

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;

export type CefrLevel = (typeof CEFR_LEVELS)[number];

export function isLang(value: unknown): value is Lang {
  return LANGS.includes(value as Lang);
}

export function isCefrLevel(value: unknown): value is CefrLevel {
  return CEFR_LEVELS.includes(value as CefrLevel);
}

// Every legacy spelling that may still be sitting in localStorage, a database
// column, or an old shared URL. Kept indefinitely so old links keep working.
const LEGACY_ALIASES: Record<string, Lang> = {
  english: "en",
  eng: "en",
  german: "de",
  deutsch: "de",
  ger: "de",
  spanish: "es",
  espanol: "es",
  "español": "es",
  spa: "es",
  czech: "cs",
  cestina: "cs",
  "čeština": "cs",
  cz: "cs",
};

/**
 * Coerce any stored/received language value to a canonical code.
 * Accepts canonical codes, legacy names, and BCP-47 tags ("de-AT" -> "de").
 * Returns null when the value is absent or unrecognised, so callers decide
 * their own fallback rather than silently getting English.
 */
export function normalizeLang(value: unknown): Lang | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  if (isLang(trimmed)) {
    return trimmed;
  }

  if (trimmed in LEGACY_ALIASES) {
    return LEGACY_ALIASES[trimmed];
  }

  // BCP-47 / locale tags such as "de-AT", "es_MX", "cs-CZ".
  const base = trimmed.split(/[-_]/)[0];
  if (isLang(base)) {
    return base;
  }

  return LEGACY_ALIASES[base] ?? null;
}

/** Language the browser is configured for, when we can map it. */
export function detectBrowserLang(): Lang | null {
  if (typeof navigator === "undefined") {
    return null;
  }
  return normalizeLang(navigator.language);
}
