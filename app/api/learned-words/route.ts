import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchLearnedWords } from "./_lib/server";

const PAGE_SIZE = 30;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pageParam = Number(request.nextUrl.searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

  const result = await fetchLearnedWords(session.user.id, page, PAGE_SIZE);
  return NextResponse.json(result);
}
