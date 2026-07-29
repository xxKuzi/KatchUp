import { redis } from "@/lib/redis";
import { msUntilReset, pragueDayKey } from "@/app/_lib/pragueDay";
import {
  AD_TICKET_TTL_SECONDS,
  MAX_DAILY_AD_ENERGY,
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

/**
 * Where a grant is charged. Practice and ads keep separate daily budgets, so a
 * day of videos can't spend the allowance meant for reviewing words.
 */
export type GainSource = "practice" | "ad";

const DAILY_GAIN_LIMIT: Record<GainSource, number> = {
  practice: MAX_DAILY_ENERGY_GAIN,
  ad: MAX_DAILY_AD_ENERGY,
};

function gainKey(userId: string, day: string, source: GainSource): string {
  // The practice key keeps its original name so budgets already spent today
  // survive this deploy rather than silently refilling.
  const bucket = source === "practice" ? "gained" : `gained-${source}`;
  return `${KEY_PREFIX}:${bucket}:${userId}:${day}`;
}

function ticketKey(userId: string, ticket: string): string {
  return `${KEY_PREFIX}:ad-ticket:${userId}:${ticket}`;
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
 * Pay energy back for a practice round or a watched ad. Returns the new total.
 *
 * Two ceilings apply: the bar itself (MAX_ENERGY) and how much one player may
 * earn from this source in a day. The daily counter is what stops the endpoint
 * from being replayed for unlimited energy.
 */
export async function gainEnergy(
  userId: string,
  amount: number,
  source: GainSource = "practice",
): Promise<EnergySnapshot> {
  const day = pragueDayKey();
  const key = energyKey(userId, day);
  const earnedKey = gainKey(userId, day, source);

  const alreadyEarned = (await redis.get<number>(earnedKey)) ?? 0;
  const allowance = Math.max(0, DAILY_GAIN_LIMIT[source] - alreadyEarned);
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

/** How much ad energy this player may still earn today. */
export async function remainingAdAllowance(userId: string): Promise<number> {
  const earned =
    (await redis.get<number>(gainKey(userId, pragueDayKey(), "ad"))) ?? 0;
  return Math.max(0, MAX_DAILY_AD_ENERGY - earned);
}

/* -------------------------------------------------------------------------- */
/* Ad tickets                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A rewarded ad is watched in the browser, and the browser is not a witness we
 * can trust — "I finished the video" is one fetch call away for anyone with dev
 * tools open. A ticket is the smallest thing that makes the claim mean
 * something: the server issues one before the player is allowed to start, notes
 * when it did so, and a claim has to hand back a ticket that is real, still
 * unused, and old enough that a video could actually have played.
 *
 * That leaves an honest player unaffected and turns a forged reward into
 * something you have to work at, one ad's worth of energy at a time, against a
 * daily ceiling that stops well before the meter loses its meaning.
 */

type TicketRecord = { issuedAt: number };

/** Mint a one-time claim ticket for this player. */
export async function issueAdTicket(userId: string): Promise<string> {
  const ticket = crypto.randomUUID();
  const record: TicketRecord = { issuedAt: Date.now() };

  await redis.set(ticketKey(userId, ticket), record, {
    ex: AD_TICKET_TTL_SECONDS,
  });

  return ticket;
}

export type TicketResult =
  | { ok: true; watchedMs: number }
  | { ok: false; reason: "unknown" | "too-fast" };

/**
 * Spend a ticket. Deleting it first is what makes a claim single-use: two
 * requests racing the same ticket, only the one that got a record back may
 * carry on.
 */
export async function consumeAdTicket(
  userId: string,
  ticket: string,
  minWatchMs: number,
): Promise<TicketResult> {
  const record = await redis.getdel<TicketRecord>(ticketKey(userId, ticket));

  if (!record || typeof record.issuedAt !== "number") {
    return { ok: false, reason: "unknown" };
  }

  const watchedMs = Date.now() - record.issuedAt;
  if (watchedMs < minWatchMs) {
    return { ok: false, reason: "too-fast" };
  }

  return { ok: true, watchedMs };
}
