"use client";

import { ARTICLES, hasArticles } from "@/app/_lib/articles";
import type { Lang } from "@/app/_lib/languages";

/**
 * The definite article of one deck word.
 *
 * Renders nothing for a language that has none — Czech, or a foreign-language
 * field holding free text `normalizeLang` cannot resolve — so those decks keep
 * exactly the layout they had before articles existed.
 *
 * Styled after WordCountSelect: the native chevron sits a hair low once the
 * control is padded, so it is replaced with a centred one.
 */
export default function ArticleSelect({
  lang,
  value,
  onChange,
  ariaLabel = "Article",
}: {
  lang: Lang | null;
  value: string | null;
  onChange: (article: string | null) => void;
  ariaLabel?: string;
}) {
  if (!hasArticles(lang)) {
    return null;
  }

  return (
    <span className="relative inline-flex items-center">
      <select
        aria-label={ariaLabel}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        className="w-full appearance-none rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-9 text-sm leading-5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        {/* No article is a real answer, not an empty form: verbs and adjectives
            take none, and the round has to be able to show them bare. */}
        <option value="">—</option>
        {ARTICLES[lang].map((article) => (
          <option key={article} value={article}>
            {article}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400"
      >
        <path d="M6 8l4 4 4-4" />
      </svg>
    </span>
  );
}
