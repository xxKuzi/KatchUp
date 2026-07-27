"use client";

import GamePage from "./GamePage";

/** Which board's silhouette to draw while its words are on the way. */
export type DeckLoadingVariant = "cards" | "quiz" | "type" | "match";

/**
 * Loading state for the word games.
 *
 * The generic status card in DeckMessage is a small centered box, so the play
 * panel started short and then jumped to full height the moment the words
 * landed. This draws the board's own silhouette instead, inside the same outer
 * window and at the same size — so every game settles into its final layout
 * before there is anything to show in it.
 *
 * Used on both paths: a deck session still loading, and a deck-less round
 * waiting on the corpus.
 */
export default function DeckLoading({
  name,
  description,
  bgImage,
  variant = "cards",
  label = "Loading words…",
}: {
  name: string;
  description: string;
  bgImage: string;
  variant?: DeckLoadingVariant;
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
        {variant === "cards" && <CardsSkeleton />}
        {variant === "quiz" && <QuizSkeleton />}
        {variant === "type" && <TypeSkeleton />}
        {variant === "match" && <MatchSkeleton />}
      </div>
    </GamePage>
  );
}

const block = "rounded bg-zinc-200 dark:bg-zinc-800";

/**
 * The panel the three quiz-style games share: a coloured header over a white
 * card. Only the copy inside the header is pending, so the gradient stays.
 */
function Panel({
  header,
  children,
}: {
  header: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-3xl animate-pulse overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
      <div className={`p-5 ${header}`}>
        <div className="h-4 w-24 rounded bg-white/50" />
        <div className="mt-2 h-8 w-56 rounded bg-white/50" />
        <div className="mt-2 h-5 w-28 rounded bg-white/50" />
        <div className="mt-2 h-2 rounded-full bg-white/50" />
      </div>
      <div className="p-6 sm:p-8">{children}</div>
    </div>
  );
}

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

/** One of Three: a prompt over three answer buttons. */
function QuizSkeleton() {
  return (
    <Panel header="bg-linear-to-r from-amber-300 via-orange-300 to-rose-300 dark:from-amber-700 dark:via-orange-700 dark:to-rose-700">
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
    </Panel>
  );
}

/** Speed Spelling: the timed prompt, then the input and its Check button. */
function TypeSkeleton() {
  return (
    <Panel header="bg-linear-to-r from-sky-300 via-cyan-300 to-teal-300 dark:from-sky-700 dark:via-cyan-700 dark:to-teal-700">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center dark:border-slate-800 dark:bg-slate-900/70">
        <div className={`mx-auto h-4 w-24 ${block}`} />
        <div className="mx-auto mt-2 h-1.5 w-full max-w-xs rounded-full bg-slate-200 dark:bg-slate-800" />
        <div className={`mx-auto mt-4 h-4 w-32 ${block}`} />
        <div className={`mx-auto mt-2 h-10 w-52 ${block}`} />
      </div>

      <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row">
        <div className="h-13.5 w-full flex-1 rounded-2xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900" />
        <div className="h-13 w-full rounded-2xl bg-zinc-200 dark:bg-zinc-800 sm:w-24" />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className={`h-5 w-40 ${block}`} />
        <div className={`h-6 w-36 ${block}`} />
      </div>
    </Panel>
  );
}

/** Word Pairing: two columns of tiles, one word per side. */
function MatchSkeleton() {
  return (
    <Panel header="bg-linear-to-r from-emerald-300 via-teal-300 to-cyan-300 dark:from-emerald-700 dark:via-teal-700 dark:to-cyan-700">
      <div className={`mx-auto mb-4 h-4 w-56 ${block}`} />
      <div className="grid grid-cols-2 gap-4">
        {["left", "right"].map((side) => (
          <div key={side} className="space-y-2">
            {[0, 1, 2, 3, 4, 5].map((key) => (
              <div
                key={key}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
              />
            ))}
          </div>
        ))}
      </div>
    </Panel>
  );
}
