"use client";

import { Globe } from "lucide-react";
import { useLanguage } from "../_lib/languageContext";
import { Language, LANGUAGES } from "../_lib/translations";

const LANGUAGE_OPTIONS: Language[] = ["english", "czech", "deutsch"];

export default function LanguageToggle() {
  const {
    language,
    setLanguage,
    nativeLanguage,
    setNativeLanguage,
    learningLanguage,
    setLearningLanguage,
  } = useLanguage();

  const getNextLanguage = (): Language => {
    const currentIndex = LANGUAGE_OPTIONS.indexOf(language);
    const nextIndex = (currentIndex + 1) % LANGUAGE_OPTIONS.length;
    return LANGUAGE_OPTIONS[nextIndex];
  };

  const toggleLanguage = () => {
    setLanguage(getNextLanguage());
  };

  const toggleNativeLanguage = () => {
    const currentIndex = LANGUAGE_OPTIONS.indexOf(nativeLanguage);
    const nextIndex = (currentIndex + 1) % LANGUAGE_OPTIONS.length;
    setNativeLanguage(LANGUAGE_OPTIONS[nextIndex]);
  };

  const toggleLearningLanguage = () => {
    const currentIndex = LANGUAGE_OPTIONS.indexOf(learningLanguage);
    const nextIndex = (currentIndex + 1) % LANGUAGE_OPTIONS.length;
    setLearningLanguage(LANGUAGE_OPTIONS[nextIndex]);
  };

  return (
    <div className="group relative inline-flex items-center gap-1.5 rounded-full border border-slate-300/80 bg-white/80 px-2 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:border-blue-300 hover:bg-white dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:bg-slate-900">
      <button
        type="button"
        onClick={toggleLanguage}
        aria-label={`Switch to next language (currently ${LANGUAGES[language]})`}
        title={`Switch language: ${LANGUAGES[language]}`}
        className="flex items-center gap-1.5 transition"
      >
        <span className="grid h-4.5 w-4.5 place-items-center rounded-full bg-slate-100 text-slate-600 transition group-hover:bg-blue-100 group-hover:text-blue-600 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-blue-950 dark:group-hover:text-blue-300">
          <Globe className="h-3 w-3" />
        </span>
        <span className="hidden sm:inline">
          UI: {LANGUAGES[language].split(" ")[0]}
        </span>
      </button>

      <button
        type="button"
        onClick={toggleNativeLanguage}
        aria-label={`Switch native language (currently ${LANGUAGES[nativeLanguage]})`}
        title={`Native language: ${LANGUAGES[nativeLanguage]}`}
        className="hidden items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:inline-flex"
      >
        N: {LANGUAGES[nativeLanguage].split(" ")[0]}
      </button>

      <button
        type="button"
        onClick={toggleLearningLanguage}
        aria-label={`Switch learning language (currently ${LANGUAGES[learningLanguage]})`}
        title={`Learning language: ${LANGUAGES[learningLanguage]}`}
        className="hidden items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:inline-flex"
      >
        L: {LANGUAGES[learningLanguage].split(" ")[0]}
      </button>
    </div>
  );
}
