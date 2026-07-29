/**
 * Energy limits shared by the browser and the server store. Kept out of
 * `energy.ts` because that module is client-only and route handlers need these
 * same numbers to enforce them.
 */

export const MAX_ENERGY = 20;

/** Energy granted for completing an energy-practice review round. */
export const ENERGY_PRACTICE_REWARD = 5;

/**
 * Most energy a player can earn back in one Prague day. Without a ceiling the
 * grant endpoint is an open tap: a player could replay the practice round (or
 * just repeat the request) until the meter stopped meaning anything.
 */
export const MAX_DAILY_ENERGY_GAIN = MAX_ENERGY;

/* -------------------------------------------------------------------------- */
/* Rewarded video                                                              */
/* -------------------------------------------------------------------------- */

/** Energy granted for sitting through one rewarded ad. */
export const ENERGY_AD_REWARD = 10;

/**
 * Ads get their own daily budget rather than sharing the practice one, so
 * watching videos never eats the allowance for actually studying — and the
 * number of ads a day stays a product decision instead of a side effect.
 */
export const MAX_DAILY_AD_ENERGY = ENERGY_AD_REWARD * 3;

/** How many ads that budget is worth, for the copy in the UI. */
export const MAX_DAILY_ADS = Math.floor(MAX_DAILY_AD_ENERGY / ENERGY_AD_REWARD);

/**
 * How long a claim ticket stays valid. Long enough for a slow ad plus a slow
 * network, short enough that a stash of tickets can't be banked for later.
 */
export const AD_TICKET_TTL_SECONDS = 15 * 60;

/**
 * The shortest a real rewarded video can plausibly take. A claim that comes
 * back faster than this did not watch anything.
 */
export const AD_MIN_WATCH_MS = 5000;
