import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import { BLOG_ARTICLES, TOPIC_META, getArticleBySlug } from "../_lib/articles";

export function generateStaticParams() {
  return BLOG_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    return { title: "Blog — KatchUp" };
  }

  return {
    title: `${article.title} — KatchUp Blog`,
    description: article.excerpt,
  };
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const meta = TOPIC_META[article.topic];
  const related = BLOG_ARTICLES.filter(
    (item) => item.topic === article.topic && item.slug !== article.slug,
  );

  return (
    <div className="min-h-screen bg-background px-6 pb-24 pt-6 text-foreground sm:px-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <Link
          href="/blog"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft size={15} />
          Back to blog
        </Link>

        <article className="rounded-2xl border border-slate-200 bg-white/90 p-6 dark:border-slate-800 dark:bg-slate-950/70 sm:p-10">
          <div
            className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${meta.color}`}
          >
            <span>{meta.flag}</span>
            {meta.label}
          </div>

          <h1 className="mt-4 text-2xl font-bold leading-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            {article.title}
          </h1>

          <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            <Clock size={13} />
            {article.readTime}
          </div>

          <div className="mt-8 flex flex-col gap-8">
            {article.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {section.heading}
                </h2>
                <div className="mt-3 flex flex-col gap-3">
                  {section.body.map((paragraph, index) => (
                    <p
                      key={index}
                      className="text-sm leading-relaxed text-slate-600 dark:text-slate-300"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </article>

        {related.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              More on {meta.label}
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {related.map((item) => (
                <Link
                  key={item.slug}
                  href={`/blog/${item.slug}`}
                  className="group rounded-2xl border border-slate-200 bg-white/90 p-5 text-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-950/70 dark:hover:border-slate-700"
                >
                  <p className="font-bold text-slate-900 dark:text-slate-100">
                    {item.title}
                  </p>
                  <p className="mt-1.5 text-slate-600 dark:text-slate-300">
                    {item.excerpt}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
