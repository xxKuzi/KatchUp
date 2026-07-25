import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeLang } from "@/app/_lib/languages";
import { db } from "@/lib/db";
import {
  getLeaderboard,
  saveAsyncScore,
} from "@/app/api/flip-cards/_lib/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = request.nextUrl;
  const language = searchParams.get("language");
  const level = searchParams.get("level");

  const lang = normalizeLang(language);
  if (!lang || !level) {
    return NextResponse.json(
      { error: "Missing language or level" },
      { status: 400 },
    );
  }

  const leaderboard = await getLeaderboard(lang, level);
  return NextResponse.json({ leaderboard });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = (await request.json()) as {
    language?: string;
    level?: string;
    score?: number;
    correct?: number;
    timeMs?: number;
  };

  const postLang = normalizeLang(body.language);

  if (
    !postLang ||
    !body.level ||
    typeof body.score !== "number" ||
    typeof body.correct !== "number" ||
    typeof body.timeMs !== "number"
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await saveAsyncScore({
    userId,
    language: postLang,
    level: body.level,
    score: body.score,
    correct: body.correct,
    timeMs: body.timeMs,
  });

  return NextResponse.json({ ok: true });
}
