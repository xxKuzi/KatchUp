export interface LearnedWordItem {
  id: string;
  native: string;
  foreign: string;
  source: "deck" | "lecture";
  sourceLabel: string;
  status: "learned" | "skipped";
  times: number | null;
  updatedAt: string | null;
}

export interface LearnedWordsPage {
  items: LearnedWordItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export async function fetchLearnedWords(page: number): Promise<LearnedWordsPage> {
  const res = await fetch(`/api/learned-words?page=${page}`);
  const data = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const message =
      (data as { error?: string } | null)?.error ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }
  return data as LearnedWordsPage;
}
