"use client";

/**
 * A topic card with the progress left blank.
 *
 * Shown while a too-old stored ladder is being replaced by the account's copy:
 * the pack's name and blurb are fixed, so they stay — only the parts that would
 * be wrong (levels cleared, locked or not, the crown) wait for the answer.
 */
export default function TopicCardSkeleton({
  title,
  subtitle,
  description,
}: {
  title: string;
  subtitle?: string | null;
  description: string;
}) {
  return (
    <article
      aria-busy
      className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/70 shadow-[0_18px_50px_rgba(15,23,42,0.14)] ring-1 ring-slate-200/60 dark:border-slate-800/70 dark:bg-slate-950/50 dark:shadow-black/30 dark:ring-slate-800/60"
    >
      <div className="absolute left-0 top-0 h-full w-2 animate-pulse bg-slate-200 dark:bg-slate-800" />

      <div className="relative flex h-full flex-col p-6 sm:p-7">
        <div className="flex flex-1 items-start justify-between gap-4">
          <div className="min-w-0">
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

          <div className="h-16 w-16 shrink-0 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        </div>

        <div className="mt-6 rounded-3xl border border-white/70 bg-white/70 p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-950/50">
          <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="mt-3 flex gap-2">
            {Array.from({ length: 5 }, (_, index) => (
              <div
                key={index}
                className="h-2 flex-1 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800"
              />
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/70 pt-5 dark:border-slate-700/70">
          <div className="h-4 w-32 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="h-10 w-32 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
    </article>
  );
}
