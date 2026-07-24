"use client";

import { useEffect, useState } from "react";

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

/** Current calendar day in Prague, as YYYY-MM-DD (day boundary = Prague midnight). */
function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Milliseconds remaining until the next Prague midnight (when energy refills). */
export function msUntilReset(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  // "24" can appear at exactly midnight in some environments — normalise to 0.
  const hour = get("hour") % 24;
  const secondsElapsed = hour * 3600 + get("minute") * 60 + get("second");
  const secondsLeft = 24 * 3600 - secondsElapsed;
  return secondsLeft * 1000;
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

/** Reactive hook that reflects the current daily energy across the app. */
export function useEnergy(): number {
  const [energy, setEnergy] = useState<number>(MAX_ENERGY);

  useEffect(() => {
    setEnergy(getEnergy());

    const handleChange = () => setEnergy(getEnergy());
    const handleCustom = (event: Event) => {
      const detail = (event as CustomEvent<number>).detail;
      setEnergy(typeof detail === "number" ? detail : getEnergy());
    };

    window.addEventListener(ENERGY_EVENT, handleCustom);
    window.addEventListener("storage", handleChange);
    window.addEventListener("focus", handleChange);

    return () => {
      window.removeEventListener(ENERGY_EVENT, handleCustom);
      window.removeEventListener("storage", handleChange);
      window.removeEventListener("focus", handleChange);
    };
  }, []);

  return energy;
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
