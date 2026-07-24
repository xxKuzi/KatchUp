import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { selectSessionWords } from "../../_lib/spacedRepetition";

interface RouteContext {
  params: Promise<{ deckId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { deckId } = await context.params;
  const params = request.nextUrl.searchParams;
  const mode = params.get("mode") === "finish" ? "finish" : "practice";

  const sizeParam = params.get("size");
  const parsedSize = sizeParam ? Number.parseInt(sizeParam, 10) : NaN;
  const size =
    Number.isFinite(parsedSize) && parsedSize > 0 && parsedSize <= 50
      ? parsedSize
      : undefined;

  const result = await selectSessionWords(session.user.id, deckId, {
    mode,
    size,
  });

  if (!result) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  return NextResponse.json(result);
}
