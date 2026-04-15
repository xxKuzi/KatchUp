import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { SupportedLanguage } from "@/app/games/_lib/learning/types";
import { db } from "@/lib/db";
import {
  getLeaderboard,
  saveAsyncScore,
} from "@/app/api/flip-cards/_lib/server";

function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return value === "german" || value === "spanish";
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const language = searchParams.get("language");
  const level = searchParams.get("level");

  if (!isSupportedLanguage(language) || !level) {
    return NextResponse.json(
      { error: "Missing language or level" },
      { status: 400 },
    );
  }

  const leaderboard = await getLeaderboard(language, level);
  return NextResponse.json({ leaderboard });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    language?: SupportedLanguage;
    level?: string;
    score?: number;
    correct?: number;
    timeMs?: number;
  };

  if (
    !isSupportedLanguage(body.language) ||
    !body.level ||
    typeof body.score !== "number" ||
    typeof body.correct !== "number" ||
    typeof body.timeMs !== "number"
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await saveAsyncScore({
    userId: session.user.id,
    language: body.language,
    level: body.level,
    score: body.score,
    correct: body.correct,
    timeMs: body.timeMs,
  });

  return NextResponse.json({ ok: true });
}
