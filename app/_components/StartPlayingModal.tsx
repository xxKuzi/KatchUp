"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { useLanguage } from "../_lib/languageContext";
import { LanguagePicker } from "./LanguageSwitcher";
import {
  detectBrowserLang,
  LANGS,
  LANG_FLAGS,
  LANG_LABELS,
  normalizeLang,
  type CefrLevel,
  type Lang,
} from "../_lib/languages";
import { hasAnonPlaysRemaining } from "../games/_lib/anonPlayGate";
import { scoreRushHref } from "../games/_lib/scoreRushStart";

const LANGUAGE_STORAGE_KEY = "katchup-language";

/**
 * The starting-difficulty choice, in words rather than CEFR codes. The value
 * behind each option is the tag the vocabulary carries, which is the only
 * place those codes still live.
 */
const STARTING_POINTS: {
  difficulty: CefrLevel;
  label: string;
  hint: string;
}[] = [
  { difficulty: "A1", label: "Just starting", hint: "First words" },
  { difficulty: "A2", label: "Some basics", hint: "Everyday words" },
  { difficulty: "B1", label: "Getting by", hint: "Full sentences" },
  { difficulty: "C1", label: "Pretty fluent", hint: "Rare words" },
];

export default function StartPlayingModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const { language, setLanguage, setLearningLanguage } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [nativeLanguage, setNativeLanguage] = useState<Lang>(language);
  // Deliberately unset: the learning language is the one real choice here, so
  // it must be picked rather than defaulted into something arbitrary.
  const [learningLanguage, setLearningLanguageChoice] = useState<Lang | null>(
    null,
  );
  // Players never see CEFR codes — they pick how much of the language they
  // already have, and that maps onto the difficulty the word pool is tagged
  // with. Each option also says which level a new account starts on.
  const [level, setLevel] = useState<CefrLevel>("A1");

  // Every language is learnable now, including English — the only one excluded
  // is whichever you just said you already speak.
  const learningOptions = LANGS.filter((option) => option !== nativeLanguage);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const stored = normalizeLang(
      window.localStorage.getItem(LANGUAGE_STORAGE_KEY),
    );
    setNativeLanguage(stored ?? detectBrowserLang() ?? language);
    setLearningLanguageChoice(null);
    setLevel("A1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Switching your native language can invalidate the learning pick (you can't
  // learn the language you just said you speak).
  const handleSetNativeLanguage = (option: Lang) => {
    setNativeLanguage(option);
    if (learningLanguage === option) {
      setLearningLanguageChoice(null);
    }
  };

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

  const handlePlay = () => {
    if (!learningLanguage) {
      return;
    }

    setLanguage(nativeLanguage);
    setLearningLanguage(learningLanguage);
    onOpenChange(false);

    if (!session?.user?.id && !hasAnonPlaysRemaining()) {
      router.push(`/login?callbackUrl=${encodeURIComponent("/")}`);
      return;
    }

    router.push(
      scoreRushHref({
        speak: nativeLanguage,
        learning: learningLanguage,
        level,
      }),
    );
  };

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-100 flex items-center justify-center overflow-y-auto p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Start playing"
    >
      <div
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      <div className="relative my-auto w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-950">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Ready to play?
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Pick your languages and level, then jump into Score Rush.
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
            label="I speak"
            value={nativeLanguage}
            onChange={handleSetNativeLanguage}
          />

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
              I want to learn
            </p>
            <div className="grid grid-cols-3 gap-2">
              {learningOptions.map((option) => {
                const active = option === learningLanguage;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setLearningLanguageChoice(option)}
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
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
              How much do you know?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {STARTING_POINTS.map((option) => {
                const active = option.difficulty === level;
                return (
                  <button
                    key={option.difficulty}
                    type="button"
                    onClick={() => setLevel(option.difficulty)}
                    className={`flex flex-col items-start gap-0.5 rounded-2xl border px-3 py-3 text-left text-xs font-semibold transition ${
                      active
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/60 dark:text-blue-300"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span>{option.label}</span>
                    <span className="text-[0.65rem] font-medium text-slate-500 dark:text-slate-400">
                      {option.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePlay}
          disabled={!learningLanguage}
          className="mt-7 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none dark:bg-blue-500 dark:hover:bg-blue-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
        >
          {learningLanguage ? "Play" : "Pick a language to learn"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
