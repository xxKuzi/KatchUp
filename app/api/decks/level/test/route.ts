import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  bandStartLevel,
  levelProgressFromMasteredCount,
  levelStartWords,
  LEVEL_TEST_PASS_RATIO,
  LEVEL_TEST_QUESTION_COUNT,
  wordDifficultyForLevel,
} from "@/app/_lib/level";
import { isCefrLevel, normalizeLang, type Lang } from "@/app/_lib/languages";
import {
  getDistractors,
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
 * The level-up exam.
 *
 * GET  builds a round of the *next* level's vocabulary.
 * POST grades it and, at >= 90%, promotes the learner to the word count that
 *      starts that level.
 *
 * Which level is on the line is always decided here from the user's stored
 * progress, never from the request, so nobody can test straight to level 40.
 * Answers are re-derived from the database at grading time for the same
 * reason — the client only ever says which option it picked.
 *
 * The one exception is placement. A learner setting up a language can say they
 * already have some of it, and `claim` puts that band on the line instead of the
 * next level up — but only ever on a language they have never answered a single
 * question in, which is a state that exists once and cannot be returned to,
 * since sitting the test leaves stats behind whether it was passed or failed.
 * So a claim can still only be cashed by getting it right, once, and everything
 * above the claimed band remains a level-at-a-time climb.
 */

/** The claimed band, if it is one this account is still allowed to sit for. */
async function resolvePlacement(
  userId: string,
  learning: Lang,
  claim: string | null | undefined,
  wordFloor: number,
): Promise<{ targetLevel: number; band: string } | null> {
  const band = claim?.toUpperCase();

  if (!band || !isCefrLevel(band) || band === "A1") {
    // A1 is where everyone starts, so claiming it puts nothing on the line.
    return null;
  }

  if (wordFloor > 0 || (await hasAnyWordStatsForLanguage(userId, learning))) {
    return null;
  }

  return { targetLevel: bandStartLevel(band), band };
}

interface TestQuestion {
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

function readLangPair(request: NextRequest): {
  speak: Lang;
  learning: Lang;
} | null {
  const { searchParams } = request.nextUrl;
  const speak = normalizeLang(searchParams.get("speak"));
  const learning = normalizeLang(searchParams.get("learning"));

  if (!speak || !learning || speak === learning) {
    return null;
  }

  return { speak, learning };
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pair = readLangPair(request);
  if (!pair) {
    return NextResponse.json(
      { error: "Query params 'speak' and 'learning' must be two valid, different languages" },
      { status: 400 },
    );
  }

  const { masteredCount, wordFloor } = await getEffectiveMasteredCount(
    session.user.id,
    pair.learning,
  );
  const progress = levelProgressFromMasteredCount(masteredCount);

  if (progress.isMaxLevel) {
    return NextResponse.json(
      { error: "Already at the highest level" },
      { status: 409 },
    );
  }

  const placement = await resolvePlacement(
    session.user.id,
    pair.learning,
    request.nextUrl.searchParams.get("claim"),
    wordFloor,
  );

  const targetLevel = placement?.targetLevel ?? progress.level + 1;

  // The exam quizzes the level you're trying to enter, not the one you're in.
  const pairs = await getWordPairs({
    speak: pair.speak,
    learning: pair.learning,
    direction: "recognition",
    level: wordDifficultyForLevel(targetLevel),
    count: LEVEL_TEST_QUESTION_COUNT,
  });

  if (pairs.length < LEVEL_TEST_QUESTION_COUNT) {
    return NextResponse.json(
      { error: "Not enough vocabulary to build a test for this pair yet" },
      { status: 503 },
    );
  }

  // Wrong answers come from outside the round so no option can be right twice.
  const extraDistractors = await getDistractors({
    lang: pair.speak,
    excludeConceptIds: pairs.map((item) => item.conceptId),
    count: LEVEL_TEST_QUESTION_COUNT,
  });

  const questions: TestQuestion[] = pairs.map((item) => {
    const wrong = [
      ...pairs
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
      currentLevel: progress.level,
      targetLevel,
      wordsAtTargetLevel: levelStartWords(targetLevel),
      passRatio: LEVEL_TEST_PASS_RATIO,
      // Null unless the claim was honoured, so the page can say what is being
      // sat for rather than assuming it is the next level up.
      placementBand: placement?.band ?? null,
      questions,
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
    claim?: string;
    answers?: { conceptId?: string; answer?: string }[];
  } | null;

  const speak = normalizeLang(body?.speak);
  const learning = normalizeLang(body?.learning);

  if (!speak || !learning || speak === learning) {
    return NextResponse.json(
      { error: "'speak' and 'learning' must be two valid, different languages" },
      { status: 400 },
    );
  }

  const answers = (body?.answers ?? []).filter(
    (entry): entry is { conceptId: string; answer: string } =>
      typeof entry?.conceptId === "string" && typeof entry?.answer === "string",
  );

  if (answers.length !== LEVEL_TEST_QUESTION_COUNT) {
    return NextResponse.json(
      { error: `Expected ${LEVEL_TEST_QUESTION_COUNT} answers` },
      { status: 400 },
    );
  }

  const { masteredCount, wordFloor } = await getEffectiveMasteredCount(
    session.user.id,
    learning,
  );
  const progress = levelProgressFromMasteredCount(masteredCount);

  if (progress.isMaxLevel) {
    return NextResponse.json(
      { error: "Already at the highest level" },
      { status: 409 },
    );
  }

  // Re-derived here rather than carried over from the GET: the claim arrives in
  // the request body, so whether it is allowed has to be decided against stored
  // state at the moment it would be cashed. This is also read *before* the
  // attempts below are recorded, because recording them is what closes the
  // window on ever sitting it again.
  const placement = await resolvePlacement(
    session.user.id,
    learning,
    body?.claim,
    wordFloor,
  );

  // Grade against the database, not against anything the client sent.
  const truth = await getTranslationsForConcepts(
    answers.map((entry) => entry.conceptId),
    speak,
  );

  const graded = answers.map((entry) => {
    const expected = truth.get(entry.conceptId);
    return {
      conceptId: entry.conceptId,
      correct:
        typeof expected === "string" &&
        expected.trim().toLowerCase() === entry.answer.trim().toLowerCase(),
    };
  });

  // The exam is practice too. It used to move the level number without
  // recording a single word, so passing it left the learner's vocabulary
  // looking untouched — and its questions carry real concept ids on both the
  // way out and the way back.
  await recordConceptAttempts(session.user.id, speak, learning, graded);

  const correct = graded.filter((entry) => entry.correct).length;

  const total = answers.length;
  const passed = correct / total >= LEVEL_TEST_PASS_RATIO;

  let newMasteredCount = masteredCount;
  if (passed) {
    // A passed placement lands on the first level of the band that was claimed;
    // an ordinary promotion on the first word count of the next level. A failed
    // placement grants nothing at all — the claim was the whole of its case, and
    // it did not hold — so the learner starts where everyone else does.
    const floor = levelStartWords(placement?.targetLevel ?? progress.level + 1);
    await raiseWordFloor(session.user.id, learning, floor);
    newMasteredCount = Math.max(masteredCount, floor);
  }

  return NextResponse.json({
    correct,
    total,
    passed,
    passRatio: LEVEL_TEST_PASS_RATIO,
    previousLevel: progress.level,
    level: levelProgressFromMasteredCount(newMasteredCount).level,
    masteredCount: newMasteredCount,
    placementBand: placement?.band ?? null,
  });
}
