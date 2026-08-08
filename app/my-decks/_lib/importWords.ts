import { normalizeArticle, splitInlineArticle } from "@/app/_lib/articles";
import type { Lang } from "@/app/_lib/languages";
import { normalizeVocabText } from "@/app/api/decks/_lib/vocabIdentity";

/**
 * Turns a file someone pasted into deck rows.
 *
 * People arrive with word lists already written — exported from another app, or
 * asked out of a chatbot — and the only way in was retyping them one at a time.
 * The formats below are what those sources actually emit, so the parser forgives
 * shape rather than making the user reshape their file.
 *
 * Nothing here touches the corpus. An imported word is exactly a typed word: the
 * server links it to a concept on save if the pair matches unambiguously, and
 * leaves it as free text if not. Free text is still tracked — progress keys on
 * `vocabKey`, which falls back to the normalised pair — so an unmatched word
 * learns and counts like any other. Importing must never *create* concepts: one
 * user's typo would become everyone's vocabulary.
 */

/** A row ready to become a `DeckWordRecord`. */
export interface ImportedWord {
  native: string;
  foreign: string;
  article: string | null;
}

export interface ParsedImport {
  words: ImportedWord[];
  /** Rows dropped for missing a side. */
  skipped: number;
  /** Rows dropped as repeats of an earlier row in the same file. */
  duplicates: number;
  /** Rows dropped for being past MAX_IMPORT_WORDS. */
  truncated: number;
}

/**
 * Enough for any hand-made list, small enough that one PATCH still fits a
 * request body and the editor stays responsive holding the draft.
 */
export const MAX_IMPORT_WORDS = 500;

/** Key spellings seen in the wild, all lowercase — see `pick`. */
const NATIVE_KEYS = ["native", "source", "front", "term", "word"];
const FOREIGN_KEYS = ["foreign", "target", "back", "translation"];
const ARTICLE_KEYS = ["article", "gender"];

/** First matching key of `candidates`, compared case-insensitively. */
function pick(row: Record<string, unknown>, candidates: string[]): unknown {
  const lowered = new Map(
    Object.keys(row).map((key) => [key.toLowerCase(), key]),
  );
  for (const candidate of candidates) {
    const actual = lowered.get(candidate);
    if (actual !== undefined && row[actual] != null) {
      return row[actual];
    }
  }
  return undefined;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Reduces the three accepted containers to one list of raw pairs.
 *
 * Throws for anything else, because a wrong *shape* is worth a message — unlike
 * a wrong row, which is worth a silent skip and a count.
 */
function toRows(parsed: unknown): { native: unknown; foreign: unknown; article: unknown }[] {
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { words?: unknown }).words)
      ? ((parsed as { words: unknown[] }).words)
      : null;

  if (list) {
    return list.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return { native: undefined, foreign: undefined, article: undefined };
      }
      const row = item as Record<string, unknown>;
      return {
        native: pick(row, NATIVE_KEYS),
        foreign: pick(row, FOREIGN_KEYS),
        article: pick(row, ARTICLE_KEYS),
      };
    });
  }

  // Flat map: { "dog": "Hund" }. Key is native, value is foreign — the direction
  // a person writes a glossary in.
  if (parsed && typeof parsed === "object") {
    const entries = Object.entries(parsed as Record<string, unknown>);
    if (entries.length > 0 && entries.every(([, value]) => typeof value === "string")) {
      return entries.map(([native, foreign]) => ({
        native,
        foreign,
        article: undefined,
      }));
    }
  }

  throw new Error(
    "Expected a list of words. See the format help below for the shapes that work.",
  );
}

/**
 * Parses JSON text into deck rows.
 *
 * `foreignLang` decides what counts as an article: unrecognised ones are dropped
 * rather than stored, and a language without articles ignores the field
 * entirely. Throws only for input that is not readable at all — bad JSON, or a
 * shape with no words in it.
 */
export function parseWordsJson(
  raw: string,
  foreignLang: Lang | null,
): ParsedImport {
  const text = raw.trim();
  if (!text) {
    throw new Error("Nothing to import — paste some JSON or choose a file.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(text));
  } catch {
    throw new Error(
      "That is not valid JSON. Check for a missing comma, quote or bracket.",
    );
  }

  const rows = toRows(parsed);

  const words: ImportedWord[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  let duplicates = 0;
  let truncated = 0;

  for (const row of rows) {
    const native = asText(row.native);
    const rawForeign = asText(row.foreign);
    if (!native || !rawForeign) {
      skipped += 1;
      continue;
    }

    // An article typed into the foreign field is still the article, just in the
    // wrong box — the same nudge `handleAddWord` gives words typed by hand. Only
    // when the row did not name one itself.
    const declared = normalizeArticle(row.article, foreignLang);
    const inline = splitInlineArticle(rawForeign, foreignLang);
    const article = declared ?? inline.article;
    const foreign = declared ? rawForeign : inline.text;

    // Repeats inside one file, so the preview count is honest. The server
    // de-dupes against the rest of the deck on save; this cannot see that far.
    const key = `${normalizeVocabText(native)}|${normalizeVocabText(foreign)}`;
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);

    if (words.length >= MAX_IMPORT_WORDS) {
      truncated += 1;
      continue;
    }
    words.push({ native, foreign, article });
  }

  if (words.length === 0) {
    throw new Error(
      skipped > 0
        ? "No usable words — every row was missing its native or foreign side."
        : "That file holds no words.",
    );
  }

  return { words, skipped, duplicates, truncated };
}

/**
 * Drops the ```json fence a chatbot wraps its answer in, which is the single
 * most common reason a paste fails to parse.
 */
function stripCodeFence(text: string): string {
  if (!text.startsWith("```")) {
    return text;
  }
  return text
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/```$/, "")
    .trim();
}

/**
 * The prompt to hand a chatbot, wired to this deck's own languages so it can be
 * pasted without editing. Spells out the article rule because models default to
 * writing "der Hund" into one field, which then has to be unpicked.
 */
export function buildImportPrompt(
  nativeName: string,
  foreignName: string,
  hasArticle: boolean,
): string {
  const articleRule = hasArticle
    ? `"article" (the definite article of the ${foreignName} word, or null if it has none).\nPut the article only in "article", never inside "foreign".`
    : `"article" (always null — ${foreignName} has no articles).`;

  return [
    `Give me a JSON array of 20 vocabulary words about TOPIC.`,
    `Each item must have exactly these keys:`,
    `"native" (the word in ${nativeName}), "foreign" (the word in ${foreignName}), and ${articleRule}`,
    `Return only the JSON array — no explanation and no markdown code fences.`,
    `Example: [{"native":"dog","foreign":"Hund","article":"der"}]`,
  ].join("\n");
}
