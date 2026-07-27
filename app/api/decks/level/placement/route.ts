import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  bandStartLevel,
  levelProgressFromMasteredCount,
  levelStartWords,
  placementBandFromCorrectByBand,
  PLACEMENT_BAND_PASS,
  PLACEMENT_QUESTIONS_PER_BAND,
} from "@/app/_lib/level";
import {
  CEFR_LEVELS,
  normalizeLang,
  type CefrLevel,
  type Lang,
} from "@/app/_lib/languages";
import {
  getDistractors,
  getLevelsForConcepts,
  getTranslationsForConcepts,
  getWordPairs,
} from "@/app/api/words/_lib/wordPool";
import {
  getEffectiveMasteredCount,
  raiseWordFloor,
} from "../../_lib/levelProgress";
import {
  hasAnyWordStatsForLanguage,
  recordConceptAttempts,
} from "../../_lib/spacedRepetition";

/**
 * The placement test: sat once, when a language is set up, by everyone.
 *
 * Sitting it is the only way onto a band without climbing to it. The level test
 * next door promotes one level at a time off stored progress and never takes a
 * target from the request, which is what stops anyone testing straight to the
 * top; this is the deliberate exception, and it is bounded by being available
 * only on a language the account has never answered a single question in. Sitting
 * it records those answers, so the state that allows it ends the moment it is
 * used — one attempt, whatever the outcome.
 *
 * Every band is on the paper rather than a claimed one, because a test drawn from
 * a single band can only confirm that band. Someone who says they are a beginner
 * and then answers B1 words correctly is a B1 learner who undersold themselves,
 * and the point of placing them is to find that out. Nobody is asked what they
 * think their level is: the test is the claim.
 */

interface PlacementQuestion {
  conceptId: string;
  prompt: string;
  options: string[];
}

function shuffle<T>(items: T[]): T[] {
  const cloned = [...items];
  for (let i = cloned.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }
  return cloned;
}

function readLangPair(
  speakRaw: string | null | undefined,
  learningRaw: string | null | undefined,
): { speak: Lang; learning: Lang } | null {
  const speak = normalizeLang(speakRaw);
  const learning = normalizeLang(learningRaw);

  if (!speak || !learning || speak === learning) {
    return null;
  }

  return { speak, learning };
}

/**
 * Whether this account may still be placed in this language. Read before the
 * answers are recorded on the POST, since recording them is what closes it.
 */
async function placementOpen(userId: string, learning: Lang): Promise<boolean> {
  const { wordFloor } = await getEffectiveMasteredCount(userId, learning);

  if (wordFloor > 0) {
    return false;
  }

  return !(await hasAnyWordStatsForLanguage(userId, learning));
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const pair = readLangPair(
    searchParams.get("speak"),
    searchParams.get("learning"),
  );
  if (!pair) {
    return NextResponse.json(
      {
        error:
          "Query params 'speak' and 'learning' must be two valid, different languages",
      },
      { status: 400 },
    );
  }

  if (!(await placementOpen(session.user.id, pair.learning))) {
    return NextResponse.json(
      {
        error:
          "You have already started this language — climb it a level at a time.",
      },
      { status: 409 },
    );
  }

  // Every band, evenly. Fetched per band rather than in one go precisely so the
  // spread is guaranteed: a single query would hand back whatever the corpus
  // happens to hold most of.
  const perBand = await Promise.all(
    CEFR_LEVELS.map((level) =>
      getWordPairs({
        speak: pair.speak,
        learning: pair.learning,
        direction: "recognition",
        level,
        count: PLACEMENT_QUESTIONS_PER_BAND,
      }),
    ),
  );

  const selected = perBand.flat();

  if (perBand.some((pairs) => pairs.length < PLACEMENT_QUESTIONS_PER_BAND)) {
    return NextResponse.json(
      { error: "Not enough vocabulary to place this language pair yet" },
      { status: 503 },
    );
  }

  const extraDistractors = await getDistractors({
    lang: pair.speak,
    excludeConceptIds: selected.map((item) => item.conceptId),
    count: selected.length,
  });

  const questions: PlacementQuestion[] = selected.map((item) => {
    const wrong = [
      ...selected
        .filter(
          (other) =>
            other.conceptId !== item.conceptId &&
            other.answer.toLowerCase() !== item.answer.toLowerCase(),
        )
        .map((other) => other.answer),
      ...extraDistractors,
    ].filter(
      (text, position, all) =>
        text.toLowerCase() !== item.answer.toLowerCase() &&
        all.findIndex((seen) => seen.toLowerCase() === text.toLowerCase()) ===
          position,
    );

    return {
      conceptId: item.conceptId,
      prompt: item.prompt,
      options: shuffle([...shuffle(wrong).slice(0, 3), item.answer]),
    };
  });

  return NextResponse.json(
    {
      // Presented shuffled, so the paper does not announce its own staircase and
      // invite someone to stop trying once it gets hard.
      questions: shuffle(questions),
      bandPass: PLACEMENT_BAND_PASS,
      questionsPerBand: PLACEMENT_QUESTIONS_PER_BAND,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    speak?: string;
    learning?: string;
    answers?: { conceptId?: string; answer?: string }[];
  } | null;

  const pair = readLangPair(body?.speak, body?.learning);
  if (!pair) {
    return NextResponse.json(
      {
        error: "'speak' and 'learning' must be two valid, different languages",
      },
      { status: 400 },
    );
  }

  const answers = (body?.answers ?? []).filter(
    (entry): entry is { conceptId: string; answer: string } =>
      typeof entry?.conceptId === "string" && typeof entry?.answer === "string",
  );

  if (answers.length === 0) {
    return NextResponse.json(
      { error: "No answers submitted" },
      { status: 400 },
    );
  }

  if (!(await placementOpen(session.user.id, pair.learning))) {
    return NextResponse.json(
      {
        error:
          "You have already started this language — climb it a level at a time.",
      },
      { status: 409 },
    );
  }

  // Both the right answer and the band each question belonged to come from the
  // corpus. The client only ever says which option it picked.
  const [truth, levels] = await Promise.all([
    getTranslationsForConcepts(
      answers.map((entry) => entry.conceptId),
      pair.speak,
    ),
    getLevelsForConcepts(
      answers.map((entry) => entry.conceptId),
      pair.learning,
    ),
  ]);

  const graded = answers.map((entry) => {
    const expected = truth.get(entry.conceptId);
    return {
      conceptId: entry.conceptId,
      correct:
        typeof expected === "string" &&
        expected.trim().toLowerCase() === entry.answer.trim().toLowerCase(),
    };
  });

  const correctByBand: Partial<Record<CefrLevel, number>> = {};
  for (const entry of graded) {
    const band = levels.get(entry.conceptId);
    if (band && entry.correct) {
      correctByBand[band] = (correctByBand[band] ?? 0) + 1;
    }
  }

  const band = placementBandFromCorrectByBand(correctByBand);
  const startLevel = bandStartLevel(band);
  const floor = levelStartWords(startLevel);

  // The test is practice too, and this is also what shuts the door behind it.
  await recordConceptAttempts(
    session.user.id,
    pair.speak,
    pair.learning,
    graded,
  );

  if (floor > 0) {
    await raiseWordFloor(session.user.id, pair.learning, floor);
  }

  const progress = levelProgressFromMasteredCount(floor);

  return NextResponse.json({
    band,
    level: progress.level,
    masteredCount: progress.masteredCount,
    correct: graded.filter((entry) => entry.correct).length,
    total: graded.length,
    correctByBand,
    bandPass: PLACEMENT_BAND_PASS,
    questionsPerBand: PLACEMENT_QUESTIONS_PER_BAND,
  });
}
