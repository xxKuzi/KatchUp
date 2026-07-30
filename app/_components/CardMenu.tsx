"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreVertical } from "lucide-react";

/**
 * The "…" menu in the corner of a card.
 *
 * Exists so a card can carry the actions that matter occasionally — sharing,
 * downloading — without spending a button on each of them next to the one action
 * people came for. The trigger stays in a fixed corner so it lands in the same
 * place on every card in a grid.
 *
 * Children are the menu's contents, laid out as a column; `MenuItem` below is
 * the button shape they should use.
 */
export default function CardMenu({
  label = "More actions",
  children,
  className = "",
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent | MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        // Closes on any click inside: every item here either navigates or opens
        // a dialog, so leaving the menu standing behind it is never wanted.
        <div
          role="menu"
          onClick={() => setOpen(false)}
          className="absolute right-0 top-full z-30 mt-1 flex w-56 flex-col gap-0.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** One row in a `CardMenu`. */
export function MenuItem({
  onClick,
  disabled = false,
  tone = "default",
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === "danger"
          ? "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
          : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
}
