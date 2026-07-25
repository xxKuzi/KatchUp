import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { forfeitMatch } from "@/app/api/flip-cards/_lib/server";

/**
 * Close out a live match the player walked away from, so it can't linger as
 * "active" and be served back to either side later.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ matchId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { matchId } = await context.params;
  await forfeitMatch(matchId, session.user.id);

  return NextResponse.json({ ok: true });
}
