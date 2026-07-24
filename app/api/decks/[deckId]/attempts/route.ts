import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { AttemptInput, recordAttempts } from "../../_lib/spacedRepetition";

interface RouteContext {
  params: Promise<{ deckId: string }>;
}

function parseAttempts(body: unknown): AttemptInput[] {
  const raw = (body ?? {}) as {
    attempts?: unknown;
    deckWordId?: unknown;
    correct?: unknown;
  };

  // Accept either a batch { attempts: [...] } or a single { deckWordId, correct }.
  const list = Array.isArray(raw.attempts)
    ? raw.attempts
    : [{ deckWordId: raw.deckWordId, correct: raw.correct }];

  return list
    .map((item) => {
      const attempt = (item ?? {}) as Partial<AttemptInput>;
      return {
        deckWordId:
          typeof attempt.deckWordId === "string" ? attempt.deckWordId : "",
        correct: attempt.correct === true,
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
  const attempts = parseAttempts(body);

  if (attempts.length === 0) {
    return NextResponse.json({ recorded: 0 });
  }

  const result = await recordAttempts(session.user.id, deckId, attempts);
  if (!result) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  return NextResponse.json(result);
}
