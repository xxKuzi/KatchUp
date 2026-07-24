import { redis } from "@/lib/redis";

export const DAILY_DECK_LIMIT = 2;

export type DeckLanguage = "english" | "czech" | "deutsch";

// Human-readable names Gemini understands unambiguously in the prompt.
const LANGUAGE_NAMES: Record<DeckLanguage, string> = {
  english: "English",
  czech: "Czech",
  deutsch: "German",
};

export interface GeneratedWord {
  native: string;
  foreign: string;
}

export function isDeckLanguage(value: unknown): value is DeckLanguage {
  return value === "english" || value === "czech" || value === "deutsch";
}

function utcDateKey(): string {
  // e.g. "2026-07-24" — rolls over at UTC midnight.
  return new Date().toISOString().slice(0, 10);
}

function secondsUntilUtcMidnight(): number {
  const now = new Date();
  const nextMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  return Math.max(60, Math.ceil((nextMidnight - now.getTime()) / 1000));
}

function limitKey(userId: string): string {
  return `deckgen:${userId}:${utcDateKey()}`;
}

/**
 * Atomically reserve one generation for today. Returns whether the reservation
 * succeeded and how many remain. Refund with `refundGeneration` if the AI call
 * later fails so the user isn't charged for a failed attempt.
 */
export async function reserveGeneration(
  userId: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const key = limitKey(userId);
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, secondsUntilUtcMidnight());
  }

  if (count > DAILY_DECK_LIMIT) {
    await redis.decr(key);
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: DAILY_DECK_LIMIT - count };
}

export async function refundGeneration(userId: string): Promise<void> {
  const count = await redis.decr(limitKey(userId));
  if (count < 0) {
    // Never let the counter go negative.
    await redis.set(limitKey(userId), 0);
  }
}

export async function getRemainingGenerations(userId: string): Promise<number> {
  const used = (await redis.get<number>(limitKey(userId))) ?? 0;
  return Math.max(0, DAILY_DECK_LIMIT - used);
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

/**
 * Ask Gemini for `count` native/foreign word pairs on `topic`.
 * Throws on missing API key, network/API failure, or unparseable output.
 */
export async function generateDeckWords(params: {
  topic: string;
  nativeLang: DeckLanguage;
  foreignLang: DeckLanguage;
  count: number;
}): Promise<GeneratedWord[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const nativeName = LANGUAGE_NAMES[params.nativeLang];
  const foreignName = LANGUAGE_NAMES[params.foreignLang];
  const count = Math.min(30, Math.max(4, Math.round(params.count)));

  const prompt = [
    `You are helping build a language-learning flashcard deck.`,
    `Topic: "${params.topic}".`,
    `Produce exactly ${count} vocabulary pairs useful for this topic.`,
    `Each pair has "native" (the word/phrase in ${nativeName}) and "foreign" (its translation in ${foreignName}).`,
    `Use natural, commonly used words. Do not repeat pairs. Keep entries short (1-4 words).`,
  ].join(" ");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              words: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    native: { type: "string" },
                    foreign: { type: "string" },
                  },
                  required: ["native", "foreign"],
                },
              },
            },
            required: ["words"],
          },
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Gemini request failed (${response.status}): ${detail.slice(0, 200)}`,
    );
  }

  const data = (await response.json()) as GeminiResponse;
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const text = parts.find((part) => typeof part.text === "string")?.text;
  if (!text) {
    throw new Error("Gemini returned no content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini returned malformed JSON");
  }

  const rawWords = (parsed as { words?: unknown }).words;
  if (!Array.isArray(rawWords)) {
    throw new Error("Gemini response missing words array");
  }

  const words = rawWords
    .map((item) => {
      const record = (item ?? {}) as Record<string, unknown>;
      return {
        native: typeof record.native === "string" ? record.native.trim() : "",
        foreign:
          typeof record.foreign === "string" ? record.foreign.trim() : "",
      };
    })
    .filter((word) => word.native && word.foreign)
    .slice(0, count);

  if (words.length === 0) {
    throw new Error("Gemini produced no usable words");
  }

  return words;
}
