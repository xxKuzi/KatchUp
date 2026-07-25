import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isCefrLevel, normalizeLang } from "@/app/_lib/languages";
import { leaveQueue } from "@/app/api/flip-cards/_lib/server";

/**
 * Take a player out of the matchmaking queue when they cancel or leave the
 * lobby. Entries left behind used to pair the next player with someone who
 * was no longer there.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    language?: string;
    nativeLang?: string;
    level?: string;
    mode?: string;
  };

  const learning = normalizeLang(body.language);
  const nativeLang = normalizeLang(body.nativeLang) ?? "en";
  const level = body.level?.toUpperCase();

  if (!learning || !isCefrLevel(level)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await leaveQueue({
    userId: session.user.id,
    language: learning,
    nativeLang,
    level,
    mode: body.mode === "personal" ? "personal" : "fair",
  });

  return NextResponse.json({ ok: true });
}
