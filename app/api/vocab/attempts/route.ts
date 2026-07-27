import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeLang } from "@/app/_lib/languages";
import {
  ConceptAttemptInput,
  recordConceptAttempts,
} from "@/app/api/decks/_lib/spacedRepetition";

/**
 * Progress from the games played outside any deck.
 *
 * Those rounds draw straight from the corpus and, until this existed, recorded
 * nothing at all — playing from the games hub taught the app nothing about you.
 *
 * Signed out is not an error worth showing: `/api/words` stays open so anonymous
 * play works, and the client simply drops the 401 on the floor.
 *
 * Only concept ids are accepted. Free text would let anyone POST invented words
 * and mint "known" rows to inflate their level, so words the corpus does not
 * know can only get a stat row by living in a deck the user owns.
 *
 *   POST /api/vocab/attempts
 *   { nativeLang, foreignLang, attempts: [{ conceptId, correct, steps? }] }
 */

const MAX_ATTEMPTS = 100;

function parseAttempts(body: unknown): ConceptAttemptInput[] {
  const raw = (body ?? {}) as { attempts?: unknown };
  if (!Array.isArray(raw.attempts)) {
    return [];
  }

  return raw.attempts
    .slice(0, MAX_ATTEMPTS)
    .map((item) => {
      const attempt = (item ?? {}) as Partial<ConceptAttemptInput>;
      return {
        conceptId: typeof attempt.conceptId === "string" ? attempt.conceptId : "",
        correct: attempt.correct === true,
        // Left undefined when absent so the recorder applies its own default.
        steps: typeof attempt.steps === "number" ? attempt.steps : undefined,
      };
    })
    .filter((attempt) => attempt.conceptId.length > 0);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const raw = (body ?? {}) as { nativeLang?: unknown; foreignLang?: unknown };

  const nativeLang = normalizeLang(raw.nativeLang);
  const foreignLang = normalizeLang(raw.foreignLang);
  if (!nativeLang || !foreignLang) {
    return NextResponse.json(
      { error: "'nativeLang' and 'foreignLang' must be valid languages" },
      { status: 400 },
    );
  }

  if (nativeLang === foreignLang) {
    return NextResponse.json(
      { error: "'nativeLang' and 'foreignLang' must differ" },
      { status: 400 },
    );
  }

  const attempts = parseAttempts(body);
  if (attempts.length === 0) {
    return NextResponse.json({ recorded: 0 });
  }

  const result = await recordConceptAttempts(
    session.user.id,
    nativeLang,
    foreignLang,
    attempts,
  );

  return NextResponse.json(result);
}
