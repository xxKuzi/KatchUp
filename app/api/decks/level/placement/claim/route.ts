import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { levelProgressFromMasteredCount } from "@/app/_lib/level";
import {
  getEffectiveMasteredCount,
  raiseWordFloor,
} from "../../../_lib/levelProgress";
import { placementOpen } from "../_lib/placementOpen";
import { readPlacementTicket } from "../_lib/ticket";

/**
 * Puts a placement sat before signing up onto the account that just appeared.
 *
 * A visitor takes the same test a player does, but there was no account to
 * record it against at the time — so the grade came back as a signed ticket and
 * waited in their browser. This is where it is spent: the ticket is re-read on
 * the server, and what it says becomes the account's word floor, the same as if
 * they had sat the test signed in.
 *
 * Idempotent on purpose. The browser hands the ticket over on the first load
 * after signing in, and that load can be repeated — by a refresh, by a second
 * tab, by signing in again on another device with the same ticket still stored.
 * A language that has already been placed or started is not an error here; it
 * is just a ticket arriving after the answer it carries stopped mattering, and
 * `raiseWordFloor` never lowers anything anyway.
 *
 * POST /api/decks/level/placement/claim  { ticket }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = (await request.json().catch(() => null)) as {
    ticket?: unknown;
  } | null;

  const ticket = readPlacementTicket(body?.ticket);

  if (!ticket) {
    return NextResponse.json(
      { error: "That placement result is not valid any more — sit the test again." },
      { status: 400 },
    );
  }

  const open = await placementOpen(userId, ticket.learning);

  if (open) {
    await raiseWordFloor(userId, ticket.learning, ticket.floor);
  }

  const { masteredCount } = await getEffectiveMasteredCount(
    userId,
    ticket.learning,
  );
  const progress = levelProgressFromMasteredCount(masteredCount);

  return NextResponse.json({
    learning: ticket.learning,
    band: progress.band.band,
    level: progress.level,
    masteredCount,
    // False when the account was already past this — the ticket was spent on
    // nothing, and the caller should still throw it away.
    applied: open,
  });
}
