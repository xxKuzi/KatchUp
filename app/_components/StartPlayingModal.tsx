"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { readChosenLanguagePair, useLanguage } from "../_lib/languageContext";
import { LanguagePicker } from "./LanguageSwitcher";
import {
  detectBrowserLang,
  LANGS,
  LANG_FLAGS,
  LANG_LABELS,
  normalizeLang,
  type Lang,
} from "../_lib/languages";
import { PLACEMENT_TEST_HREF } from "../_lib/placementTest";
import { useLanguageLevels } from "../_lib/useLanguageLevels";

const LANGUAGE_STORAGE_KEY = "katchup-language";

/**
 * The two questions setting up asks, and the only two: which language you speak
 * and which one you want. How much of it you already have used to be the third,
 * and is not asked any more — it is the one thing here a test can answer better
 * than the learner can, and the placement test on the other side of this button
 * answers it for everyone now.
 *
 * There is no way out of this dialog on purpose. No close button, no Escape, no
 * click-away: every route behind it needs a language pair and a level to serve
 * anything at all, and the version of this that could be waved away left people
 * playing a language nobody chose at a level nobody measured. Leaving means
 * leaving the page, and it is put again on the way back.
 */
export default function StartPlayingModal({
  open,
  onResolved,
}: {
  open: boolean;
  /** Fired when the dialog has nothing left to ask — see the provider. */
  onResolved?: (pair: { speak: Lang; learning: Lang }) => void;
}) {
  const router = useRouter();
  const { language, setLanguage, setLearningLanguage } = useLanguage();
  const { languages } = useLanguageLevels(open);
  const [mounted, setMounted] = useState(false);
  const [nativeLanguage, setNativeLanguage] = useState<Lang>(language);
  // Deliberately unset: the learning language is the one real choice here, so
  // it must be picked rather than defaulted into something arbitrary.
  const [learningLanguage, setLearningLanguageChoice] = useState<Lang | null>(
    null,
  );

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

    // A pair already on file means this is up for the other reason: the language
    // has never been placed. Those two questions have been answered, so they
    // come back answered — and stay editable, since switching the pair is a
    // reasonable thing to do on the way into a test about it.
    const chosen = readChosenLanguagePair();
    const stored = normalizeLang(
      window.localStorage.getItem(LANGUAGE_STORAGE_KEY),
    );

    setNativeLanguage(chosen?.speak ?? stored ?? detectBrowserLang() ?? language);
    setLearningLanguageChoice(chosen?.learning ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !languages || readChosenLanguagePair()) {
      return;
    }

    const stored = normalizeLang(
      window.localStorage.getItem(LANGUAGE_STORAGE_KEY),
    );
    const native = stored ?? detectBrowserLang() ?? language;
    const existing = languages.filter(
      (standing) =>
        standing.learning !== native && standing.canBePlaced === false,
    );

    // The account already answers both questions when it has progress in one
    // learning language. Restore that language on a new browser and let its
    // saved level drive the games immediately; a returning B2 learner should
    // never have to press a button labelled "Take the placement test".
    if (existing.length === 1) {
      const learning = existing[0].learning;
      setNativeLanguage(native);
      setLearningLanguageChoice(learning);
      setLanguage(native);
      setLearningLanguage(learning);
      router.replace("/games");
    }
  }, [
    language,
    languages,
    open,
    router,
    setLanguage,
    setLearningLanguage,
  ]);

  // A dialog nothing can be done behind should not have a page scrolling behind
  // it either — otherwise the content it is blocking is still there to be read.
  useEffect(() => {
    if (!open) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Switching your native language can invalidate the learning pick (you can't
  // learn the language you just said you speak).
  const handleSetNativeLanguage = (option: Lang) => {
    setNativeLanguage(option);
    if (learningLanguage === option) {
      setLearningLanguageChoice(null);
    }
  };

  const handlePlay = () => {
    if (!learningLanguage) {
      return;
    }

    setLanguage(nativeLanguage);
    setLearningLanguage(learningLanguage);

    const standing = languages?.find(
      (entry) => entry.learning === learningLanguage,
    );

    // Accounts with existing progress have already been placed. This also
    // covers accounts with several active languages, where choosing which one
    // to restore cannot safely be automatic.
    if (standing?.canBePlaced === false) {
      // Said out loud rather than left for the onboarding status to work out on
      // its own: this is the one press that answers everything the dialog was
      // asking, and a status that disagrees would otherwise put the dialog back
      // up with the same button doing the same nothing.
      onResolved?.({ speak: nativeLanguage, learning: learningLanguage });
      router.push("/games");
      return;
    }

    // Everyone setting up a language is placed by sitting the test, signed in or
    // not: a claim of A1 is no more checkable than a claim of C1, and someone
    // who quietly knows more than they let on should be found out by the test
    // rather than started at the bottom.
    router.push(PLACEMENT_TEST_HREF);
  };

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-100 flex items-center justify-center overflow-y-auto p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Set up your languages"
    >
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" />

      <div className="relative my-auto w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-950">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          Set up your languages
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Pick the pair, then a short test places you. Do well and you start
          higher — there is no way to skip it.
        </p>

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
                const standing = languages?.find(
                  (entry) => entry.learning === option,
                );
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
                    {standing?.canBePlaced === false && (
                      <span className="text-[0.6rem] font-bold leading-none text-slate-500 dark:text-slate-400">
                        Lv {standing.level} · {standing.band}
                      </span>
                    )}
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
          className="mt-7 w-full cursor-pointer rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none dark:bg-blue-500 dark:hover:bg-blue-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
        >
          {learningLanguage
            ? languages?.find(
                (entry) => entry.learning === learningLanguage,
              )?.canBePlaced === false
              ? `Continue at ${languages.find(
                  (entry) => entry.learning === learningLanguage,
                )?.band}`
              : "Take the placement test"
            : "Pick a language to learn"}
        </button>

        {/* Not an escape hatch — a returning player with an account still has to
            get to it, and this dialog is over every page that could take them
            there. Signing in only changes where the result is recorded; the test
            is still owed on the other side. */}
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="mt-3 w-full cursor-pointer text-center text-xs font-semibold text-slate-500 underline-offset-4 transition hover:text-slate-800 hover:underline dark:text-slate-400 dark:hover:text-slate-200"
        >
          Already have an account? Sign in
        </button>
      </div>
    </div>,
    document.body,
  );
}
