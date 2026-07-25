/**
 * Shared plumbing for the vocabulary corpus scripts (generate-concepts,
 * add-concepts). Holds the Gemini call, the on-disk format for
 * data/concepts.json, and the slug/level helpers both need.
 */

import fs from "fs";
import path from "path";
import { CEFR_LEVELS, type CefrLevel, type Lang } from "../../app/_lib/languages";

/** Dependency-free .env loader — no runtime deps in the scripts folder. */
export function loadEnv(): void {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2] || "";
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value.trim();
  }
}

export const MODEL = "gemini-flash-lite-latest";
export const REQUEST_SLEEP_MS = 2000;
export const MAX_ATTEMPTS = 3;

export const OUTPUT_PATH = path.resolve(process.cwd(), "data", "concepts.json");

export interface Translation {
  text: string;
  level: CefrLevel;
}

export interface Concept {
  conceptKey: string;
  category: string;
  /** Keyed by language code; "en" is always present. */
  translations: Partial<Record<Lang, Translation>>;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function coerceLevel(value: unknown, fallback: CefrLevel): CefrLevel {
  if (typeof value !== "string") return fallback;
  const upper = value.trim().toUpperCase();
  return (CEFR_LEVELS as readonly string[]).includes(upper)
    ? (upper as CefrLevel)
    : fallback;
}

export interface GeminiSchema {
  type: string;
  items?: GeminiSchema;
  properties?: Record<string, GeminiSchema>;
  required?: string[];
}

export async function callGemini<T>(
  prompt: string,
  schema: GeminiSchema,
): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in the environment.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: schema,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`${response.status} — ${await response.text()}`);
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error("Empty response from Gemini");

      return JSON.parse(rawText) as T;
    } catch (error) {
      lastError = error;
      console.warn(`  attempt ${attempt}/${MAX_ATTEMPTS} failed: ${error}`);
      if (attempt < MAX_ATTEMPTS) await sleep(REQUEST_SLEEP_MS * attempt * 2);
    }
  }

  throw lastError;
}

export function loadConcepts(): Concept[] {
  if (!fs.existsSync(OUTPUT_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8")) as Concept[];
  } catch {
    console.warn("Could not parse existing concepts.json, starting fresh.");
    return [];
  }
}

export function saveConcepts(concepts: Concept[]): void {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(concepts, null, 2), "utf8");
}
