"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, RotateCcw, LogOut } from "lucide-react";

interface PauseMenuProps {
  /** Where "Exit" goes. */
  exitHref: string;
  /** Starts the round over. Omitted when the game has nothing to restart. */
  onRestart?: () => void;
  /**
   * Called when the menu opens and closes, so a game with a running clock can
   * hold it while the player is away. Games without one can ignore it — the
   * overlay already blocks every control underneath.
   */
  onPauseChange?: (paused: boolean) => void;
}

/**
 * The round's own way out, now that the navbar steps aside while you play.
 *
 * Everything the chrome used to offer mid-round is here: carry on, start over,
 * or leave. It sits in the top-right corner of the play area rather than
 * floating over the viewport, so it lands in the same place on a phone as on a
 * desktop and never covers the round's first line of text.
 */
export default function PauseMenu(props: PauseMenuProps) {
  const { exitHref, onRestart, onPauseChange } = props;
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    onPauseChange?.(open);
  }, [open, onPauseChange]);

  // Escape is the pause key everywhere else; it closes an open menu too, so the
  // one key both stops and resumes the round.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen((value) => !value);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Pause"
        className="absolute right-3 top-3 z-30 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white/90 text-slate-700 shadow-md backdrop-blur transition hover:scale-105 hover:bg-white dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:bg-slate-900"
      >
        <Pause className="h-5 w-5" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Paused"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-xs rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
              Paused
            </h2>

            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                <Play className="h-4 w-4" />
                Resume
              </button>

              {onRestart && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onRestart();
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <RotateCcw className="h-4 w-4" />
                  Restart
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push(exitHref);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-300 px-4 py-3 text-sm font-bold text-rose-600 transition hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/40"
              >
                <LogOut className="h-4 w-4" />
                Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
