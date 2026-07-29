import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getShareLink,
  listDeckMembers,
  revokeShareLink,
  toShareRole,
  upsertShareLink,
} from "../../_lib/deckSharing";

interface RouteContext {
  params: Promise<{ deckId: string }>;
}

/** The deck's share link and who has joined so far. Owner only. */
export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { deckId } = await context.params;
  const members = await listDeckMembers(session.user.id, deckId);
  if (members === null) {
    return NextResponse.json(
      { error: "Deck not found or not yours" },
      { status: 404 },
    );
  }

  const share = await getShareLink(session.user.id, deckId);
  return NextResponse.json({ share, members });
}

/** Creates the link, or switches it between view-only and editable. */
export async function POST(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { deckId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    role?: unknown;
  } | null;

  const share = await upsertShareLink(
    session.user.id,
    deckId,
    toShareRole(body?.role),
  );
  if (!share) {
    return NextResponse.json(
      { error: "Deck not found or not yours" },
      { status: 404 },
    );
  }

  return NextResponse.json({ share });
}

/** Turns the link off. People who already joined keep their access. */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { deckId } = await context.params;
  const revoked = await revokeShareLink(session.user.id, deckId);
  if (!revoked) {
    return NextResponse.json(
      { error: "Deck not found or not yours" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
