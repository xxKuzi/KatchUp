import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userProfiles, friendships, matches, matchQuestions, matchPlayers } from "@/db/schema";
import { eq, and, or } from "drizzle-orm";
import { auth } from "@/auth";
import { pusher } from "@/lib/realtime/pusher-server";
import { createMatchQuestions, createPersonalMatchQuestions } from "@/app/api/flip-cards/_lib/server";
import { normalizeLang, isCefrLevel } from "@/app/_lib/languages";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const currentUserId = session.user.id;

  const body = (await request.json().catch(() => null)) as {
    partnerProfileCode?: string;
    language?: string;
    nativeLang?: string;
    level?: string;
    mode?: string;
  } | null;

  if (!body || typeof body.partnerProfileCode !== "string") {
    return NextResponse.json({ error: "partnerProfileCode is required" }, { status: 400 });
  }

  const partnerProfileCode = body.partnerProfileCode.trim().toLowerCase();
  const learning = normalizeLang(body.language) ?? "de";
  const nativeLang = normalizeLang(body.nativeLang) ?? "en";
  const level = body.level?.toUpperCase() ?? "A1";
  const mode = body.mode === "personal" ? "personal" : "fair";

  if (!isCefrLevel(level)) {
    return NextResponse.json({ error: "Invalid CEFR level" }, { status: 400 });
  }

  // Resolve target partner profile
  const partnerProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.profileCode, partnerProfileCode),
  });

  if (!partnerProfile) {
    return NextResponse.json({ error: "Partner profile not found" }, { status: 404 });
  }

  const friendUserId = partnerProfile.userId;

  // Verify friendship exists and is accepted
  const friendship = await db.query.friendships.findFirst({
    where: and(
      eq(friendships.status, "accepted"),
      or(
        and(eq(friendships.userId, currentUserId), eq(friendships.friendUserId, friendUserId)),
        and(eq(friendships.userId, friendUserId), eq(friendships.friendUserId, currentUserId))
      )
    ),
  });

  if (!friendship) {
    return NextResponse.json({ error: "You must be accepted friends to play a duel" }, { status: 400 });
  }

  try {
    const pair = {
      speak: nativeLang,
      learning,
      level,
    };

    // Generate question sets based on mode selection
    interface QuestionPayload {
      userId: string | null;
      questions: any[];
    }

    let questionSets: QuestionPayload[] = [];

    if (mode === "personal") {
      const [questionsA, questionsB] = await Promise.all([
        createPersonalMatchQuestions(currentUserId, pair),
        createPersonalMatchQuestions(friendUserId, pair),
      ]);
      questionSets = [
        { userId: currentUserId, questions: questionsA },
        { userId: friendUserId, questions: questionsB },
      ];
    } else {
      const questionsGeneric = await createMatchQuestions(pair);
      questionSets = [
        { userId: null, questions: questionsGeneric },
      ];
    }

    if (questionSets.some((set) => !set.questions || set.questions.length === 0)) {
      return NextResponse.json(
        { error: "No words available for this language pair and level yet." },
        { status: 503 }
      );
    }

    // Create match row
    const [match] = await db
      .insert(matches)
      .values({
        language: learning,
        nativeLang: nativeLang,
        level: level,
        mode: mode,
        status: "pending",
      })
      .returning();

    // Insert questions
    await db.insert(matchQuestions).values(
      questionSets.flatMap((set) =>
        set.questions.map((question, orderIndex) => ({
          matchId: match.id,
          userId: set.userId,
          orderIndex,
          prompt: question.prompt,
          options: question.options,
          correctOption: question.correctOption,
          conceptId: question.conceptId,
        }))
      )
    );

    // Get current user's profile info
    const profileA = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, currentUserId),
    });

    // Insert players
    const playerRows = [
      {
        matchId: match.id,
        userId: currentUserId,
        side: "player1",
        displayName: profileA?.nickname || "Player 1",
        displayAvatar: profileA?.avatarIcon || "https://i.pravatar.cc/100?img=12",
        nativeLang,
        language: learning,
        level,
        acceptedAt: new Date(), // Challenger is auto-accepted
      },
      {
        matchId: match.id,
        userId: friendUserId,
        side: "player2",
        displayName: partnerProfile.nickname || "Player 2",
        displayAvatar: partnerProfile.avatarIcon || "https://i.pravatar.cc/100?img=34",
        nativeLang,
        language: learning,
        level,
      },
    ];
    await db.insert(matchPlayers).values(playerRows);

    // Trigger Pusher invite event to partner
    try {
      await pusher.trigger(`user-${friendUserId}`, "duel-invite", {
        matchId: match.id,
        challengerName: profileA?.nickname || "Your friend",
        challengerAvatar: profileA?.avatarIcon || "https://i.pravatar.cc/100?img=12",
        language: learning,
        nativeLang,
        level,
        mode,
      });
    } catch (pusherErr) {
      console.error("Failed to trigger duel invite pusher event:", pusherErr);
    }

    return NextResponse.json({ matchId: match.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Failed to create duel invite" }, { status: 500 });
  }
}
