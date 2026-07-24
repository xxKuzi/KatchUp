"use client";
import GameCard from "./../_components/GameCard";
import Carousel from "./../_components/GameCarousel";
import { TrendingUpDown, Star } from "lucide-react";
import { useLanguage } from "@/app/_lib/languageContext";

export default function Games() {
  const { t } = useLanguage();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background font-sans text-foreground">
      <main className="flex min-h-screen w-full flex-col items-center bg-background px-6 pb-24 pt-6 sm:px-10 lg:px-16">
        <section className="relative w-full max-w-6xl py-12 md:py-16 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8">
          {/* Subtle decorative glow in background */}
          <div className="absolute -left-10 -top-10 -z-10 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl dark:bg-blue-600/5" />
          <div className="absolute left-1/3 top-10 -z-10 h-64 w-64 rounded-full bg-indigo-500/5 blur-3xl dark:bg-indigo-600/5" />

          {/* Left Column (Content) */}
          <div className="flex-1 text-left w-full">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse" />
              Online Games
            </span>

            <h1 className="mt-6 text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
              Pick a game{" "}
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400 whitespace-nowrap">
                and jump in.
              </span>
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:text-lg">
              Practice vocabulary with fast rounds, live competition, and
              adaptive challenge levels. Everything here is built to feel like
              play, not homework.
            </p>
          </div>

          {/* Right Column (Mascot) */}
          <div className="flex items-center justify-center md:justify-end w-full md:w-auto shrink-0">
            {/* Mascot Container with entry and hover animations */}
            <div className="animate-mascot-appear relative h-36 w-36 sm:h-44 sm:w-44 md:h-48 md:w-48 lg:h-56 lg:w-56">
              <img
                src="/katchup_mascot.png"
                alt="KatchUp Mascot"
                className="h-full w-full object-contain animate-float-slow select-none pointer-events-none"
              />
            </div>
          </div>
        </section>

        <section className="mt-12 w-full max-w-6xl">
          <h2 className="mb-8 flex items-center gap-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
            <span>Top picks</span>
            <Star className="h-7 w-7" />
          </h2>

          <div className="rounded-3xl border border-white/90 bg-white/85 p-6 shadow-lg shadow-black/15 ring-1 ring-white/70 dark:border-slate-600 dark:bg-slate-900/70 dark:shadow-slate-950/25 dark:ring-white/10 sm:p-8">
            <div className="flex w-full flex-wrap items-center justify-center gap-6 lg:gap-16">
              <GameCard
                name="Flip Cards"
                url="/games/flip-cards"
                img="flip_cards.png"
                color="yellow"
                description="Race to 10 correct"
                feature="live"
                featureColor="green"
              />
              <GameCard
                name="One of Three"
                url="/games/one-of-three"
                img="one_of_three.png"
                color="red"
                description="Quick choice rounds"
                feature="popular"
                featureColor="blue"
              />
            </div>
          </div>
        </section>

        <section className="mt-14 w-full max-w-6xl">
          <div className="mb-8 flex items-center gap-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
            <span>Explore more</span>
            <TrendingUpDown className="h-7 w-7" />
          </div>
          <div className="rounded-3xl border border-white/90 bg-white/85 p-6 shadow-lg shadow-black/15 ring-1 ring-white/70 dark:border-slate-600 dark:bg-slate-900/70 dark:shadow-slate-950/25 dark:ring-white/10 sm:p-8">
            <Carousel />
          </div>
        </section>
      </main>
    </div>
  );
}
