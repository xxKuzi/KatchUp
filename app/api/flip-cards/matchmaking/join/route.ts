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
    nickname?: string;
    avatar?: string;
  };

  const learning = normalizeLang(body.language);
  // Older clients only sent the target language and assumed English options.
  const nativeLang = normalizeLang(body.nativeLang) ?? "en";
  const level = body.level?.toUpperCase();

  if (!learning || !isCefrLevel(level) || learning === nativeLang) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const mode = body.mode === "personal" ? "personal" : "fair";

  // Duels are played under the friends-profile nickname, never the account
  // name people signed up with. The client is the only place that nickname
  // lives, so it travels with the join request.
  const nickname = body.nickname?.trim().slice(0, 24);
  const requestedAvatar = body.avatar?.trim();
  const avatar =
    requestedAvatar &&
    requestedAvatar.length <= 5000 &&
    (requestedAvatar.startsWith("https://") ||
      requestedAvatar.startsWith("data:image/svg+xml;charset=UTF-8,"))
      ? requestedAvatar
      : (session.user.image ?? "https://i.pravatar.cc/100?img=12");

  const user = {
    userId,
    name: nickname || "Player",
    avatar,
    language: learning,
    nativeLang,
    level,
    mode,
  };

  const match = await tryMatch(user);

  if (!match) {
    return NextResponse.json({ status: "waiting" });
  }

  // An opponent was there, but there are no words to duel over at this level.
  if (match.error === "no-words") {
    return NextResponse.json(
      { error: "No words available for this language pair and level yet." },
      { status: 503 },
    );
  }

  return NextResponse.json({
    status: "matched",
    matchId: match.match.id,
    opponent: match.waiting,
  });
}
