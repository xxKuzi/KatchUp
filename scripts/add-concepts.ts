/**
 * Adds specific English words to the corpus, fully translated.
 *
 * Used when something outside the generated spine needs to exist — most
 * notably the topic-deck vocabulary, which resolves its words from the corpus
 * rather than keeping a parallel hand-written list.
 *
 *   npx tsx scripts/add-concepts.ts bread water "ice cream"
 *   npx tsx scripts/add-concepts.ts --from-topics
 */

import { LANGS, LANG_ENGLISH_NAMES, type Lang } from "../app/_lib/languages";
import { TOPIC_SEEDS } from "../app/api/decks/_lib/topicSeedData";
import {
  callGemini,
  coerceLevel,
  loadConcepts,
  loadEnv,
  saveConcepts,
  slugify,
  sleep,
  type Concept,
  type GeminiSchema,
  REQUEST_SLEEP_MS,
} from "./_lib/conceptGen";

loadEnv();

const BATCH_SIZE = 40;
const TARGET_LANGS = LANGS.filter((lang): lang is Exclude<Lang, "en"> => lang !== "en");

/** Every English word the topic decks reference. */
function wordsFromTopicSeeds(): string[] {
  return Array.from(new Set(TOPIC_SEEDS.flatMap((seed) => seed.english)));
}

function buildSchema(): GeminiSchema {
  const properties: Record<string, GeminiSchema> = {
    english: { type: "string" },
    category: { type: "string" },
    enLevel: { type: "string" },
  };

  for (const lang of TARGET_LANGS) {
    properties[lang] = {
      type: "object",
      properties: { text: { type: "string" }, level: { type: "string" } },
      required: ["text", "level"],
    };
  }

  return {
    type: "array",
    items: {
      type: "object",
      properties,
      required: ["english", "category", "enLevel", ...TARGET_LANGS],
    },
  };
}

type Row = {
  english: string;
  category: string;
  enLevel: string;
} & Record<string, { text: string; level: string } | string>;

async function translate(words: string[]): Promise<Concept[]> {
  const langList = TARGET_LANGS.map(
    (lang) => `"${lang}" (${LANG_ENGLISH_NAMES[lang]})`,
  ).join(", ");

  const prompt = `For each English word below, provide translations into ${langList}.

For every word give:
- "category": a single lowercase word (e.g. general, food, travel, home, animals, clothing, family, nature, body, work, school, verbs, adjectives, time).
- "enLevel": the CEFR level (A1, A2, B1, B2, C1) an English learner would meet this word at.
- For each language, "text" (correct dictionary form, proper casing and accents — German nouns capitalised e.g. "Brot"; Spanish accents e.g. "habitación"; Czech diacritics e.g. "město") and "level", the CEFR level a learner OF THAT LANGUAGE would meet it at.

Judge level per language, not per concept. Cognates are easier and deserve a lower level than unrelated words for the same idea.

Echo the input word in "english", same order.

Words:
${words.join("\n")}`;

  const rows = await callGemini<Row[]>(prompt, buildSchema());
  const wanted = new Map(words.map((word) => [slugify(word), word]));
  const concepts: Concept[] = [];

  for (const row of rows) {
    const key = slugify(String(row.english ?? ""));
    const original = wanted.get(key);
    if (!original) continue;

    const enLevel = coerceLevel(row.enLevel, "A1");
    const translations: Concept["translations"] = {
      en: { text: original.toLowerCase(), level: enLevel },
    };

    for (const lang of TARGET_LANGS) {
      const value = row[lang];
      if (!value || typeof value === "string") continue;
      const text = value.text?.trim();
      if (!text) continue;
      translations[lang] = { text, level: coerceLevel(value.level, enLevel) };
    }

    concepts.push({
      conceptKey: key,
      category: (row.category ?? "general").trim().toLowerCase() || "general",
      translations,
    });
  }

  return concepts;
}

async function run() {
  const args = process.argv.slice(2);
  const requested = args.includes("--from-topics")
    ? wordsFromTopicSeeds()
    : args;

  if (requested.length === 0) {
    console.error(
      'Usage: npx tsx scripts/add-concepts.ts <word...> | --from-topics',
    );
    process.exit(1);
  }

  const concepts = loadConcepts();
  const existing = new Set(concepts.map((concept) => concept.conceptKey));

  const missing = requested.filter((word) => !existing.has(slugify(word)));
  console.log(
    `${requested.length} requested, ${requested.length - missing.length} already present, ${missing.length} to add.`,
  );
  if (missing.length === 0) {
    return;
  }

  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE);
    console.log(
      `Translating batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(missing.length / BATCH_SIZE)} (${batch.length} words)...`,
    );

    const added = await translate(batch);
    // Re-check inside the loop: a batch may echo a word already added.
    for (const concept of added) {
      if (existing.has(concept.conceptKey)) continue;
      existing.add(concept.conceptKey);
      concepts.push(concept);
    }

    saveConcepts(concepts);
    console.log(`  added ${added.length}, corpus now ${concepts.length}.`);
    await sleep(REQUEST_SLEEP_MS);
  }

  const stillMissing = missing.filter((word) => !existing.has(slugify(word)));
  if (stillMissing.length) {
    console.warn(`\nStill missing (rerun to retry): ${stillMissing.join(", ")}`);
  }
  console.log(`\nDone. Corpus: ${concepts.length} concepts.`);
}

run().catch((error) => {
  console.error("Failed:", error);
  process.exit(1);
});
