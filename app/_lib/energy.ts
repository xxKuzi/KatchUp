"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { msUntilReset, pragueDayKey } from "./pragueDay";
import { adsConfigured, requestRewardedAd } from "./adPlacement";
import {
  ENERGY_AD_REWARD,
  ENERGY_PRACTICE_REWARD,
  MAX_ENERGY,
} from "./energyConstants";

export { MAX_ENERGY, ENERGY_PRACTICE_REWARD, ENERGY_AD_REWARD, msUntilReset };
export { adsConfigured };

/**
 * Where a player's daily energy lives depends on whether we know who they are.
 *
 * Signed in, it lives in Redis behind /api/energy: the browser holds a cache
 * for rendering and the server is the only thing that decides what the number
 * actually is. Clearing site data, or a second device, no longer buys a fresh
 * day. Signed out, there is nobody to bill, so it stays in this browser's
 * storage — which the Navbar is honest about, showing a locked pip rather than
 * a count.
 */

const STORAGE_KEY = "katchup-energy";

export type EnergySnapshot = {
  value: number;
  /**
   * Whether `value` is a real reading. False while we are still waiting on the
   * session or on the first fetch — callers that gate play must not treat an
   * unloaded bar as an empty one.
   */
  ready: boolean;
};

const INITIAL: EnergySnapshot = { value: MAX_ENERGY, ready: false };

let snapshot: EnergySnapshot = INITIAL;
let userId: string | null = null;
let identityKnown = false;

/**
 * Whether the server has answered for the current player at least once.
 *
 * This is what `ready` means for a signed-in bar, and the distinction matters:
 * `snapshot.value` starts at a full bar so the navbar has something to lay out,
 * and until a fetch lands that number is a placeholder rather than a reading.
 */
let remoteLoaded = false;

const listeners = new Set<() => void>();

function publish(value: number, ready: boolean) {
  const next = Math.max(0, Math.min(MAX_ENERGY, value));
  if (snapshot.value === next && snapshot.ready === ready) return;
  snapshot = { value: next, ready };
  listeners.forEach((listener) => listener());
}

/* -------------------------------------------------------------------------- */
/* Signed-out storage                                                          */
/* -------------------------------------------------------------------------- */

type StoredState = { date: string; value: number };

function readLocal(): number {
  if (typeof window === "undefined") return MAX_ENERGY;

  const today = pragueDayKey();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredState>;
      if (parsed.date === today && typeof parsed.value === "number") {
        return Math.max(0, Math.min(MAX_ENERGY, parsed.value));
      }
    }
  } catch {
    // ignore malformed storage and fall through to a fresh daily reset
  }

  writeLocal(MAX_ENERGY);
  return MAX_ENERGY;
}

function writeLocal(value: number) {
  if (typeof window === "undefined") return;
  try {
    const state: StoredState = { date: pragueDayKey(), value };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore write failures (e.g. storage disabled)
  }
}

/* -------------------------------------------------------------------------- */
/* Signed-in storage                                                           */
/* -------------------------------------------------------------------------- */

type ServerSnapshot = { energy: number; max: number; resetInMs: number };

async function callEnergyApi(
  path: string,
  init?: RequestInit,
): Promise<number | null> {
  try {
    const response = await fetch(path, {
      cache: "no-store",
      ...init,
    });
    if (!response.ok) return null;

    const body = (await response.json()) as Partial<ServerSnapshot>;
    return typeof body.energy === "number" ? body.energy : null;
  } catch {
    // Offline or a failed round trip. The cache keeps showing the last known
    // number and the next refresh reconciles it.
    return null;
  }
}

/**
 * Record a number the server just told us. Any answer counts as the first
 * load — a spend or an ad payout is as authoritative as a read.
 */
function publishServerValue(energy: number) {
  remoteLoaded = true;
  cancelFirstLoadRetry();
  publish(energy, true);
}

let refreshInFlight: Promise<void> | null = null;

/**
 * How long to wait before each retry of a *first* load that failed. Enough
 * attempts to outlast a deploy swapping the server out from under an open tab,
 * then we stop and leave it to the focus and visibility watchers below.
 */
const FIRST_LOAD_RETRY_DELAYS = [1000, 2000, 5000, 10000];

let firstLoadAttempt = 0;
let firstLoadTimer = 0;

function cancelFirstLoadRetry() {
  if (firstLoadTimer) {
    window.clearTimeout(firstLoadTimer);
    firstLoadTimer = 0;
  }
  firstLoadAttempt = 0;
}

/**
 * Try again for a player whose bar has never loaded. Doing nothing here is what
 * used to leave a full placeholder on screen, so keep asking for a while.
 */
function scheduleFirstLoadRetry() {
  if (typeof window === "undefined") return;
  if (firstLoadTimer) return;

  const delay = FIRST_LOAD_RETRY_DELAYS[firstLoadAttempt];
  if (delay === undefined) return; // out of attempts; the watchers take over

  firstLoadAttempt += 1;
  firstLoadTimer = window.setTimeout(() => {
    firstLoadTimer = 0;
    if (!userId || remoteLoaded) return; // signed out or answered meanwhile
    void refreshRemote();
  }, delay);
}

/** Pull the authoritative number for the signed-in player. */
function refreshRemote(): Promise<void> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = callEnergyApi("/api/energy")
    .then((energy) => {
      if (!userId) return; // signed out while the request was in the air
      if (energy === null) {
        if (remoteLoaded) {
          // We have had a real reading today; a round trip that fails now
          // (offline, a deploy mid-flight) doesn't invalidate it.
          publish(snapshot.value, true);
        } else {
          // Nothing has ever come back, so `snapshot.value` is the full-bar
          // placeholder — not a reading. Marking it ready here is what made a
          // failed fetch look exactly like a fresh 20/20. Keep it unready and
          // ask again.
          scheduleFirstLoadRetry();
        }
        return;
      }
      publishServerValue(energy);
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

/* -------------------------------------------------------------------------- */
/* Identity                                                                    */
/* -------------------------------------------------------------------------- */

let resolveIdentity: (() => void) | null = null;
const identitySettled = new Promise<void>((resolve) => {
  resolveIdentity = resolve;
});

/**
 * Tell the store who is playing. Called by <EnergySync> once the session has
 * loaded, and again on sign-in or sign-out.
 */
export function setEnergyIdentity(nextUserId: string | null) {
  const changed = nextUserId !== userId || !identityKnown;

  userId = nextUserId;
  identityKnown = true;
  resolveIdentity?.();
  resolveIdentity = null;

  if (!changed) return;

  cancelFirstLoadRetry();

  if (nextUserId) {
    remoteLoaded = false;
    publish(snapshot.value, false);
    void refreshRemote();
  } else {
    // A signed-out bar lives in this browser's storage, so a local read is a
    // real reading and there is nothing to wait for.
    remoteLoaded = true;
    publish(readLocal(), true);
  }
}

/* -------------------------------------------------------------------------- */
/* Public surface                                                              */
/* -------------------------------------------------------------------------- */

/** The cached energy right now. Pair it with `getEnergySnapshot().ready`. */
export function getEnergy(): number {
  return snapshot.value;
}

export function getEnergySnapshot(): EnergySnapshot {
  return snapshot;
}

/**
 * Spend energy for a finished round. Resolves with the remaining energy.
 *
 * Signed in, the server decides the result; the cache moves first so the navbar
 * reacts immediately and is corrected a moment later if the two disagree.
 */
export async function spendEnergy(amount = 1): Promise<number> {
  await identitySettled;

  if (!userId) {
    const value = Math.max(0, readLocal() - amount);
    writeLocal(value);
    publish(value, true);
    return value;
  }

  // Optimistic, and deliberately not `ready`: if the bar has never loaded, this
  // is a guess against a placeholder and must not pass for a reading.
  publish(snapshot.value - amount, snapshot.ready);

  const energy = await callEnergyApi("/api/energy/spend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });

  if (energy !== null) publishServerValue(energy);
  return snapshot.value;
}

/**
 * Grant energy back as a reward for reviewing your mistakes. Resolves with the
 * new energy. The server applies its own daily ceiling, so the number that
 * comes back can be lower than the optimistic one.
 */
export async function gainEnergy(amount = 1): Promise<number> {
  await identitySettled;

  if (!userId) {
    const value = Math.min(MAX_ENERGY, readLocal() + amount);
    writeLocal(value);
    publish(value, true);
    return value;
  }

  // Optimistic, and not `ready` — see the note in `spendEnergy`.
  publish(snapshot.value + amount, snapshot.ready);

  const energy = await callEnergyApi("/api/energy/gain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });

  if (energy !== null) publishServerValue(energy);
  return snapshot.value;
}

/* -------------------------------------------------------------------------- */
/* Rewarded video                                                              */
/* -------------------------------------------------------------------------- */

export type AdEnergyResult =
  /** The video played and the server paid out. */
  | "rewarded"
  /** Closed early — nothing earned, nothing lost. */
  | "skipped"
  /** Today's ads are used up. */
  | "limit"
  /** No ad to show: blocked script, no fill, or ads not configured. */
  | "unavailable"
  /** Signed out, or the round trip failed. */
  | "error";

/**
 * Trade one rewarded video for energy.
 *
 * The order matters: we ask the server for a ticket *before* the ad, so a
 * player who has already used the day's videos is turned away instead of
 * sitting through an ad that can't pay. Only a watched ad comes back to claim,
 * and the server decides what it's worth.
 *
 * `onAdReady` is handed the function that plays the ad, which Google requires
 * be called from a real user gesture — so the caller shows a button and the
 * player's press starts the video.
 */
export async function watchAdForEnergy(
  onAdReady: (playAd: () => void) => void,
): Promise<AdEnergyResult> {
  await identitySettled;

  // Ads pay into the server-side meter, which a signed-out visitor doesn't have.
  if (!userId) return "error";
  if (!adsConfigured()) return "unavailable";

  let ticket: string;
  try {
    const response = await fetch("/api/energy/ad/start", {
      method: "POST",
      cache: "no-store",
    });

    if (response.status === 429) return "limit";
    if (!response.ok) return "error";

    const body = (await response.json()) as { ticket?: string };
    if (!body.ticket) return "error";
    ticket = body.ticket;
  } catch {
    return "error";
  }

  const outcome = await requestRewardedAd({ onReady: onAdReady });
  if (outcome !== "watched") {
    // The unspent ticket is left to expire on its own; it is worth nothing
    // without an ad, and a claim it never makes costs nobody anything.
    return outcome === "skipped" ? "skipped" : "unavailable";
  }

  const energy = await callEnergyApi("/api/energy/ad/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticket }),
  });

  if (energy === null) {
    // The ad was watched but the payout didn't land. Re-read rather than guess,
    // so the bar shows what the server actually holds.
    void refreshRemote();
    return "error";
  }

  publishServerValue(energy);
  return "rewarded";
}

/* -------------------------------------------------------------------------- */
/* Subscription                                                                */
/* -------------------------------------------------------------------------- */

/** Re-read from whichever store is authoritative for this player. */
function revalidate() {
  if (userId) {
    void refreshRemote();
  } else if (identityKnown) {
    publish(readLocal(), true);
  }
}

let watcherCount = 0;
let resetTimer = 0;
let detachWatchers: (() => void) | null = null;

/**
 * Install the triggers that make a mounted bar keep up with reality: the
 * midnight refill, another tab, and a phone coming back from the background.
 * Installed once however many components are subscribed.
 */
function attachWatchers() {
  const scheduleReset = () => {
    resetTimer = window.setTimeout(() => {
      revalidate();
      scheduleReset();
    }, msUntilReset() + 1000);
  };
  scheduleReset();

  window.addEventListener("storage", revalidate);
  window.addEventListener("focus", revalidate);
  // Phones background the tab rather than blur it, and throttled timers can
  // fire late, so re-read whenever the page comes back into view.
  document.addEventListener("visibilitychange", revalidate);

  detachWatchers = () => {
    window.clearTimeout(resetTimer);
    window.removeEventListener("storage", revalidate);
    window.removeEventListener("focus", revalidate);
    document.removeEventListener("visibilitychange", revalidate);
  };
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);

  watcherCount += 1;
  if (watcherCount === 1) attachWatchers();

  return () => {
    listeners.delete(onChange);
    watcherCount -= 1;
    if (watcherCount === 0) {
      detachWatchers?.();
      detachWatchers = null;
    }
  };
}

/** The server has no player to read for, so it renders a full, unready bar. */
function serverSnapshot(): EnergySnapshot {
  return INITIAL;
}

/** Reactive energy plus whether it has actually loaded yet. */
export function useEnergyState(): EnergySnapshot {
  return useSyncExternalStore(subscribe, getEnergySnapshot, serverSnapshot);
}

/** Reactive hook that reflects the current daily energy across the app. */
export function useEnergy(): number {
  return useEnergyState().value;
}

/**
 * Reactive countdown to the next Prague-midnight reset.
 * Returns { hours, minutes } remaining, refreshed once a minute.
 */
export function useResetCountdown(): { hours: number; minutes: number } {
  const [remaining, setRemaining] = useState({ hours: 0, minutes: 0 });

  useEffect(() => {
    const update = () => {
      const totalMinutes = Math.max(0, Math.ceil(msUntilReset() / 60000));
      setRemaining({
        hours: Math.floor(totalMinutes / 60),
        minutes: totalMinutes % 60,
      });
    };

    update();
    const interval = window.setInterval(update, 60000);
    return () => window.clearInterval(interval);
  }, []);

  return remaining;
}
