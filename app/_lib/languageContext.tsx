"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Translations, translationsForLang } from "./translations";
import { detectBrowserLang, normalizeLang, type Lang } from "./languages";
import { notifyOnboardingChanged } from "./onboardingEvents";

interface LanguageContextType {
  // The UI language is also the user's native language ("from").
  language: Lang;
  setLanguage: (lang: Lang) => void;
  learningLanguage: Lang;
  setLearningLanguage: (lang: Lang) => void;
  t: (key: string, defaultValue?: string) => string;
  translations: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

const LANGUAGE_STORAGE_KEY = "katchup-language";
const LEARNING_LANGUAGE_STORAGE_KEY = "katchup-learning-language";
const DEFAULT_LANGUAGE: Lang = "en";
const DEFAULT_LEARNING_LANGUAGE: Lang = "de";

/**
 * The pair the player has actually chosen, or null if they never have.
 *
 * Only the learning side answers that question: the native language is guessed
 * from the browser and defaulted, but nothing writes the learning key until a
 * choice is made — so its presence is what separates a returning player from a
 * first-time visitor sitting on the defaults.
 */
export function readChosenLanguagePair(): {
  speak: Lang;
  learning: Lang;
} | null {
  if (typeof window === "undefined") {
    return null;
  }

  const learning = normalizeLang(
    window.localStorage.getItem(LEARNING_LANGUAGE_STORAGE_KEY),
  );

  if (!learning) {
    return null;
  }

  const speak =
    normalizeLang(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)) ??
    detectBrowserLang() ??
    DEFAULT_LANGUAGE;

  // A pair with the same language on both sides has nothing to teach; that is
  // a question the modal still has to ask.
  return speak === learning ? null : { speak, learning };
}

export function LanguageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [language, setLanguageState] = useState<Lang>(DEFAULT_LANGUAGE);
  const [learningLanguage, setLearningLanguageState] = useState<Lang>(
    DEFAULT_LEARNING_LANGUAGE,
  );

  useEffect(() => {
    // Stored values may predate canonical codes ("deutsch", "german"), so they
    // go through normalizeLang rather than being trusted as-is.
    const storedLanguage = normalizeLang(
      window.localStorage.getItem(LANGUAGE_STORAGE_KEY),
    );
    const storedLearning = normalizeLang(
      window.localStorage.getItem(LEARNING_LANGUAGE_STORAGE_KEY),
    );

    setLanguageState(storedLanguage ?? detectBrowserLang() ?? DEFAULT_LANGUAGE);
    setLearningLanguageState(storedLearning ?? DEFAULT_LEARNING_LANGUAGE);
  }, []);

  const setLanguage = (lang: Lang) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    }
  };

  const setLearningLanguage = (lang: Lang) => {
    setLearningLanguageState(lang);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LEARNING_LANGUAGE_STORAGE_KEY, lang);
    }
    // Level is per language, and so is the placement that establishes it — so
    // changing this is the one write that can turn a fully set-up player into
    // one who owes a test. Announced rather than left to be noticed on the next
    // page load, which is a page they would spend at an unmeasured level.
    notifyOnboardingChanged();
  };

  const activeTranslations = translationsForLang(language);

  const t = (key: string, defaultValue?: string): string => {
    const keys = key.split(".");
    let current: unknown = activeTranslations;

    for (const k of keys) {
      if (current && typeof current === "object" && k in current) {
        current = (current as Record<string, unknown>)[k];
      } else {
        return defaultValue || key;
      }
    }

    return typeof current === "string" ? current : defaultValue || key;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        learningLanguage,
        setLearningLanguage,
        t,
        translations: activeTranslations,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }

  return context;
}
