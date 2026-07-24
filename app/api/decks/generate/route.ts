import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  DAILY_DECK_LIMIT,
  generateDeckWords,
  getRemainingGenerations,
  isDeckLanguage,
  refundGeneration,
  reserveGeneration,
} from "@/app/api/decks/_lib/generateDeck";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const remaining = await getRemainingGenerations(session.user.id);
  return NextResponse.json({ remaining, limit: DAILY_DECK_LIMIT });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = (await request.json().catch(() => null)) as {
    topic?: string;
    nativeLang?: string;
    foreignLang?: string;
    count?: number;
  } | null;

  const topic = body?.topic?.trim();
  if (!topic) {
    return NextResponse.json({ error: "Topic is required" }, { status: 400 });
  }
  if (topic.length > 100) {
    return NextResponse.json({ error: "Topic is too long" }, { status: 400 });
  }
  if (!isDeckLanguage(body?.nativeLang) || !isDeckLanguage(body?.foreignLang)) {
    return NextResponse.json(
      { error: "Unsupported language" },
      { status: 400 },
    );
  }

  const { allowed, remaining } = await reserveGeneration(userId);
  if (!allowed) {
    return NextResponse.json(
      {
        error: `Daily limit reached. You can generate ${DAILY_DECK_LIMIT} AI decks per day.`,
        remaining: 0,
        limit: DAILY_DECK_LIMIT,
      },
      { status: 429 },
    );
  }

  try {
    const words = await generateDeckWords({
      topic,
      nativeLang: body.nativeLang,
      foreignLang: body.foreignLang,
      count: typeof body?.count === "number" ? body.count : 10,
    });

    return NextResponse.json({
      words,
      remaining,
      limit: DAILY_DECK_LIMIT,
    });
  } catch (error) {
    // Refund the reservation so a failed attempt doesn't cost the user a slot.
    await refundGeneration(userId);
    console.error("AI deck generation failed:", error);
    return NextResponse.json(
      { error: "Failed to generate deck. Please try again." },
      { status: 502 },
    );
  }
}
