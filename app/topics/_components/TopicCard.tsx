"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Crown,
  KeyRound,
  Lock,
  Sparkles,
} from "lucide-react";
import type { TopicDefinition } from "../_lib/topicsProgress";

interface TopicCardProps {
  topic: TopicDefinition;
  title: string;
  /** The topic in the user's own language, shown under the learned one. */
  subtitle?: string | null;
  description: string;
  levelCount: number;
  unlocked: boolean;
  justCompleted: boolean;
  /** Crowned by clearing the pack's review round. */
  legendary: boolean;
  href: string;
  onUnlock: () => void;
  canUnlock: boolean;
}

type TopicCardContentProps = Omit<TopicCardProps, "href">;

const themeVariants: Record<
  TopicDefinition["color"],
  {
    panel: string;
    glow: string;
    stripe: string;
    badge: string;
    progress: string;
    outline: string;
  }
> = {
  yellow: {
    panel:
      "from-amber-50 via-white to-yellow-100/75 dark:from-slate-950 dark:via-slate-950 dark:to-amber-950/40",
    glow: "bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.35),transparent_42%)]",
    stripe: "from-amber-400 via-amber-500 to-yellow-500",
    badge:
      "border-amber-200/80 bg-amber-100/80 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-200",
    progress: "bg-amber-500",
    outline: "ring-amber-300/45 dark:ring-amber-700/35",
  },
  red: {
    panel:
      "from-rose-50 via-white to-rose-100/75 dark:from-slate-950 dark:via-slate-950 dark:to-rose-950/40",
    glow: "bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.32),transparent_42%)]",
    stripe: "from-rose-400 via-red-500 to-orange-500",
    badge:
      "border-rose-200/80 bg-rose-100/80 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/60 dark:text-rose-200",
    progress: "bg-rose-500",
    outline: "ring-rose-300/45 dark:ring-rose-700/35",
  },
  blue: {
    panel:
      "from-sky-50 via-white to-blue-100/75 dark:from-slate-950 dark:via-slate-950 dark:to-sky-950/40",
    glow: "bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.32),transparent_42%)]",
    stripe: "from-sky-400 via-blue-500 to-cyan-500",
    badge:
      "border-sky-200/80 bg-sky-100/80 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/60 dark:text-sky-200",
    progress: "bg-sky-500",
    outline: "ring-sky-300/45 dark:ring-sky-700/35",
  },
  green: {
    panel:
      "from-emerald-50 via-white to-lime-100/75 dark:from-slate-950 dark:via-slate-950 dark:to-emerald-950/40",
    glow: "bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.32),transparent_42%)]",
    stripe: "from-emerald-400 via-green-500 to-lime-500",
    badge:
      "border-emerald-200/80 bg-emerald-100/80 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-200",
    progress: "bg-emerald-500",
    outline: "ring-emerald-300/45 dark:ring-emerald-700/35",
  },
};

function TopicCardContent({
  topic,
  title,
  subtitle,
  description,
  levelCount,
  unlocked,
  justCompleted,
  legendary,
  onUnlock,
  canUnlock,
}: TopicCardContentProps) {
  const theme = themeVariants[topic.color];

  return (
    <>
      <div className={`absolute inset-0 bg-linear-to-br ${theme.panel}`} />
      <div className={`absolute inset-0 ${theme.glow} opacity-100`} />
      <div className="absolute inset-x-0 top-0 h-px bg-white/80 dark:bg-white/10" />
      <div
        className={`absolute left-0 top-0 h-full w-2 bg-linear-to-b ${
          legendary
            ? "from-violet-400 via-fuchsia-500 to-amber-400"
            : theme.stripe
        }`}
      />

      {/* Legendary packs read differently at a glance: a warm violet wash and a
          shimmer that crosses the card every few seconds. */}
      {legendary && (
        <>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(167,139,250,0.35),transparent_55%)]" />
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {/* A reflection passing over glass: narrow, soft-edged, and bright
                enough to show on the black card the app ships on — at 12% white
                it was running the whole time and reading as nothing. */}
            <div className="absolute inset-y-0 w-1/4 bg-linear-to-r from-transparent via-white/70 to-transparent blur-[3px] animate-[legendaryShimmer_7s_linear_infinite] dark:via-white/30" />
          </div>
        </>
      )}

      <div className="relative flex h-full flex-col p-6 sm:p-7">
        <div className="flex flex-1 items-start justify-between gap-4">
          <div className="min-w-0">
            {legendary && (
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-violet-300/80 bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-violet-700 dark:border-violet-700/70 dark:bg-slate-950/60 dark:text-violet-300">
                <Crown size={12} />
                Legendary
              </span>
            )}
            <h2 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-[2rem]">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            )}
            <p className="mt-2 mb-2 max-w-xs text-sm leading-6 text-slate-600 dark:text-slate-300">
              {description}
            </p>
          </div>

          <div
            className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border border-white/70 bg-white/70 text-slate-900 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-950/65 dark:text-white ${theme.outline}`}
          >
            <span className="text-lg font-black leading-none">
              {levelCount}
            </span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              /5
            </span>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-950/50">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            <span>Progress</span>
            <span>{levelCount}/5 levels</span>
          </div>
          <div className="mt-3 flex gap-2">
            {Array.from({ length: 5 }, (_, index) => {
              const filled = index < levelCount;

              return (
                <div
                  key={`${topic.id}-step-${index}`}
                  className={`h-2 flex-1 rounded-full ${filled ? theme.progress : "bg-slate-200 dark:bg-slate-800"}`}
                />
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-white/70 pt-5 dark:border-slate-700/70">
          <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
            {legendary ? (
              <Crown
                size={16}
                className="shrink-0 text-violet-600 dark:text-violet-300"
              />
            ) : unlocked ? (
              <CheckCircle2 size={16} className="shrink-0" />
            ) : (
              <Lock size={16} className="shrink-0" />
            )}
            <span className="truncate">
              {legendary ? "Legendary" : unlocked ? "Ready to play" : "Locked"}
            </span>
          </div>

          {/* The label never wraps: a two-line pill next to a one-line status
              reads as a broken card rather than a button. */}
          {unlocked ? (
            <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">
              Open pack
              <ArrowRight size={16} className="shrink-0" />
            </span>
          ) : (
            <button
              type="button"
              disabled={!canUnlock}
              onClick={onUnlock}
              className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
            >
              <KeyRound size={16} className="shrink-0" />
              {canUnlock ? "Unlock with key" : "No keys yet"}
            </button>
          )}
        </div>

        {justCompleted && (
          <div className="mt-5 inline-flex w-fit items-center gap-2 rounded-full border border-amber-300/80 bg-amber-100/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200">
            <Sparkles size={12} />
            Just completed
          </div>
        )}
      </div>
    </>
  );
}

export default function TopicCard(props: TopicCardProps) {
  const { unlocked, justCompleted, legendary, topic, href, title } = props;
  const ring = legendary
    ? "ring-violet-400/70 dark:ring-violet-600/60"
    : themeVariants[topic.color].outline;
  const baseClass = `group relative overflow-hidden rounded-[2rem] border ${legendary ? "border-violet-200/80 dark:border-violet-900/70" : "border-white/70 dark:border-slate-800/70"} shadow-[0_18px_50px_rgba(15,23,42,0.14)] ring-1 ${ring} transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(15,23,42,0.18)] dark:shadow-black/30`;
  const animatedClass = justCompleted
    ? "animate-[topicPulse_1.1s_ease-in-out_3]"
    : "";

  if (unlocked) {
    return (
      <Link
        href={href}
        className={`${baseClass} ${animatedClass}`}
        aria-label={`Open ${title}`}
      >
        <TopicCardContent {...props} />
      </Link>
    );
  }

  return (
    <article className={`${baseClass} ${animatedClass}`}>
      <TopicCardContent {...props} />
    </article>
  );
}
