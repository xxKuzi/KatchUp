import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { MAX_ENERGY } from "@/app/_lib/energyConstants";
import { spendEnergy } from "../_lib/store";

/** Read a positive whole amount from the body, defaulting to a single point. */
function requestedAmount(body: unknown, ceiling: number): number {
  const raw =
    body && typeof body === "object"
      ? (body as Record<string, unknown>).amount
      : undefined;

  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return 1;
  }

  return Math.max(1, Math.min(ceiling, Math.floor(raw)));
}

/**
 * Charge the signed-in player for a finished round.
 * POST /api/energy/spend  { amount?: number }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const amount = requestedAmount(body, MAX_ENERGY);

  const snapshot = await spendEnergy(session.user.id, amount);
  return NextResponse.json(snapshot);
}
