import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { SupportedLanguage } from "@/app/games/_lib/learning/types";
import {
  fetchWordProgress,
  syncWordProgress,
  WordProgressUpdate,
} from "./_lib/server";

function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return value === "german" || value === "spanish";
}

function isValidUpdate(value: unknown): value is WordProgressUpdate {
  if (!value || typeof value !== "object") {
    return false;
  }

  const update = value as Partial<WordProgressUpdate>;
  return (
    typeof update.wordId === "string" &&
    update.wordId.length > 0 &&
    typeof update.isUnlocked === "boolean" &&
    typeof update.isMastered === "boolean"
  );
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const language = request.nextUrl.searchParams.get("language");
  if (!isSupportedLanguage(language)) {
    return NextResponse.json(
      { error: "Missing or invalid language" },
      { status: 400 },
    );
  }

  const progress = await fetchWordProgress(session.user.id, language);
  return NextResponse.json(progress);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    language?: SupportedLanguage;
    updates?: unknown[];
  };

  if (!isSupportedLanguage(body.language) || !Array.isArray(body.updates)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const updates = body.updates.filter(isValidUpdate);
  if (updates.length === 0) {
    return NextResponse.json({ ok: true });
  }

  await syncWordProgress(session.user.id, body.language, updates);
  return NextResponse.json({ ok: true });
}
