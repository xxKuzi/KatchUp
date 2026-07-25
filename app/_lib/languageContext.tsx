"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Translations, translationsForLang } from "./translations";
import { detectBrowserLang, normalizeLang, type Lang } from "./languages";

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
