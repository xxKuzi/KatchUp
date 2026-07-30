"use client";

import React from "react";
import { usePlayingMode } from "@/app/_lib/playingMode";
import PauseMenu from "./PauseMenu";

interface GamePageProps {
  name: string;
  description: string;
  bgImage: string;
  children: React.ReactNode;
  heroFirst?: boolean;
  /**
   * True while a round is actually being played, as opposed to the loading,
   * sign-in and results screens that share this shell. Hides the app chrome and
   * puts a pause button in its place.
   */
  playing?: boolean;
  /** Where the pause menu's "Exit" goes. Required once `playing` is set. */
  exitHref?: string;
  /** Restarts the round from the pause menu, where the game can. */
  onRestart?: () => void;
  /** Told when the pause menu opens and closes, for games with a clock. */
  onPauseChange?: (paused: boolean) => void;
}

export default function GamePage(props: GamePageProps) {
  const {
    name,
    description,
    bgImage,
    children,
    heroFirst = false,
    playing = false,
    exitHref = "/games",
    onRestart,
    onPauseChange,
  } = props;

  usePlayingMode(playing);

  const normalizedBgImage = bgImage.startsWith("/") ? bgImage : `/${bgImage}`;
  const hero = (
    <section
      style={{ backgroundImage: `url('${normalizedBgImage}')` }}
      className="relative overflow-hidden rounded-2xl border border-white/20 bg-cover bg-center px-6 py-10 text-white shadow-lg"
    >
      <div className="absolute inset-0 bg-linear-to-r from-black/75 to-black/30" />
      <div className="relative z-10 max-w-2xl">
        <h1 className="text-3xl font-bold sm:text-5xl">{name}</h1>
        <p className="mt-3 text-sm text-zinc-100 sm:text-base">{description}</p>
      </div>
    </section>
  );

  return (
    // The root layout normally renders the Navbar and the spacer that clears the
    // fixed bar, so this only lays out the page below it. While playing the bar
    // is gone, and `app-playing-top-gap` puts back exactly the room its spacer
    // was holding — same numbers, same breakpoint — so starting a round doesn't
    // shift the page a pixel.
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div
        className={`mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-10 sm:px-8 ${
          playing ? "app-playing-top-gap" : ""
        }`}
      >
        {heroFirst && hero}

        <section className="relative flex flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          {playing && (
            <PauseMenu
              exitHref={exitHref}
              onRestart={onRestart}
              onPauseChange={onPauseChange}
            />
          )}
          {children}
        </section>

        {!heroFirst && hero}
      </div>
    </div>
  );
}
