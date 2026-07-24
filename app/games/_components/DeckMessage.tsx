"use client";

import Link from "next/link";
import GamePage from "./GamePage";

export interface DeckMessageProps {
  name: string;
  description: string;
  bgImage: string;
  title: string;
  body?: string;
  backHref?: string;
  action?: { label: string; onClick: () => void };
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
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Back to decks
            </Link>
          )}
        </div>
      </div>
    </GamePage>
  );
}
