"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

export const MAX_ENERGY = 20;
/** Energy granted for completing an energy-practice review round. */
export const ENERGY_PRACTICE_REWARD = 5;

const STORAGE_KEY = "katchup-energy";
const ENERGY_EVENT = "katchup-energy-change";
const TIME_ZONE = "Europe/Prague";

type EnergyState = {
  date: string; // Prague YYYY-MM-DD of the last reset
  value: number;
};

const PRAGUE_CLOCK = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

type Wall = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** The wall clock a person in Prague is reading at this instant. */
function pragueWallClock(instant: Date): Wall {
  const parts = PRAGUE_CLOCK.formatToParts(instant);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24, // some engines say "24" at exactly midnight
    minute: get("minute"),
    second: get("second"),
  };
}

/** How far Prague's clock runs ahead of UTC at this instant (+1h or +2h). */
function pragueOffsetMs(instant: Date): number {
  const wall = pragueWallClock(instant);
  const asIfUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
  );
  // Drop the milliseconds the formatter never reported, so the difference is
  // the zone offset alone.
  return asIfUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Current calendar day in Prague, as YYYY-MM-DD (day boundary = Prague midnight). */
function todayKey(): string {
  const wall = pragueWallClock(new Date());
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${wall.year}-${pad(wall.month)}-${pad(wall.day)}`;
}

/** Milliseconds remaining until the next Prague midnight (when energy refills). */
export function msUntilReset(): number {
  const now = new Date();
  const wall = pragueWallClock(now);
  const nextMidnightWall = Date.UTC(wall.year, wall.month - 1, wall.day + 1);

  // Twice a year the day is 23 or 25 hours long, so counting down "24h minus
  // the time on the clock" is an hour out. Convert the next local midnight to a
  // real instant instead, using the offset that will be in force when it lands.
  const firstGuess = nextMidnightWall - pragueOffsetMs(now);
  const instant = nextMidnightWall - pragueOffsetMs(new Date(firstGuess));

  return Math.max(0, instant - now.getTime());
}

function readState(): EnergyState {
  if (typeof window === "undefined") {
    return { date: todayKey(), value: MAX_ENERGY };
  }

  const today = todayKey();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<EnergyState>;
      if (parsed.date === today && typeof parsed.value === "number") {
        return {
          date: today,
          value: Math.max(0, Math.min(MAX_ENERGY, parsed.value)),
        };
      }
    }
  } catch {
    // ignore malformed storage and fall through to a fresh daily reset
  }

  const fresh = { date: today, value: MAX_ENERGY };
  writeState(fresh);
  return fresh;
}

function writeState(state: EnergyState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore write failures (e.g. storage disabled)
  }
}

function emit(value: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ENERGY_EVENT, { detail: value }));
}

export function getEnergy(): number {
  return readState().value;
}

/**
 * Spend a single point of energy for completing an exercise.
 * Returns the remaining energy. Never drops below 0.
 */
export function spendEnergy(amount = 1): number {
  const state = readState();
  const value = Math.max(0, state.value - amount);
  const next = { date: state.date, value };
  writeState(next);
  emit(value);
  return value;
}

/**
 * Grant energy back as a reward for reviewing your mistakes.
 * Returns the new energy. Never rises above MAX_ENERGY.
 */
export function gainEnergy(amount = 1): number {
  const state = readState();
  const value = Math.min(MAX_ENERGY, state.value + amount);
  const next = { date: state.date, value };
  writeState(next);
  emit(value);
  return value;
}

/** Every way the stored energy can change under a mounted component. */
function subscribeToEnergy(onChange: () => void): () => void {
  // The refill happens on read, so a tab left open over midnight would sit on
  // yesterday's empty bar until something touched it. Wake it at the boundary.
  let resetTimer = 0;
  const scheduleReset = () => {
    resetTimer = window.setTimeout(() => {
      onChange();
      scheduleReset();
    }, msUntilReset() + 1000);
  };
  scheduleReset();

  window.addEventListener(ENERGY_EVENT, onChange);
  window.addEventListener("storage", onChange);
  window.addEventListener("focus", onChange);
  // Phones background the tab rather than blur it, and throttled timers can
  // fire late, so re-read whenever the page comes back into view.
  document.addEventListener("visibilitychange", onChange);

  return () => {
    window.clearTimeout(resetTimer);
    window.removeEventListener(ENERGY_EVENT, onChange);
    window.removeEventListener("storage", onChange);
    window.removeEventListener("focus", onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
}

/** The server has no storage to read, so it renders a full bar. */
function serverEnergy(): number {
  return MAX_ENERGY;
}

/** Reactive hook that reflects the current daily energy across the app. */
export function useEnergy(): number {
  return useSyncExternalStore(subscribeToEnergy, getEnergy, serverEnergy);
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
