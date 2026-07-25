import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeLang } from "@/app/_lib/languages";
import {
  fetchWordProgress,
  syncWordProgress,
  WordProgressUpdate,
} from "./_lib/server";

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

  const language = normalizeLang(request.nextUrl.searchParams.get("language"));
  if (!language) {
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
    language?: string;
    updates?: unknown[];
  };

  const bodyLanguage = normalizeLang(body.language);
  if (!bodyLanguage || !Array.isArray(body.updates)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const updates = body.updates.filter(isValidUpdate);
  if (updates.length === 0) {
    return NextResponse.json({ ok: true });
  }

  await syncWordProgress(session.user.id, bodyLanguage, updates);
  return NextResponse.json({ ok: true });
}
