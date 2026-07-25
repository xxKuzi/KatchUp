"use client";

import { useLanguage } from "./languageContext";
import { detectBrowserLang, normalizeLang, type Lang } from "./languages";

export interface LanguagePair {
  /** The language the user speaks. */
  speak: Lang;
  /** The language the user is learning. */
  learning: Lang;
}

const FALLBACK_SPEAK: Lang = "en";
const FALLBACK_LEARNING: Lang = "de";

/**
 * The user's current language pair, as canonical codes.
 *
 * Reads through the existing language context (which persists to localStorage)
 * and coerces legacy values like "deutsch" on the way out, so preferences saved
 * before the migration keep working. Guarantees the two differ — a pair where
 * both sides match has nothing to teach.
 */
export function useLanguagePair(): LanguagePair {
  const { language, learningLanguage } = useLanguage();

  const speak = normalizeLang(language) ?? detectBrowserLang() ?? FALLBACK_SPEAK;
  let learning = normalizeLang(learningLanguage) ?? FALLBACK_LEARNING;

  if (learning === speak) {
    learning = speak === FALLBACK_LEARNING ? FALLBACK_SPEAK : FALLBACK_LEARNING;
  }

  return { speak, learning };
}
