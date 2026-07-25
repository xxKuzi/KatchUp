"use client";
import Carousel from "./../_components/GameCarousel";
import GameBanner from "./../_components/GameBanner";
import { TrendingUpDown, Star } from "lucide-react";
import { useLanguage } from "@/app/_lib/languageContext";

export default function Games() {
  const { t } = useLanguage();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background font-sans text-foreground">
      <main className="flex min-h-screen w-full flex-col items-center bg-background px-6 pb-24 pt-6 sm:px-10 lg:px-16">
        <section className="relative w-full max-w-6xl overflow-hidden py-14 md:py-20">
          {/* Decorative glow / mesh background */}
          <div className="absolute -left-16 -top-16 -z-10 h-80 w-80 rounded-full bg-blue-500/15 blur-3xl dark:bg-blue-600/10" />
          <div className="absolute right-0 top-4 -z-10 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl dark:bg-purple-600/10" />
          <div className="absolute left-1/2 bottom-0 -z-10 h-56 w-56 -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl dark:bg-indigo-600/10" />

          {/* Floating decorative emojis */}
          <span className="animate-float-medium absolute left-4 top-6 -z-10 hidden text-4xl opacity-70 sm:block md:left-10">
            🎯
          </span>
          <span className="animate-float-fast absolute right-6 top-2 -z-10 hidden text-3xl opacity-60 sm:block md:right-16">
            ⚡
          </span>
          <span className="animate-float-slow absolute bottom-4 left-1/4 -z-10 hidden text-3xl opacity-50 sm:block">
            🏆
          </span>

          <div className="flex flex-col items-center text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse" />
              Online Games
            </span>

            <h1 className="mt-6 max-w-3xl text-4xl font-black leading-tight tracking-tight text-slate-900 dark:text-white sm:text-6xl lg:text-7xl">
              Learn words{" "}
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400">
                by playing.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:text-lg">
              Practice vocabulary with fast rounds, live competition, and
              adaptive challenge levels. Everything here is built to feel like
              play, not homework.
            </p>

            {/* Mascot with speech bubble */}
            <div className="animate-mascot-appear relative mt-10 flex flex-col items-center">
              <div className="relative mb-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-md ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
                Ready to play? 👋
                <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-white dark:bg-slate-800" />
              </div>
              <img
                src="/katchup_maskot_original.png"
                alt="KatchUp Mascot"
                className="h-48 w-48 select-none object-contain animate-float-mascot pointer-events-none sm:h-60 sm:w-60 md:h-72 md:w-72"
              />
            </div>
          </div>
        </section>

        <section className="mt-12 w-full max-w-6xl">
          <h2 className="mb-8 flex items-center gap-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
            <span>Top picks - online</span>
            <Star className="h-7 w-7" />
          </h2>

          <div className="flex flex-col gap-8">
            <GameBanner
              name="Live Duel "
              url="/games/choose-one-multiplayer"
              img="flip_cards.png"
              tagline="Live 1v1 · Race to 10"
              description="Go head-to-head with another player in real time. Pick the right translation faster than your rival - first to 10 correct answers wins. No one online? Duel the bot instead."
              gradient="from-blue-900/90 via-blue-900/40"
            />
            <GameBanner
              name="Score Rush"
              url="/games/score-rush"
              img="one_of_three.png"
              tagline="30 Seconds · Speed & Accuracy"
              description="You against the clock. Answer as many translations as you can in 30 seconds, then push your score onto the leaderboard."
              gradient="from-red-700/90 via-yellow-900/40"
            />
          </div>
        </section>

        <section className="sm:mt-20 mt-14 w-full max-w-6xl">
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
