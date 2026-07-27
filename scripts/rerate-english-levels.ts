/**
 * Re-rates the English level of concepts that were added for another language.
 *
 * `fill-language-level` generates words at a level in German/Spanish/Czech and
 * carries the English equivalent along. It has no opinion on how hard that word
 * is in English, so it pins the same level — which is right for the language
 * being filled and wrong for English: "recommend" is not C1 English just
 * because "recomendar" is C1 Spanish.
 *
 * This asks the model for the English level alone and rewrites it. Nothing else
 * is touched, so it is safe to rerun.
 *
 *   npx tsx scripts/rerate-english-levels.ts --keys-not-in <backup.json>
 *   npx tsx scripts/rerate-english-levels.ts --keys-not-in <backup.json> --dry-run
 */

import fs from "fs";
import {
  callGemini,
  loadConcepts,
  loadEnv,
  REQUEST_SLEEP_MS,
  saveConcepts,
  sleep,
  slugify,
  coerceLevel,
  type GeminiSchema,
} from "./_lib/conceptGen";
import { CEFR_LEVELS } from "../app/_lib/languages";

loadEnv();

const BATCH = 60;

const SCHEMA: GeminiSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      english: { type: "string" },
      level: { type: "string" },
    },
    required: ["english", "level"],
  },
};

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function run() {
  const dryRun = process.argv.includes("--dry-run");
  const baselinePath = arg("keys-not-in");
  if (!baselinePath || !fs.existsSync(baselinePath)) {
    console.error("--keys-not-in <file> must point at a concepts.json snapshot");
    process.exit(1);
  }

  const baseline = new Set<string>(
    (
      JSON.parse(fs.readFileSync(baselinePath, "utf8")) as Array<{
        conceptKey: string;
      }>
    ).map((concept) => concept.conceptKey),
  );

  const concepts = loadConcepts();
  const targets = concepts.filter(
    (concept) => !baseline.has(concept.conceptKey) && concept.translations.en,
  );

  console.log(`${targets.length} concepts to re-rate (of ${concepts.length}).`);

  const byKey = new Map(targets.map((concept) => [concept.conceptKey, concept]));
  let changed = 0;

  for (let i = 0; i < targets.length; i += BATCH) {
    const batch = targets.slice(i, i + BATCH);
    const words = batch.map((c) => c.translations.en!.text).join("\n");

    const prompt = `For each English word below, give the CEFR level (${CEFR_LEVELS.join(", ")}) at which a learner OF ENGLISH would typically meet it.

Judge English only. Ignore how hard the word may be in any other language.

Return one object per word, echoing it in "english", in the same order.

Words:
${words}`;

    console.log(
      `Re-rating batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(targets.length / BATCH)}...`,
    );

    try {
      const rows = await callGemini<
        Array<{ english: string; level: string }>
      >(prompt, SCHEMA);

      for (const row of rows) {
        const concept = byKey.get(slugify(String(row.english ?? "")));
        if (!concept?.translations.en) continue;
        const next = coerceLevel(row.level, concept.translations.en.level);
        if (next !== concept.translations.en.level) {
          concept.translations.en.level = next;
          changed += 1;
        }
      }
    } catch (error) {
      console.error(`  batch failed, leaving as is: ${error}`);
    }

    await sleep(REQUEST_SLEEP_MS);
  }

  console.log(`\n${changed} English levels changed.`);

  if (dryRun) {
    console.log("Dry run — data/concepts.json not written.");
    process.exit(0);
  }

  saveConcepts(concepts);
  console.log("Written.");
  process.exit(0);
}

run().catch((error) => {
  console.error("Re-rate failed:", error);
  process.exit(1);
});
