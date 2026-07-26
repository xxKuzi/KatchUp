"use client";

import GamePage from "./GamePage";

/**
 * Loading state for the deck-session games.
 *
 * The generic status card in DeckMessage is a small centered box, so the play
 * panel started short and then jumped to full height the moment the session
 * landed. This draws the board's own silhouette instead, inside the same outer
 * window, and both variants reserve the same minimum height — so flip-cards and
 * one-of-three settle at their final size before the words arrive.
 */
export default function DeckLoading({
  name,
  description,
  bgImage,
  variant = "cards",
  label = "Loading deck…",
}: {
  name: string;
  description: string;
  bgImage: string;
  /** "cards" mirrors the flip-cards stack, "quiz" the one-of-three panel. */
  variant?: "cards" | "quiz";
  label?: string;
}) {
  return (
    <GamePage name={name} description={description} bgImage={bgImage}>
      <div
        className="flex min-h-130 w-full flex-col items-center"
        role="status"
        aria-live="polite"
      >
        <span className="sr-only">{label}</span>
        {variant === "cards" ? <CardsSkeleton /> : <QuizSkeleton />}
      </div>
    </GamePage>
  );
}

const block = "rounded bg-zinc-200 dark:bg-zinc-800";

function CardsSkeleton() {
  return (
    <div className="w-full animate-pulse">
      {/* Deck name + the known/left/still-learning row and its bar. */}
      <div className="mx-auto w-full max-w-xl">
        <div className={`mx-auto h-5 w-48 ${block}`} />
        <div className="mt-5 flex items-center justify-between">
          <div className={`h-4 w-20 ${block}`} />
          <div className={`h-4 w-14 ${block}`} />
          <div className={`h-4 w-28 ${block}`} />
        </div>
        <div className="mt-2 h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-700" />
      </div>

      {/* The card stack, at the height of a real card. The margins here fold in
          the gap-4 GamePage puts between the board's siblings — the skeleton is
          one element, so it doesn't get those gaps for free. */}
      <div className="relative mt-10 flex h-80 w-full max-w-sm items-center justify-center mx-auto">
        <div className="absolute h-72 w-full scale-95 rounded-3xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/60" />
        <div className="absolute h-72 w-full rounded-3xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900" />
      </div>

      <div className={`mx-auto mt-6 h-4 w-56 ${block}`} />

      {/* The two verdict buttons. */}
      <div className="mt-8 flex items-start justify-center gap-10">
        {[0, 1].map((key) => (
          <div key={key} className="flex w-20 flex-col items-center gap-2">
            <div className="h-16 w-16 rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <div className={`h-3 w-16 ${block}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function QuizSkeleton() {
  return (
    <div className="w-full max-w-3xl animate-pulse overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
      {/* The coloured header keeps its gradient so only the copy is pending. */}
      <div className="bg-linear-to-r from-amber-300 via-orange-300 to-rose-300 p-5 dark:from-amber-700 dark:via-orange-700 dark:to-rose-700">
        <div className="h-4 w-24 rounded bg-white/50" />
        <div className="mt-2 h-8 w-56 rounded bg-white/50" />
        <div className="mt-2 h-5 w-28 rounded bg-white/50" />
        <div className="mt-2 h-2 rounded-full bg-white/50" />
      </div>

      <div className="p-6 sm:p-8">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/70">
          <div className={`mx-auto h-4 w-40 ${block}`} />
          <div className={`mx-auto mt-2 h-10 w-52 ${block}`} />
        </div>

        <div className="mt-5 grid gap-3">
          {[0, 1, 2].map((key) => (
            <div
              key={key}
              className="h-13 w-full rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className={`h-5 w-40 ${block}`} />
          <div className={`h-6 w-36 ${block}`} />
        </div>
      </div>
    </div>
  );
}
