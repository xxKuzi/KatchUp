import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { readEnergy } from "./_lib/store";

/**
 * Today's energy for the signed-in player.
 * GET /api/energy
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshot = await readEnergy(session.user.id);
  return NextResponse.json(snapshot);
}
