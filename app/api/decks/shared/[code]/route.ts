import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSharePreview, joinSharedDeck } from "../../_lib/deckSharing";

interface RouteContext {
  params: Promise<{ code: string }>;
}

/**
 * Preview a shared deck. Open to anyone holding the link — the point is that a
 * friend can see what they were sent before deciding to sign in.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { code } = await context.params;
  const preview = await getSharePreview(code);
  if (!preview) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  return NextResponse.json({ preview });
}

/** Join the deck behind the link. Needs an account to hang the access on. */
export async function POST(_request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await context.params;
  const result = await joinSharedDeck(session.user.id, code);
  if (result.status === "not-found") {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  return NextResponse.json(result);
}
