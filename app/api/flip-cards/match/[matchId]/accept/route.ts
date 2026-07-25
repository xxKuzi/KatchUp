import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { acceptMatch } from "@/app/api/flip-cards/_lib/server";

/**
 * A found duel doesn't start until both players say yes. This records one
 * side's acceptance and, once the second lands, sets the shared start time.
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
  const result = await acceptMatch(matchId, session.user.id);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    status: result.status,
    startAt: result.startAt,
  });
}
