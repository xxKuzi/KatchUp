"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import {
  LEVELS_PER_BAND,
  LEVEL_TEST_PASS_RATIO,
  MAX_LEVEL,
} from "../_lib/level";
import { LANG_LABELS, type Lang } from "../_lib/languages";
import { headStartWords, useLearningLevelState } from "../_lib/useLearningLevel";

/**
 * The navbar's level chip. Collapsed it's just the number — that's the thing
 * being climbed, and the only thing worth glancing at. Open it names the CEFR
 * band the number sits in and how far through that band's ten levels you are,
 * says what this level costs in words, and offers the test for the next level
 * up. The band is read-only: the test only ever moves you one level.
 */
export default function LevelBadge({
  learningLanguage,
  isHomePage = false,
}: {
  learningLanguage: Lang;
  isHomePage?: boolean;
}) {
  const router = useRouter();
  const levelState = useLearningLevelState(learningLanguage);
  const { level, status } = levelState;
  // Ground the placement handed over rather than ground that was covered. The
  // level is honestly theirs — it is what the test said — but the words behind
  // it were never studied, so they are counted apart from the ones that were.
  const headStart = headStartWords(levelState);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Signed out there is nothing to show; a failed request likewise stays quiet
  // rather than putting a broken chip in the navbar.
  if (status === "signedOut" || status === "error") {
    return null;
  }

  // Hold the chip's space while the level loads, so the navbar doesn't jump
  // once it arrives.
  if (!level) {
    return (
      <div
        aria-hidden
        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-sm font-bold opacity-40 shadow-sm ${
          isHomePage
            ? "border-slate-700/80 bg-slate-900/80 text-slate-400"
            : "border-slate-300/80 bg-white/80 text-slate-400 dark:border-slate-700 dark:bg-slate-900/80"
        }`}
      >
        <Star className="h-4 w-4" />
        <span className="leading-none">--</span>
      </div>
    );
  }

  const levelCost =
    level.nextLevelAt === null ? null : level.nextLevelAt - level.levelStart;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={`${LANG_LABELS[learningLanguage]} level ${level.level}`}
        title={`${LANG_LABELS[learningLanguage]} · Level ${level.level}`}
        className={`inline-flex cursor-pointer items-center gap-1 rounded-lg border px-2 py-1.5 text-sm font-bold shadow-sm transition hover:scale-105 ${
          isHomePage
            ? "border-blue-400/40 bg-blue-400/10 text-blue-200"
            : "border-blue-400/60 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300"
        }`}
      >
        <Star className="h-4 w-4 fill-current" />
        <span className="tabular-nums leading-none">{level.level}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-[120%] z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white/95 p-4 text-sm text-slate-700 shadow-2xl backdrop-blur-xl dark:border-slate-700 dark:bg-slate-950/95 dark:text-slate-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              {LANG_LABELS[learningLanguage]}
            </p>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
              {level.level} / {MAX_LEVEL}
            </span>
          </div>

          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-2xl font-black text-blue-600 dark:text-blue-400">
              Level {level.level}
            </p>
            {/* The band, for reference only. It reads out where the number has
                got you in English-teaching terms; there is nothing to press,
                because a band is not somewhere you can go — see below. */}
            <span
              title={`Levels ${level.band.startLevel}-${level.band.endLevel} are ${level.band.band}`}
              className="rounded-md border border-slate-300 px-1.5 py-0.5 text-xs font-bold tracking-wide text-slate-600 dark:border-slate-700 dark:text-slate-300"
            >
              {level.band.band}
            </span>
          </div>

          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            {levelState.knownWords ?? level.masteredCount} words mastered
            {level.nextLevelAt !== null &&
              ` · next level at ${level.nextLevelAt}`}
          </p>

          <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            Level {level.band.levelsIntoBand} of {LEVELS_PER_BAND} in{" "}
            <span className="font-bold text-slate-700 dark:text-slate-200">
              {level.band.band}
            </span>
            {level.band.nextBand !== null && (
              <>
                {" "}
                — {level.band.levelsToNextBand} more{" "}
                {level.band.levelsToNextBand === 1 ? "level" : "levels"} to
                reach {level.band.nextBand}.
              </>
            )}
          </p>

          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300 dark:bg-blue-400"
              style={{ width: `${Math.round(level.fraction * 100)}%` }}
            />
          </div>

          {/* The bar only ever measures the level you are standing in, so the
              skipped words cannot be drawn into it — they are the levels
              underneath it, already behind you. Named here instead, so the
              number is accounted for rather than quietly folded into progress
              nobody made. */}
          {(levelCost !== null || headStart > 0) && (
            <p className="mt-1.5 text-[0.7rem] font-semibold text-slate-400 dark:text-slate-500">
              {levelCost !== null &&
                `${level.wordsIntoLevel} / ${levelCost} words into this level`}
              {levelCost !== null && headStart > 0 && " · "}
              {headStart > 0 && `${headStart} skipped with the initial test`}
            </p>
          )}

          <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
            {level.isMaxLevel ? (
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Level {MAX_LEVEL} — the top of the ladder. Keep the streak
                going!
              </p>
            ) : (
              <>
                {/* One level, never a band. The test grades the level directly
                    above this one and promotes by exactly that — the way into a
                    band is to climb every level below it. */}
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {level.wordsToNextLevel} more mastered{" "}
                  {level.wordsToNextLevel === 1 ? "word" : "words"} gets you to
                  level {level.level + 1} — or earn it now by passing the level{" "}
                  {level.level + 1} test with{" "}
                  {Math.round(LEVEL_TEST_PASS_RATIO * 100)}%.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    router.push("/level-test");
                  }}
                  className="mt-3 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
                >
                  Take the level {level.level + 1} test
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
