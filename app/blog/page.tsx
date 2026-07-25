import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Clock } from "lucide-react";
import { BLOG_ARTICLES, TOPIC_META } from "./_lib/articles";

export const metadata: Metadata = {
  title: "Blog — KatchUp",
  description:
    "Tips, guides, and habits for learning English, German, and Spanish.",
};

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-background px-6 pb-24 pt-6 text-foreground sm:px-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="first-section-static-glow md:mb-10 mb-4 rounded-2xl border border-slate-200 bg-white/90 p-6 dark:border-slate-800 dark:bg-slate-950/70 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Blog
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100 sm:text-4xl">
            Learning Tips &amp; Language Notes
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
            Short, practical articles about learning English, German, and
            Spanish — habits, grammar shortcuts, and common mistakes worth
            fixing early.
          </p>
        </section>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {BLOG_ARTICLES.map((article) => {
            const meta = TOPIC_META[article.topic];

            return (
              <Link
                key={article.slug}
                href={`/blog/${article.slug}`}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-950/70 dark:hover:border-slate-700"
              >
                <div
                  className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${meta.color}`}
                >
                  <span>{meta.flag}</span>
                  {meta.label}
                </div>

                <h2 className="mt-4 text-lg font-bold leading-snug text-slate-900 dark:text-slate-100">
                  {article.title}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {article.excerpt}
                </p>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={13} />
                    {article.readTime}
                  </span>
                  <span className="inline-flex items-center gap-1 text-slate-700 transition group-hover:gap-2 dark:text-slate-200">
                    Read
                    <ArrowRight size={14} />
                  </span>
                </div>
              </Link>
            );
          })}
        </section>
      </div>
    </div>
  );
}
