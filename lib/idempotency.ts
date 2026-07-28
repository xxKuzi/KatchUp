import { redis } from "./redis";

/**
 * "Have I already applied this write?"
 *
 * Offline rounds queue their answers and retry them until the server confirms.
 * A request that succeeds but whose response never gets back to the device is
 * indistinguishable, from the device, from one that never arrived — so it is
 * sent again. Without this, one answer would be counted twice and a word would
 * reach "known" on evidence that was recorded once.
 *
 * Keys are minted client-side at the moment of the answer and are stable across
 * retries. They are scoped per user here so one account can't burn another's.
 */

/**
 * How long a key is remembered. Comfortably longer than any plausible offline
 * stretch plus retries, and short enough that the keyspace stays small.
 */
const TTL_SECONDS = 14 * 24 * 60 * 60;

/** Keys are user input; keep them bounded and boring. */
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export function isValidIdempotencyKey(key: unknown): key is string {
  return typeof key === "string" && KEY_PATTERN.test(key);
}

/**
 * Claims a key. `true` means this caller may perform the write; `false` means
 * someone (usually an earlier delivery of the same request) already did.
 *
 * Fails open: if Redis is unreachable the write goes through. Losing an answer
 * is worse than counting a rare duplicate, and the duplicate only happens on the
 * narrow window where a retry races a lost response.
 */
export async function claimIdempotencyKey(
  userId: string,
  key: string,
): Promise<boolean> {
  try {
    const stored = await redis.set(`idem:${userId}:${key}`, 1, {
      nx: true,
      ex: TTL_SECONDS,
    });
    return stored === "OK";
  } catch {
    return true;
  }
}

/** Claims many keys at once, returning only the ones this caller won. */
export async function claimIdempotencyKeys(
  userId: string,
  keys: string[],
): Promise<Set<string>> {
  const unique = [...new Set(keys)];
  const results = await Promise.all(
    unique.map(async (key) => [key, await claimIdempotencyKey(userId, key)] as const),
  );
  return new Set(results.filter(([, won]) => won).map(([key]) => key));
}
