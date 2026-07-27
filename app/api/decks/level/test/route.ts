import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  levelProgressFromMasteredCount,
  levelStartWords,
  LEVEL_TEST_PASS_RATIO,
  LEVEL_TEST_QUESTION_COUNT,
  wordDifficultyForLevel,
} from "@/app/_lib/level";
import { normalizeLang, type Lang } from "@/app/_lib/languages";
import {
  getDistractors,
  getTranslationsForConcepts,
  getWordPairs,
} from "@/app/api/words/_lib/wordPool";
import {
  getEffectiveMasteredCount,
  raiseWordFloor,
} from "../../_lib/levelProgress";
import { recordConceptAttempts } from "../../_lib/spacedRepetition";

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
 */

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

  const { masteredCount } = await getEffectiveMasteredCount(
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

  const targetLevel = progress.level + 1;

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

  const { masteredCount } = await getEffectiveMasteredCount(
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
    // Promotion lands on the first word count of the new band.
    const floor = levelStartWords(progress.level + 1);
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
  });
}
