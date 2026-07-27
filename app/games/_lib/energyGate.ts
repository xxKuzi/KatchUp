"use client";

import { useState } from "react";
import { useAuthState } from "@/app/_lib/auth";
import { getEnergy, useEnergy } from "@/app/_lib/energy";

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
  const energy = useEnergy();

  // What the meter said on arrival, frozen for as long as this page is mounted.
  // A round costs its energy at the end, and a live read alone would drop the
  // player to zero and swap their own results screen for this block.
  const [energyAtDoor] = useState(getEnergy);

  // Both readings have to agree, which is what makes the block one-way: it can
  // lift the moment energy is earned back (or midnight refills it) without a
  // reload, but it can never fall shut on a player who was let in.
  return !exempt && isSignedIn && energyAtDoor <= 0 && energy <= 0;
}
