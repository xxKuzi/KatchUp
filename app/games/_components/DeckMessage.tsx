"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import GamePage from "./GamePage";
import { PACK_COMPLETE_BUTTON_CLASS } from "./PackKeyCelebration";

export interface DeckMessageProps {
  name: string;
  description: string;
  bgImage: string;
  title: string;
  body?: string;
  backHref?: string;
  /** Label for the back link; defaults to "Back to decks". */
  backLabel?: string;
  /**
   * Dresses the back link as the way to a finished pack's key — the same gold
   * button the results screens use, since from here it is the same journey.
   */
  highlightBack?: boolean;
  action?: { label: string; onClick: () => void };
  /** Extra controls under the buttons, e.g. a second way to earn energy. */
  extra?: ReactNode;
}

/** Shared full-screen status card for the deck-session games (loading, sign-in,
 * empty, not found). */
export default function DeckMessage(props: DeckMessageProps) {
  return (
    <GamePage
      name={props.name}
      description={props.description}
      bgImage={props.bgImage}
    >
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-950">
        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
          {props.title}
        </h2>
        {props.body && (
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            {props.body}
          </p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          {props.action && (
            <button
              type="button"
              onClick={props.action.onClick}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              {props.action.label}
            </button>
          )}
          {props.backHref && (
            <Link
              href={props.backHref}
              className={
                props.highlightBack
                  ? `${PACK_COMPLETE_BUTTON_CLASS} inline-flex items-center gap-2`
                  : "rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              }
            >
              {props.highlightBack && (
                <>
                  <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-white/40 blur-md animate-[legendaryShimmer_2.6s_linear_infinite]" />
                  <KeyRound size={16} />
                </>
              )}
              {props.backLabel ?? "Back to decks"}
            </Link>
          )}
        </div>
        {props.extra && <div className="mt-4">{props.extra}</div>}
      </div>
    </GamePage>
  );
}
