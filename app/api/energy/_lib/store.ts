import { redis } from "@/lib/redis";
import { msUntilReset, pragueDayKey } from "@/app/_lib/pragueDay";
import {
  MAX_DAILY_ENERGY_GAIN,
  MAX_ENERGY,
} from "@/app/_lib/energyConstants";

const KEY_PREFIX = "katchup-energy-v1";

/**
 * Two days, so a key written just before Prague midnight still outlives the day
 * it belongs to. Nothing reads a stale day's key — the day is part of the key —
 * so this only controls how fast finished days are swept up.
 */
const KEY_TTL_SECONDS = 60 * 60 * 48;

export type EnergySnapshot = {
  energy: number;
  max: number;
  /** Milliseconds until the Prague-midnight refill. */
  resetInMs: number;
};

function energyKey(userId: string, day: string): string {
  return `${KEY_PREFIX}:${userId}:${day}`;
}

function gainKey(userId: string, day: string): string {
  return `${KEY_PREFIX}:gained:${userId}:${day}`;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(MAX_ENERGY, value));
}

function snapshot(energy: number): EnergySnapshot {
  return { energy: clamp(energy), max: MAX_ENERGY, resetInMs: msUntilReset() };
}

/**
 * Make sure today's counter exists before we increment it. `NX` means the first
 * request of the day seeds a full bar and every later one leaves it alone, so
 * two rounds finishing at once can't reset each other back to full.
 */
async function seedToday(key: string): Promise<void> {
  await redis.set(key, MAX_ENERGY, { nx: true, ex: KEY_TTL_SECONDS });
}

/** Today's energy for this player. A day with no key yet is a full bar. */
export async function readEnergy(userId: string): Promise<EnergySnapshot> {
  const stored = await redis.get<number>(energyKey(userId, pragueDayKey()));
  return snapshot(typeof stored === "number" ? stored : MAX_ENERGY);
}

/**
 * Charge a round. Returns what's left; never drops below 0.
 *
 * The decrement is atomic, so parallel requests each cost exactly once. Only
 * the clamp back up to 0 is a second round trip, and it can only ever raise a
 * negative counter — a concurrent spend racing it still leaves the player at 0.
 */
export async function spendEnergy(
  userId: string,
  amount: number,
): Promise<EnergySnapshot> {
  const key = energyKey(userId, pragueDayKey());
  await seedToday(key);

  const remaining = await redis.decrby(key, amount);

  if (remaining < 0) {
    await redis.set(key, 0, { ex: KEY_TTL_SECONDS });
    return snapshot(0);
  }

  return snapshot(remaining);
}

/**
 * Pay energy back for a practice round. Returns the new total.
 *
 * Two ceilings apply: the bar itself (MAX_ENERGY) and how much one player may
 * earn in a day (MAX_DAILY_ENERGY_GAIN). The daily counter is what stops the
 * endpoint from being replayed for unlimited energy.
 */
export async function gainEnergy(
  userId: string,
  amount: number,
): Promise<EnergySnapshot> {
  const day = pragueDayKey();
  const key = energyKey(userId, day);
  const earnedKey = gainKey(userId, day);

  const alreadyEarned = (await redis.get<number>(earnedKey)) ?? 0;
  const allowance = Math.max(0, MAX_DAILY_ENERGY_GAIN - alreadyEarned);
  const granted = Math.min(amount, allowance);

  if (granted <= 0) {
    return readEnergy(userId);
  }

  await seedToday(key);

  const [total] = await Promise.all([
    redis.incrby(key, granted),
    redis.incrby(earnedKey, granted),
    redis.expire(earnedKey, KEY_TTL_SECONDS),
  ]);

  if (total > MAX_ENERGY) {
    await redis.set(key, MAX_ENERGY, { ex: KEY_TTL_SECONDS });
    return snapshot(MAX_ENERGY);
  }

  return snapshot(total);
}
