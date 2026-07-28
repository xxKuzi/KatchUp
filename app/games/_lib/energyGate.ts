"use client";

import { useState } from "react";
import { useAuthState } from "@/app/_lib/auth";
import { useEnergyState } from "@/app/_lib/energy";

/**
 * Whether this player has run out of the day's energy and should be held out of
 * a round until they earn some back or the Prague-midnight refill lands.
 *
 * Only signed-in players are held. A visitor's energy lives in this browser's
 * storage alone, which the Navbar is honest about — it shows them a locked pip
 * rather than a count — so blocking the way in on a number they were never
 * shown would just look broken.
 *
 * Pass `exempt` for the rounds that must stay open whatever the meter says: the
 * practice round that pays energy back, and the free round a first-time visitor
 * is being taught with.
 */
export function useEnergyBlocked(exempt = false): boolean {
  const { isSignedIn } = useAuthState();
  const { value: energy, ready } = useEnergyState();

  // What the meter said on arrival, frozen for as long as this page is mounted.
  // A round costs its energy at the end, and a live read alone would drop the
  // player to zero and swap their own results screen for this block.
  //
  // For a signed-in player that reading now comes from the server, so it latches
  // on the first loaded value rather than at mount — the placeholder we render
  // while the fetch is in flight is not a reading and must not become the door.
  const [energyAtDoor, setEnergyAtDoor] = useState<number | null>(null);
  if (ready && energyAtDoor === null) {
    setEnergyAtDoor(energy);
  }

  // Both readings have to agree, which is what makes the block one-way: it can
  // lift the moment energy is earned back (or midnight refills it) without a
  // reload, but it can never fall shut on a player who was let in.
  return (
    !exempt &&
    isSignedIn &&
    ready &&
    energyAtDoor !== null &&
    energyAtDoor <= 0 &&
    energy <= 0
  );
}
