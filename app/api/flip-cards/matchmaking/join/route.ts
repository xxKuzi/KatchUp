import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isCefrLevel, normalizeLang } from "@/app/_lib/languages";
import { tryMatch } from "@/app/api/flip-cards/_lib/server";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = (await request.json()) as {
    language?: string;
    nativeLang?: string;
    level?: string;
    mode?: string;
  };

  const learning = normalizeLang(body.language);
  // Older clients only sent the target language and assumed English options.
  const nativeLang = normalizeLang(body.nativeLang) ?? "en";
  const level = body.level?.toUpperCase();

  if (!learning || !isCefrLevel(level) || learning === nativeLang) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const mode = body.mode === "personal" ? "personal" : "fair";

  const user = {
    userId,
    name: session.user.name ?? "Player",
    avatar: session.user.image ?? "https://i.pravatar.cc/100?img=12",
    language: learning,
    nativeLang,
    level,
    mode,
  };

  const match = await tryMatch(user);

  if (!match) {
    return NextResponse.json({ status: "waiting" });
  }

  return NextResponse.json({
    status: "matched",
    matchId: match.match.id,
    opponent: match.waiting,
    matchStartAt: match.startAt,
  });
}
