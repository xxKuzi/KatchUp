"use client";
import GameCard from "./../_components/GameCard";
import Carousel from "./../_components/GameCarousel";
import { TrendingUpDown, Star } from "lucide-react";
import FeatureGate from "@/app/_components/FeatureGate";
import { useAuthState } from "@/app/_lib/auth";
import { useLanguage } from "@/app/_lib/languageContext";

export default function Games() {
  const { isSignedIn, isReady } = useAuthState();
  const { t } = useLanguage();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background font-sans text-foreground">
      <FeatureGate
        isAllowed={isReady && isSignedIn}
        message={t(
          "authGate.games",
          "Your game streak and wins are saved for friends. Sign in to unlock game arena.",
        )}
        className="w-full"
      >
        <main className="flex min-h-screen w-full flex-col items-center bg-background px-6 pb-24 pt-10 sm:px-10 lg:px-16">
          <section className="first-section-static-glow w-full max-w-6xl rounded-3xl border border-white/90 bg-white/80 p-8 backdrop-blur ring-1 ring-white/70 dark:border-slate-600 dark:bg-slate-950/70  dark:ring-white/10 md:p-10">
            <p className="inline-flex rounded-full border border-blue-300/70 bg-blue-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
              Online Games
            </p>

            <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100 sm:text-6xl">
              Pick a game and jump in.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:text-lg">
              Practice vocabulary with fast rounds, live competition, and
              adaptive challenge levels. Everything here is built to feel like
              play, not homework.
            </p>
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
      </FeatureGate>
    </div>
  );
}
