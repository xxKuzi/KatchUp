"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLanguage } from "../_lib/languageContext";
import { useLearningLevelState } from "../_lib/useLearningLevel";
import {
  useLanguageLevels,
  type LanguageStanding,
} from "../_lib/useLanguageLevels";
import { LANGS, LANG_FLAGS, LANG_LABELS, type Lang } from "../_lib/languages";
import { PLACEMENT_TEST_HREF } from "../_lib/placementTest";

export default function LanguageSwitcher({
  open,
  onOpenChange,
  isHomePage = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isHomePage?: boolean;
}) {
  const router = useRouter();
  const { language, setLanguage, learningLanguage, setLearningLanguage } =
    useLanguage();
  const [mounted, setMounted] = useState(false);
  const levelState = useLearningLevelState(learningLanguage);
  const level = levelState.level;
  const { languages } = useLanguageLevels();

  const standingFor = (option: Lang): LanguageStanding | undefined =>
    languages?.find((entry) => entry.learning === option);

  // Keep the two languages distinct: picking the other side's value swaps them.
  const handleSetSpeak = (option: Lang) => {
    if (option === learningLanguage) {
      setLearningLanguage(language);
    }
    setLanguage(option);
  };

  const handleSetLearning = (option: Lang) => {
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
        aria-label={`Change languages (learning ${LANG_LABELS[learningLanguage]})`}
        title={
          level
            ? `${LANG_LABELS[language]} → ${LANG_LABELS[learningLanguage]} · level ${level.level} (${levelState.knownWords ?? level.masteredCount} words mastered)`
            : `${LANG_LABELS[language]} → ${LANG_LABELS[learningLanguage]}`
        }
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-lg leading-none shadow-sm transition hover:scale-105 ${
          isHomePage
            ? "border-slate-700/80 bg-slate-900/80 hover:bg-slate-800"
            : "border-slate-300/80 bg-white/80 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/80 dark:hover:bg-slate-800"
        }`}
      >
        <span aria-hidden>{LANG_FLAGS[learningLanguage]}</span>
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
                    Pick the language you speak and the one you&apos;re
                    learning. Each one keeps its own level.
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
                  <ArrowRight className="h-5 w-5 rotate-90" />
                </div>

                <LanguagePicker
                  label="I'm learning"
                  value={learningLanguage}
                  onChange={handleSetLearning}
                  options={LANGS.filter((option) => option !== language)}
                  standingFor={standingFor}
                />

                {/* The whole point of showing the levels together: a language you
                  have not started yet is one the placement test can still put you
                  into, and that offer expires the first time you answer anything
                  in it. Said here rather than left to be discovered. Switching to
                  such a language puts the prompt up on the next page anyway, so
                  this is the same door reached a step earlier. */}
                {languages && standingFor(learningLanguage)?.canBePlaced && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      router.push(PLACEMENT_TEST_HREF);
                    }}
                    className="w-full rounded-2xl border border-blue-300 bg-blue-50 px-4 py-3 text-xs font-bold text-blue-800 transition hover:bg-blue-100 dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-950/70"
                  >
                    New to {LANG_LABELS[learningLanguage]} here — take the
                    placement test
                  </button>
                )}
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

export function LanguagePicker({
  label,
  value,
  onChange,
  options = LANGS,
  standingFor,
}: {
  label: string;
  value: Lang;
  onChange: (lang: Lang) => void;
  options?: readonly Lang[];
  /**
   * Where the player stands in each option, when the picker is choosing what to
   * learn. Omitted for the "I speak" side, which has no level to speak of.
   */
  standingFor?: (lang: Lang) => LanguageStanding | undefined;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <div className="grid grid-cols-4 gap-2">
        {options.map((option) => {
          const active = option === value;
          const standing = standingFor?.(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              title={
                standing?.started
                  ? `${LANG_LABELS[option]} · level ${standing.level} (${standing.band})`
                  : LANG_LABELS[option]
              }
              className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-xs font-semibold transition ${
                active
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/60 dark:text-blue-300"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              <span className="text-2xl leading-none" aria-hidden>
                {LANG_FLAGS[option]}
              </span>
              <span>{LANG_LABELS[option]}</span>
              {/* Only rendered where a level exists to render, so the "I speak"
                  side and a signed-out navbar keep the layout they had. */}
              {standing && (
                <span
                  className={`text-[0.6rem] font-bold leading-none ${
                    standing.started
                      ? "text-slate-500 dark:text-slate-400"
                      : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {standing.started
                    ? `Lv ${standing.level} · ${standing.band}`
                    : "not started"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
