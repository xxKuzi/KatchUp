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
import { ONBOARDING_ROUND_HREF } from "../games/_lib/onboardingRound";
import {
  readSelfReportedLevel,
  saveSelfReportedLevel,
} from "../_lib/selfReportedLevel";

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

  const signedIn = Boolean(session?.user?.id);
  // Asked of a visitor, never of a player. A level is earned — by mastering its
  // words or passing its test, one at a time — so a signed-in account cannot be
  // handed a band for saying so. The free round can ask because nothing rides on
  // the answer there: it only picks that round's words, and it grades the claim
  // on the way out. Asking someone with an account would be collecting an answer
  // there is no honest way to use.
  const askLevel = !signedIn;

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
    // A visitor who played a round and came back has had their claim graded
    // against it, and reopening this on "Just starting" would throw that away
    // and invite the same overshoot again.
    setLevel(readSelfReportedLevel() ?? "A1");
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

    // A player who was only missing a language pair has one now, and their level
    // is already whatever their account has earned. Nothing to grade and no free
    // round to spend, so they go to the games rather than through onboarding.
    if (signedIn) {
      router.push("/games");
      return;
    }

    // The round is built from this, and grades it — so it has to be on record
    // before the round starts, not just carried in the link.
    saveSelfReportedLevel(level);

    if (!hasAnonPlaysRemaining()) {
      router.push(`/login?callbackUrl=${encodeURIComponent("/")}`);
      return;
    }

    router.push(ONBOARDING_ROUND_HREF);
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
              {askLevel ? "Ready to play?" : "Which languages?"}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {askLevel
                ? "Pick your languages and level, then jump into your first round."
                : "We never asked you this. Set it now and your level carries on from where it is."}
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

          {askLevel && (
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
          )}
        </div>

        <button
          type="button"
          onClick={handlePlay}
          disabled={!learningLanguage}
          className="mt-7 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none dark:bg-blue-500 dark:hover:bg-blue-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
        >
          {!learningLanguage
            ? "Pick a language to learn"
            : askLevel
              ? "Play"
              : "Save and continue"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
