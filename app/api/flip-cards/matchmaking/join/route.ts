import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { SupportedLanguage } from "@/app/games/_lib/learning/types";
import { tryMatch } from "@/app/api/flip-cards/_lib/server";

function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return value === "german" || value === "spanish" || value === "czech";
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = (await request.json()) as {
    language?: SupportedLanguage;
    level?: string;
    mode?: string;
  };

  if (!body.level || !isSupportedLanguage(body.language)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const mode = body.mode === "personal" ? "personal" : "fair";

  const user = {
    userId,
    name: session.user.name ?? "Player",
    avatar: session.user.image ?? "https://i.pravatar.cc/100?img=12",
    language: body.language,
    level: body.level,
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
  });
}
