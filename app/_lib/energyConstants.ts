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
