/**
 * Builds the unified 4-language vocabulary corpus.
 *
 * Replaces scripts/generate-words.ts, which generated each language
 * independently and so produced three unrelated word lists (only 10% of
 * concepts existed in all three, and 43% of the shared ones disagreed on CEFR
 * level). Here a single English spine is generated once, then translated into
 * every other language in one request per batch — fewer API calls than
 * per-language generation, and every concept is aligned across all languages.
 *
 * Output: data/concepts.json. Resumable — rerun to fill whatever is missing.
 *
 *   npx tsx scripts/generate-concepts.ts
 */

import fs from "fs";
import path from "path";
import {
  CEFR_LEVELS,
  LANGS,
  LANG_ENGLISH_NAMES,
  type CefrLevel,
  type Lang,
} from "../app/_lib/languages";

// Dependency-free .env loader (same approach as scripts/generate-words.ts).
function loadEnv() {
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

loadEnv();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("Error: GEMINI_API_KEY is not defined in the environment.");
  process.exit(1);
}

const MODEL = "gemini-flash-lite-latest";
const CONCEPTS_PER_LEVEL = 200;
/**
 * How many existing words to show the model as "already used".
 *
 * Not the whole corpus: the list is the bulk of the prompt, and past a few
 * thousand it costs more than the duplicates it prevents. Duplicates that slip
 * through are dropped on the way in, so this only affects how much of each
 * request is wasted.
 */
const EXCLUDE_SAMPLE = 1200;
const TRANSLATE_BATCH = 50;
const REQUEST_SLEEP_MS = 2000;
const MAX_ATTEMPTS = 3;

/** Languages to translate into — everything except the English spine itself. */
const TARGET_LANGS = LANGS.filter((lang): lang is Exclude<Lang, "en"> => lang !== "en");

const OUTPUT_PATH = path.resolve(process.cwd(), "data", "concepts.json");

interface Translation {
  text: string;
  level: CefrLevel;
}

interface Concept {
  conceptKey: string;
  category: string;
  /** Keyed by language code; "en" is always present once the spine is built. */
  translations: Partial<Record<Lang, Translation>>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function coerceLevel(value: unknown, fallback: CefrLevel): CefrLevel {
  if (typeof value !== "string") return fallback;
  const upper = value.trim().toUpperCase();
  return (CEFR_LEVELS as readonly string[]).includes(upper)
    ? (upper as CefrLevel)
    : fallback;
}

// ---------------------------------------------------------------- Gemini ----

interface GeminiSchema {
  type: string;
  items?: GeminiSchema;
  properties?: Record<string, GeminiSchema>;
  required?: string[];
}

async function callGemini<T>(prompt: string, schema: GeminiSchema): Promise<T> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY as string,
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

// ------------------------------------------------- Stage A: English spine ----

const SPINE_SCHEMA: GeminiSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      english: { type: "string" },
      category: { type: "string" },
    },
    required: ["english", "category"],
  },
};

/** A random slice of the used keys, so no part of the corpus is always unseen. */
function sampleKeys(keys: Set<string>, limit: number): string[] {
  const all = Array.from(keys);
  if (all.length <= limit) {
    return all;
  }
  for (let i = all.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, limit);
}

async function generateSpineForLevel(
  level: CefrLevel,
  exclude: Set<string>,
  need: number,
): Promise<Concept[]> {
  // A prompt cannot carry the whole corpus once it passes a few thousand words,
  // and the first 900 keys are the *oldest* ones — so the model was being shown
  // a slice that no longer reflects what exists and kept proposing words already
  // in the file. Sampling at random spreads the blind spot instead of parking it
  // over everything added recently.
  const excerpt = sampleKeys(exclude, EXCLUDE_SAMPLE).join(", ");
  const prompt = `Generate exactly ${need} distinct English vocabulary words appropriate for CEFR level ${level}.

Rules:
- Order by how frequently the word is used in everyday English, most common first.
- Use the plain dictionary form, lowercase (e.g. "bread", "to run" -> "run").
- Single words or very short phrases only. No sentences.
- Each must be a concrete, translatable concept — avoid proper nouns.
- "category": one lowercase word (e.g. general, food, travel, home, animals, clothing, family, nature, body, work, school, verbs, adjectives, time, emotions).
${excerpt ? `\nDo NOT include any of these already-used words:\n${excerpt}` : ""}`;

  const rows = await callGemini<Array<{ english: string; category: string }>>(
    prompt,
    SPINE_SCHEMA,
  );

  const concepts: Concept[] = [];
  for (const row of rows) {
    const english = row.english?.trim().toLowerCase();
    if (!english) continue;

    const conceptKey = slugify(english);
    if (!conceptKey || exclude.has(conceptKey)) continue;

    exclude.add(conceptKey);
    concepts.push({
      conceptKey,
      category: (row.category ?? "general").trim().toLowerCase() || "general",
      translations: { en: { text: english, level } },
    });
  }

  return concepts;
}

async function buildSpine(existing: Concept[]): Promise<Concept[]> {
  const concepts = [...existing];
  const seen = new Set(concepts.map((c) => c.conceptKey));

  for (const level of CEFR_LEVELS) {
    const have = concepts.filter((c) => c.translations.en?.level === level).length;
    let missing = CONCEPTS_PER_LEVEL - have;

    if (missing <= 0) {
      console.log(`Spine ${level}: already have ${have}, skipping.`);
      continue;
    }

    // The model dedupes imperfectly against the exclusion list, so top up.
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && missing > 0; attempt += 1) {
      console.log(`Spine ${level}: requesting ${missing} (attempt ${attempt})...`);
      const fresh = await generateSpineForLevel(level, seen, missing);
      concepts.push(...fresh);
      missing -= fresh.length;
      console.log(`  got ${fresh.length} new, ${Math.max(0, missing)} still missing.`);
      await sleep(REQUEST_SLEEP_MS);
    }

    save(concepts);
  }

  return concepts;
}

// ---------------------------------------------------- Stage B: translate ----

function buildTranslateSchema(): GeminiSchema {
  const perLang: Record<string, GeminiSchema> = {
    english: { type: "string" },
  };

  for (const lang of TARGET_LANGS) {
    perLang[lang] = {
      type: "object",
      properties: { text: { type: "string" }, level: { type: "string" } },
      required: ["text", "level"],
    };
  }

  return {
    type: "array",
    items: {
      type: "object",
      properties: perLang,
      required: ["english", ...TARGET_LANGS],
    },
  };
}

type TranslateRow = { english: string } & Record<
  string,
  { text: string; level: string } | string
>;

async function translateBatch(batch: Concept[]): Promise<void> {
  const langList = TARGET_LANGS.map(
    (lang) => `"${lang}" (${LANG_ENGLISH_NAMES[lang]})`,
  ).join(", ");

  const words = batch.map((c) => c.translations.en!.text).join("\n");

  const prompt = `For each English word below, provide translations into ${langList}.

For every translation give:
- "text": the translation in correct dictionary form, with proper casing and accents (German nouns capitalised e.g. "Brot"; Spanish accents kept e.g. "habitación"; Czech diacritics kept e.g. "město").
- "level": the CEFR level (one of A1, A2, B1, B2, C1) at which a learner OF THAT LANGUAGE would typically meet this word.

Important: judge the level per language, not per concept. Take cognates into account — a word nearly identical to its English form is much easier and deserves a lower level than an unrelated word for the same concept. For example "hospital" is trivial in Spanish but harder in German ("Krankenhaus") and Czech ("nemocnice").

Return one object per input word, echoing the word in "english". Keep the same order.

Words:
${words}`;

  const rows = await callGemini<TranslateRow[]>(prompt, buildTranslateSchema());

  const byKey = new Map(batch.map((c) => [c.conceptKey, c]));
  let filled = 0;

  for (const row of rows) {
    const concept = byKey.get(slugify(String(row.english ?? "")));
    if (!concept) continue;

    for (const lang of TARGET_LANGS) {
      // Never overwrite a translation that is already there. Words added by
      // `fill-language-level` arrive with their target language pinned to the
      // band they were generated for, and re-rating it here would undo exactly
      // the gap that script was run to close.
      if (concept.translations[lang]?.text) continue;

      const value = row[lang];
      if (!value || typeof value === "string") continue;

      const text = value.text?.trim();
      if (!text) continue;

      concept.translations[lang] = {
        text,
        level: coerceLevel(value.level, concept.translations.en!.level),
      };
      filled += 1;
    }
  }

  console.log(`  filled ${filled} translations.`);
}

function isComplete(concept: Concept): boolean {
  return LANGS.every((lang) => Boolean(concept.translations[lang]?.text));
}

async function translateAll(concepts: Concept[]): Promise<void> {
  const pending = concepts.filter((c) => !isComplete(c));
  console.log(
    `\n${concepts.length - pending.length}/${concepts.length} concepts already complete.`,
  );

  for (let i = 0; i < pending.length; i += TRANSLATE_BATCH) {
    const batch = pending.slice(i, i + TRANSLATE_BATCH);
    const batchNum = Math.floor(i / TRANSLATE_BATCH) + 1;
    const total = Math.ceil(pending.length / TRANSLATE_BATCH);

    console.log(`Translating batch ${batchNum}/${total} (${batch.length} words)...`);
    try {
      await translateBatch(batch);
    } catch (error) {
      console.error(`  batch failed, leaving for next run: ${error}`);
    }

    save(concepts); // checkpoint after every batch so a crash costs one batch
    await sleep(REQUEST_SLEEP_MS);
  }
}

// ------------------------------------------------------------------- io ----

function load(): Concept[] {
  if (!fs.existsSync(OUTPUT_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8")) as Concept[];
  } catch {
    console.warn("Could not parse existing concepts.json, starting fresh.");
    return [];
  }
}

function save(concepts: Concept[]): void {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(concepts, null, 2), "utf8");
}

/**
 * Skips growing the English spine and only fills in missing translations.
 * What you want after `fill-language-level` has added words that already have
 * their English and their target language, and need the other two.
 */
const TRANSLATE_ONLY = process.argv.includes("--translate-only");

async function run() {
  const existing = load();
  if (existing.length) {
    console.log(`Resuming from ${existing.length} existing concepts.\n`);
  }

  const concepts = TRANSLATE_ONLY ? existing : await buildSpine(existing);
  if (!TRANSLATE_ONLY) {
    save(concepts);
    console.log(`\nSpine complete: ${concepts.length} concepts.`);
  }

  await translateAll(concepts);

  const complete = concepts.filter(isComplete).length;
  console.log(
    `\nDone. ${complete}/${concepts.length} concepts complete across all ${LANGS.length} languages.`,
  );
  if (complete < concepts.length) {
    console.log("Rerun to fill the remainder.");
  }
  console.log(`Written to ${OUTPUT_PATH}`);
}

run().catch((error) => {
  console.error("Execution failed:", error);
  process.exit(1);
});
