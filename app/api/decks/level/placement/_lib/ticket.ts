import { createHmac, timingSafeEqual } from "node:crypto";
import {
  isCefrLevel,
  isLang,
  type CefrLevel,
  type Lang,
} from "@/app/_lib/languages";

/**
 * A signed record of a placement sat before there was an account to put it on.
 *
 * A visitor now sits the same test a player does, but the result has nowhere to
 * live until they sign in — and the only place to keep it in between is their
 * own browser. Handing back a plain "you are B1" and trusting it back would make
 * the level a thing anyone could type into localStorage, which is exactly what
 * the placement test exists to stop: the whole design keeps the right answers
 * and the band on the server precisely so the client can't award itself a
 * ceiling it never reached.
 *
 * So the grade goes back signed. The browser carries an opaque string it cannot
 * forge or edit, hands it over once an account exists, and the server re-reads
 * its own verdict out of it. Nothing is stored server-side in the meantime,
 * which is what keeps a visitor a visitor.
 */

export interface PlacementTicket {
  learning: Lang;
  band: CefrLevel;
  /** The head start the band is worth, in mastered words. */
  floor: number;
  issuedAt: number;
}

/**
 * Long enough that signing up a few weeks after trying the test still carries
 * the result over, short enough that a ticket is not a permanent bearer token
 * for a level. Expiring only costs a retake, which is still open: nothing was
 * recorded against the account.
 */
const TICKET_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function signingSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET is required to sign placement tickets");
  }

  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

export function signPlacementTicket(
  result: Omit<PlacementTicket, "issuedAt">,
): string {
  const payload = Buffer.from(
    JSON.stringify({ ...result, issuedAt: Date.now() }),
  ).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

/** The verdict inside a ticket, or null if it wasn't ours or has expired. */
export function readPlacementTicket(token: unknown): PlacementTicket | null {
  if (typeof token !== "string") {
    return null;
  }

  const separator = token.lastIndexOf(".");
  if (separator <= 0) {
    return null;
  }

  const payload = token.slice(0, separator);
  const signature = Buffer.from(token.slice(separator + 1));
  const expected = Buffer.from(sign(payload));

  if (
    signature.length !== expected.length ||
    !timingSafeEqual(signature, expected)
  ) {
    return null;
  }

  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<PlacementTicket>;

    const floor = Number(data.floor);
    const issuedAt = Number(data.issuedAt);

    if (!isLang(data.learning) || !isCefrLevel(data.band)) {
      return null;
    }

    if (!Number.isFinite(floor) || floor < 0) {
      return null;
    }

    if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > TICKET_TTL_MS) {
      return null;
    }

    return {
      learning: data.learning,
      band: data.band,
      floor: Math.floor(floor),
      issuedAt,
    };
  } catch {
    return null;
  }
}
