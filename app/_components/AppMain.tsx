"use client";

import type { ReactNode } from "react";
import { useIsPlaying } from "../_lib/playingMode";

/**
 * The page slot, with the room the fixed bottom tab bar needs below it.
 *
 * A client component only so it can drop that room while a round is playing:
 * the tab bar hides itself then, and the padding it left behind would show up as
 * a strip of dead space under the game.
 */
export default function AppMain({ children }: { children: ReactNode }) {
  const isPlaying = useIsPlaying();

  return (
    <main className={isPlaying ? "" : "pb-20 lg:pb-0"}>{children}</main>
  );
}
