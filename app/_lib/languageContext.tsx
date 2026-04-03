"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Language, translations, Translations } from "./translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  nativeLanguage: Language;
  setNativeLanguage: (lang: Language) => void;
  learningLanguage: Language;
  setLearningLanguage: (lang: Language) => void;
  t: (key: string, defaultValue?: string) => string;
  translations: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

const LANGUAGE_STORAGE_KEY = "katchup-language";
const NATIVE_LANGUAGE_STORAGE_KEY = "katchup-native-language";
const LEARNING_LANGUAGE_STORAGE_KEY = "katchup-learning-language";
const DEFAULT_LANGUAGE: Language = "english";
const DEFAULT_NATIVE_LANGUAGE: Language = "english";
const DEFAULT_LEARNING_LANGUAGE: Language = "deutsch";

function parseLanguage(value: string | null, fallback: Language): Language {
  if (value === "english" || value === "czech" || value === "deutsch") {
    return value;
  }

  return fallback;
}

export function LanguageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  const [nativeLanguage, setNativeLanguageState] =
    useState<Language>(DEFAULT_NATIVE_LANGUAGE);
  const [learningLanguage, setLearningLanguageState] =
    useState<Language>(DEFAULT_LEARNING_LANGUAGE);

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem(
      LANGUAGE_STORAGE_KEY,
    );
    const storedNativeLanguage = window.localStorage.getItem(
      NATIVE_LANGUAGE_STORAGE_KEY,
    );
    const storedLearningLanguage = window.localStorage.getItem(
      LEARNING_LANGUAGE_STORAGE_KEY,
    );

    setLanguageState(parseLanguage(storedLanguage, DEFAULT_LANGUAGE));
    setNativeLanguageState(
      parseLanguage(storedNativeLanguage, DEFAULT_NATIVE_LANGUAGE),
    );
    setLearningLanguageState(
      parseLanguage(storedLearningLanguage, DEFAULT_LEARNING_LANGUAGE),
    );
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    }
  };

  const setNativeLanguage = (lang: Language) => {
    setNativeLanguageState(lang);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(NATIVE_LANGUAGE_STORAGE_KEY, lang);
    }
  };

  const setLearningLanguage = (lang: Language) => {
    setLearningLanguageState(lang);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LEARNING_LANGUAGE_STORAGE_KEY, lang);
    }
  };

  const t = (key: string, defaultValue?: string): string => {
    const keys = key.split(".");
    let current: unknown = translations[language];

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
        nativeLanguage,
        setNativeLanguage,
        learningLanguage,
        setLearningLanguage,
        t,
        translations: translations[language],
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
