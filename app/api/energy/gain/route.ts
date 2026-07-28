import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ENERGY_PRACTICE_REWARD } from "@/app/_lib/energyConstants";
import { gainEnergy } from "../_lib/store";

/**
 * Pay the signed-in player back for a finished practice round.
 * POST /api/energy/gain  { amount?: number }
 *
 * One round is worth ENERGY_PRACTICE_REWARD and no more, whatever the body
 * asks for; the store applies the separate daily ceiling on top.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const raw =
    body && typeof body === "object"
      ? (body as Record<string, unknown>).amount
      : undefined;

  const amount =
    typeof raw === "number" && Number.isFinite(raw)
      ? Math.max(1, Math.min(ENERGY_PRACTICE_REWARD, Math.floor(raw)))
      : ENERGY_PRACTICE_REWARD;

  const snapshot = await gainEnergy(session.user.id, amount);
  return NextResponse.json(snapshot);
}
