"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, X } from "lucide-react";
import { useLanguage } from "../_lib/languageContext";
import { Language, LANGUAGES, LANGUAGE_FLAGS } from "../_lib/translations";

const LANGUAGE_OPTIONS: Language[] = ["english", "czech", "deutsch"];

export default function LanguageSwitcher({
  open,
  onOpenChange,
  isHomePage = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isHomePage?: boolean;
}) {
  const { language, setLanguage, learningLanguage, setLearningLanguage } =
    useLanguage();
  const [mounted, setMounted] = useState(false);

  // Keep the two languages distinct: picking the other side's value swaps them.
  const handleSetSpeak = (option: Language) => {
    if (option === learningLanguage) {
      setLearningLanguage(language);
    }
    setLanguage(option);
  };

  const handleSetLearning = (option: Language) => {
    if (option === language) {
      setLanguage(learningLanguage);
    }
    setLearningLanguage(option);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  return (
    <>
      {/* Flag trigger — shows the language you're learning */}
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        aria-label={`Change languages (learning ${LANGUAGES[learningLanguage]})`}
        title={`${LANGUAGES[language]} → ${LANGUAGES[learningLanguage]}`}
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-lg leading-none shadow-sm transition hover:scale-105 ${
          isHomePage
            ? "border-slate-700/80 bg-slate-900/80 hover:bg-slate-800"
            : "border-slate-300/80 bg-white/80 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/80 dark:hover:bg-slate-800"
        }`}
      >
        <span aria-hidden>{LANGUAGE_FLAGS[learningLanguage]}</span>
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-100 flex items-center justify-center overflow-y-auto p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Change languages"
          >
            <div
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
              onClick={() => onOpenChange(false)}
            />

            <div className="relative my-auto w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-950">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Languages
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Pick the language you speak and the one you&apos;re learning.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
                className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <LanguagePicker
                label="I speak (app language)"
                value={language}
                onChange={handleSetSpeak}
              />

              <div className="flex justify-center text-slate-400 dark:text-slate-500">
                <ArrowRight className="h-5 w-5" />
              </div>

              <LanguagePicker
                label="I'm learning"
                value={learningLanguage}
                onChange={handleSetLearning}
              />
            </div>

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="mt-7 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
            >
              Done
            </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function LanguagePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Language;
  onChange: (lang: Language) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {LANGUAGE_OPTIONS.map((option) => {
          const active = option === value;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-xs font-semibold transition ${
                active
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/60 dark:text-blue-300"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              <span className="text-2xl leading-none" aria-hidden>
                {LANGUAGE_FLAGS[option]}
              </span>
              <span>{LANGUAGES[option].split(" ")[0]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
