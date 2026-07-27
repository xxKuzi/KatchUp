import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isCefrLevel, normalizeLang } from "@/app/_lib/languages";
import { db } from "@/lib/db";
import { matchPlayers, matches, users } from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import {
  FRESH_MATCH_MS,
  touchQueueEntry,
} from "@/app/api/flip-cards/_lib/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = request.nextUrl;
  const learning = normalizeLang(searchParams.get("language"));
  const nativeLang = normalizeLang(searchParams.get("nativeLang")) ?? "en";
  const level = searchParams.get("level")?.toUpperCase();
  const mode = searchParams.get("mode") === "personal" ? "personal" : "fair";
  const nickname = searchParams.get("nickname")?.trim().slice(0, 24);

  if (!learning || !isCefrLevel(level)) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  // Only a match created by the search that's asking counts. Reporting "any
  // active match" handed players back duels they had already left, which then
  // dropped them straight onto the last question or the result screen.
  const candidates = await db
    .select({
      matchId: matchPlayers.matchId,
      createdAt: matches.createdAt,
      progress: matchPlayers.progress,
      playerLanguage: matchPlayers.language,
      playerNativeLang: matchPlayers.nativeLang,
      playerLevel: matchPlayers.level,
      matchLanguage: matches.language,
      matchNativeLang: matches.nativeLang,
      matchLevel: matches.level,
      mode: matches.mode,
    })
    .from(matchPlayers)
    .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
    .where(
      and(
        eq(matchPlayers.userId, userId),
        inArray(matches.status, ["pending", "active"]),
      ),
    )
    .orderBy(desc(matches.createdAt))
    .limit(5);

  const cutoff = Date.now() - FRESH_MATCH_MS;
  const fresh = candidates.find(
    (candidate) =>
      candidate.createdAt.getTime() >= cutoff &&
      candidate.progress === 0 &&
      candidate.mode === mode &&
      // New matches persist each player's settings. Match-level fallbacks keep
      // fair matches made before those columns were added discoverable.
      (candidate.playerLanguage ?? candidate.matchLanguage) === learning &&
      (candidate.playerNativeLang ?? candidate.matchNativeLang ?? "en") ===
        nativeLang &&
      (candidate.playerLevel ?? candidate.matchLevel) === level,
  );

  // Still searching: this poll doubles as the client's heartbeat. Without it
  // their queue entry ages out and stops being matchable. It deliberately runs
  // only when no match was found, so a player who has just been paired can't
  // re-insert themselves into the queue as a ghost.
  if (!fresh) {
    await touchQueueEntry({
      userId,
      name: nickname || "Player",
      avatar: session.user.image ?? "https://i.pravatar.cc/100?img=12",
      language: learning,
      nativeLang,
      level,
      mode,
    });
    return NextResponse.json({ status: "waiting" });
  }

  const players = await db
    .select({
      id: users.id,
      // The duelling nickname, falling back to the account name only for
      // matches created before nicknames were recorded.
      name: matchPlayers.displayName,
      accountName: users.name,
      avatar: users.image,
    })
    .from(matchPlayers)
    .innerJoin(users, eq(matchPlayers.userId, users.id))
    .where(eq(matchPlayers.matchId, fresh.matchId))
    .limit(2);

  const opponent = players.find((player) => player.id !== userId) ?? null;

  // A match with nobody on the other side would strand the player on a
  // countdown against no one.
  if (!opponent) {
    return NextResponse.json({ status: "waiting" });
  }

  return NextResponse.json({
    status: "matched",
    matchId: fresh.matchId,
    opponent: {
      id: opponent.id,
      name: opponent.name ?? opponent.accountName ?? "Opponent",
      avatar: opponent.avatar,
    },
  });
}
