"use client";

import { useEffect } from "react";
import { create } from "zustand";

/**
 * Whether a round is in progress right now.
 *
 * A round wants the whole screen: the navbar and the bottom tab bar are both
 * fixed, both sit over the play area on a phone, and both are one mistaken tap
 * away from throwing away a round that costs energy to start. So they step
 * aside while you play, and the pause button becomes the way out.
 *
 * A store rather than a context because the two ends are far apart in the tree —
 * the round is inside `children`, the chrome is above it in the root layout —
 * and passing a flag between them would mean threading it through every page.
 */
interface PlayingModeState {
  /** How many rounds are currently claiming the screen. */
  depth: number;
  enter: () => void;
  leave: () => void;
}

const usePlayingModeStore = create<PlayingModeState>((set) => ({
  depth: 0,
  enter: () => set((state) => ({ depth: state.depth + 1 })),
  leave: () => set((state) => ({ depth: Math.max(0, state.depth - 1) })),
}));

/** Reads whether the chrome should be out of the way. */
export function useIsPlaying(): boolean {
  return usePlayingModeStore((state) => state.depth > 0);
}

/**
 * Claims the screen for as long as `active` holds, releasing it on unmount.
 *
 * Counted rather than a plain boolean so that a page navigating straight into
 * another round — React mounts the next one before unmounting the last — never
 * flashes the navbar back in between the two.
 */
export function usePlayingMode(active: boolean): void {
  useEffect(() => {
    if (!active) {
      return;
    }

    const { enter, leave } = usePlayingModeStore.getState();
    enter();
    return leave;
  }, [active]);
}
