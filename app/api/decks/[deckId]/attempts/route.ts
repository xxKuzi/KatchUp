import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { AttemptInput, recordAttempts } from "../../_lib/spacedRepetition";
import { claimIdempotencyKeys, isValidIdempotencyKey } from "@/lib/idempotency";

interface RouteContext {
  params: Promise<{ deckId: string }>;
}

/**
 * An attempt as it arrives, with the key that makes re-sending it safe.
 *
 * The key is optional: an online round posts one answer at a time and a lost
 * response there costs nothing anyone notices. An offline round always sends
 * one, because it retries until the server confirms.
 */
interface IncomingAttempt extends AttemptInput {
  idempotencyKey?: string;
}

function parseAttempts(body: unknown): IncomingAttempt[] {
  const raw = (body ?? {}) as {
    attempts?: unknown;
    deckWordId?: unknown;
    correct?: unknown;
    steps?: unknown;
    idempotencyKey?: unknown;
  };

  // Accept either a batch { attempts: [...] } or a single { deckWordId, correct }.
  const list = Array.isArray(raw.attempts)
    ? raw.attempts
    : [
        {
          deckWordId: raw.deckWordId,
          correct: raw.correct,
          steps: raw.steps,
          idempotencyKey: raw.idempotencyKey,
        },
      ];

  return list
    .map((item) => {
      const attempt = (item ?? {}) as Partial<IncomingAttempt>;
      return {
        deckWordId:
          typeof attempt.deckWordId === "string" ? attempt.deckWordId : "",
        correct: attempt.correct === true,
        // Left undefined when absent so `applyAttempt` applies its own default.
        steps: typeof attempt.steps === "number" ? attempt.steps : undefined,
        idempotencyKey: isValidIdempotencyKey(attempt.idempotencyKey)
          ? attempt.idempotencyKey
          : undefined,
      };
    })
    .filter((attempt) => attempt.deckWordId.length > 0);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { deckId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = parseAttempts(body);

  if (parsed.length === 0) {
    return NextResponse.json({ recorded: 0, duplicates: 0 });
  }

  // Anything already applied under its key is dropped before it reaches the
  // stats, so a batch that half-succeeded last time lands the other half and
  // nothing twice.
  const keyed = parsed.filter((attempt) => attempt.idempotencyKey);
  const claimed = keyed.length
    ? await claimIdempotencyKeys(
        session.user.id,
        keyed.map((attempt) => attempt.idempotencyKey as string),
      )
    : new Set<string>();

  const attempts: AttemptInput[] = parsed
    .filter(
      (attempt) =>
        !attempt.idempotencyKey || claimed.has(attempt.idempotencyKey),
    )
    .map(({ deckWordId, correct, steps }) => ({ deckWordId, correct, steps }));

  const duplicates = parsed.length - attempts.length;

  if (attempts.length === 0) {
    // Every answer in the batch had already been counted. From the sender's
    // side that is a success: it may delete them from its outbox.
    return NextResponse.json({ recorded: 0, duplicates });
  }

  const result = await recordAttempts(session.user.id, deckId, attempts);
  if (!result) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  return NextResponse.json({ ...result, duplicates });
}
