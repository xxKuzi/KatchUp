import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  removeDeckMember,
  setMemberRole,
  toShareRole,
} from "../../../_lib/deckSharing";

interface RouteContext {
  params: Promise<{ deckId: string; memberId: string }>;
}

/**
 * "me" stands in for the caller, so the "leave this deck" button does not need
 * to know its own user id.
 */
function resolveMemberId(memberId: string, userId: string): string {
  return memberId === "me" ? userId : memberId;
}

/** Owner promotes a member to editor, or drops them back to viewer. */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { deckId, memberId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    role?: unknown;
  } | null;

  const updated = await setMemberRole(
    session.user.id,
    deckId,
    resolveMemberId(memberId, session.user.id),
    toShareRole(body?.role),
  );
  if (!updated) {
    return NextResponse.json(
      { error: "Deck not found or not yours" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}

/** Owner removes someone; anyone else leaves a deck shared with them. */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { deckId, memberId } = await context.params;
  const removed = await removeDeckMember(
    session.user.id,
    deckId,
    resolveMemberId(memberId, session.user.id),
  );
  if (!removed) {
    return NextResponse.json(
      { error: "Deck not found or not yours" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
