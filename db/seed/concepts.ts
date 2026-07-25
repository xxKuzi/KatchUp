import fs from "fs";
import path from "path";
import { inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { conceptTranslations, wordConcepts } from "@/db/schema";
import { isCefrLevel, isLang, type CefrLevel, type Lang } from "@/app/_lib/languages";

// Neon's HTTP driver sends each statement as one request, so keep payloads
// modest rather than inserting all ~4000 rows in a single call.
const BATCH_SIZE = 100;

export interface ConceptSeedRow {
  conceptKey: string;
  category: string;
  lectureIndex?: number | null;
  translations: Partial<Record<Lang, { text: string; level: string }>>;
}

export interface SeedConceptsResult {
  conceptsUpserted: number;
  translationsUpserted: number;
  skipped: string[];
}

function defaultSeedPath(): string {
  return path.resolve(process.cwd(), "data", "concepts.json");
}

export function readConceptSeedFile(filePath = defaultSeedPath()): ConceptSeedRow[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Concept seed file not found: ${filePath}. Run "npx tsx scripts/generate-concepts.ts" first.`,
    );
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as ConceptSeedRow[];
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Load the unified vocabulary corpus into word_concepts + concept_translations.
 *
 * Idempotent: re-running upserts by conceptKey and (conceptId, lang), so it is
 * safe to run after regenerating the corpus. Rows whose language or CEFR level
 * is unrecognised are skipped and reported rather than silently written.
 */
export async function seedConcepts(
  rows: ConceptSeedRow[],
): Promise<SeedConceptsResult> {
  const skipped: string[] = [];

  const conceptValues = rows
    .filter((row) => {
      if (!row.conceptKey?.trim()) {
        skipped.push(`(missing conceptKey)`);
        return false;
      }
      return true;
    })
    .map((row) => ({
      conceptKey: row.conceptKey,
      category: row.category?.trim() || "general",
      lectureIndex: row.lectureIndex ?? null,
    }));

  let conceptsUpserted = 0;
  for (const batch of chunk(conceptValues, BATCH_SIZE)) {
    await db
      .insert(wordConcepts)
      .values(batch)
      .onConflictDoUpdate({
        target: wordConcepts.conceptKey,
        set: {
          category: sqlExcluded("category"),
          lectureIndex: sqlExcluded("lecture_index"),
        },
      });
    conceptsUpserted += batch.length;
  }

  // Resolve ids for every key we just wrote so translations can reference them.
  const idByKey = new Map<string, string>();
  for (const batch of chunk(conceptValues.map((c) => c.conceptKey), BATCH_SIZE)) {
    const found = await db
      .select({ id: wordConcepts.id, conceptKey: wordConcepts.conceptKey })
      .from(wordConcepts)
      .where(inArray(wordConcepts.conceptKey, batch));
    for (const row of found) {
      idByKey.set(row.conceptKey, row.id);
    }
  }

  const translationValues: Array<{
    conceptId: string;
    lang: Lang;
    text: string;
    level: CefrLevel;
  }> = [];

  for (const row of rows) {
    const conceptId = idByKey.get(row.conceptKey);
    if (!conceptId) continue;

    for (const [lang, translation] of Object.entries(row.translations ?? {})) {
      if (!isLang(lang)) {
        skipped.push(`${row.conceptKey}: unknown language "${lang}"`);
        continue;
      }
      const text = translation?.text?.trim();
      if (!text) {
        skipped.push(`${row.conceptKey}.${lang}: empty text`);
        continue;
      }
      if (!isCefrLevel(translation.level)) {
        skipped.push(`${row.conceptKey}.${lang}: bad level "${translation.level}"`);
        continue;
      }
      translationValues.push({ conceptId, lang, text, level: translation.level });
    }
  }

  let translationsUpserted = 0;
  for (const batch of chunk(translationValues, BATCH_SIZE)) {
    await db
      .insert(conceptTranslations)
      .values(batch)
      .onConflictDoUpdate({
        target: [conceptTranslations.conceptId, conceptTranslations.lang],
        set: {
          text: sqlExcluded("text"),
          level: sqlExcluded("level"),
        },
      });
    translationsUpserted += batch.length;
  }

  return { conceptsUpserted, translationsUpserted, skipped };
}

// Drizzle has no typed helper for referencing the conflicting row in an upsert,
// so reach for Postgres' EXCLUDED pseudo-table directly.
function sqlExcluded(column: string) {
  return sql.raw(`excluded.${column}`);
}
