import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  AD_MIN_WATCH_MS,
  ENERGY_AD_REWARD,
} from "@/app/_lib/energyConstants";
import { consumeAdTicket, gainEnergy, readEnergy } from "../../_lib/store";

/**
 * Pay out for a rewarded video the player sat through.
 * POST /api/energy/ad/claim  { ticket: string }
 *
 * The amount is fixed here rather than read from the body: the browser says
 * which ad finished, never what it was worth. A ticket only pays once, so a
 * replayed request gets a 409 and today's total stays where it was.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const ticket =
    body && typeof body === "object"
      ? (body as Record<string, unknown>).ticket
      : undefined;

  if (typeof ticket !== "string" || !ticket) {
    return NextResponse.json({ error: "Missing ticket" }, { status: 400 });
  }

  const result = await consumeAdTicket(
    session.user.id,
    ticket,
    AD_MIN_WATCH_MS,
  );

  if (!result.ok) {
    // A spent or expired ticket is the ordinary shape of a double claim, so it
    // answers with the real meter rather than an error the UI has to invent a
    // number for.
    const snapshot = await readEnergy(session.user.id);
    return NextResponse.json(
      { ...snapshot, error: result.reason },
      { status: result.reason === "unknown" ? 409 : 400 },
    );
  }

  const snapshot = await gainEnergy(session.user.id, ENERGY_AD_REWARD, "ad");
  return NextResponse.json(snapshot);
}
