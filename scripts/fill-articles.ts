/**
 * Fills the definite article of every noun in one language.
 *
 * The corpus stores nouns bare — "Hund", never "der Hund" — which is right for
 * identity and matching but leaves gender untaught. This asks the model for the
 * article of each word it has not yet been asked about, and writes it into the
 * translation's own `article` field.
 *
 *   npx tsx scripts/fill-articles.ts --lang de
 *   npx tsx scripts/fill-articles.ts --lang de --limit 400 --dry-run
 *   npx tsx scripts/fill-articles.ts --lang es
 *
 * Idempotent by marker rather than by a sidecar state file: a non-noun is
 * written as `""`, so the *presence* of the key means "decided" and `undefined`
 * means "not asked yet". Re-running only picks up what is genuinely new.
 */

import {
  callGemini,
  loadConcepts,
  loadEnv,
  REQUEST_SLEEP_MS,
  saveConcepts,
  sleep,
  type Concept,
  type GeminiSchema,
} from "./_lib/conceptGen";
import {
  isLang,
  LANG_ENGLISH_NAMES,
  type Lang,
} from "../app/_lib/languages";
import { ARTICLES, hasArticles } from "../app/_lib/articles";

loadEnv();

/** Words per request. Small enough that one rate-limit loses little work. */
const BATCH = 60;

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const SCHEMA: GeminiSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      english: { type: "string" },
      article: { type: "string" },
    },
    required: ["english", "article"],
  },
};

async function run() {
  const langArg = arg("lang");
  const limit = Number(arg("limit") ?? Infinity);
  const dryRun = process.argv.includes("--dry-run");

  if (!langArg || !isLang(langArg) || !hasArticles(langArg)) {
    console.error("--lang must be one of: de, es, en");
    process.exit(1);
  }

  const lang = langArg as Lang;
  const langName = LANG_ENGLISH_NAMES[lang];
  const allowed = ARTICLES[lang];

  const concepts = loadConcepts();
  const pending = concepts.filter((concept) => {
    const translation = concept.translations[lang];
    return Boolean(translation) && translation!.article === undefined;
  });

  const targets = Number.isFinite(limit) ? pending.slice(0, limit) : pending;
  const decided = concepts.filter(
    (concept) => concept.translations[lang]?.article !== undefined,
  ).length;

  console.log(
    `${langName}: ${decided} already decided, ${pending.length} pending, doing ${targets.length}.\n`,
  );

  if (targets.length === 0) {
    process.exit(0);
  }

  let nouns = 0;
  let others = 0;

  for (let start = 0; start < targets.length; start += BATCH) {
    const batch = targets.slice(start, start + BATCH);
    // The English gloss and the category are what separate "See" (lake, der)
    // from "See" (sea, die). Without them the model has to guess, and on the
    // handful of words where gender actually carries the meaning it guesses
    // wrong — which are exactly the words worth teaching.
    const lines = batch
      .map(
        (concept) =>
          `${concept.translations.en?.text ?? concept.conceptKey} | ${concept.translations[lang]!.text} | ${concept.category}`,
      )
      .join("\n");

    const prompt = `For each ${langName} word below, give its definite article.

Each line is: english gloss | ${langName} word | category.

Rules:
- "english": echo back the english gloss exactly as given, so rows can be matched up. Do not reorder or omit rows.
- "article": exactly one of ${allowed.join(", ")} — nothing else, no extra words.
- Use the english gloss to disambiguate. The same spelling can take different articles in different senses.
- Return "" (empty string) for anything that is not a noun: verbs, adjectives, adverbs, numbers, names.
- For nouns that exist only in the plural, give the plural article.

${lines}`;

    console.log(
      `Requesting ${batch.length} (${start + batch.length}/${targets.length})...`,
    );
    const rows = await callGemini<
      Array<{ english: string; article: string }>
    >(prompt, SCHEMA);

    // Matched on the echoed gloss rather than on array position: a model that
    // drops or reorders one row would otherwise shift every article after it
    // onto the wrong word, and nothing downstream could tell.
    const byGloss = new Map<string, string>();
    for (const row of rows) {
      const gloss = row.english?.trim().toLowerCase();
      if (gloss) {
        byGloss.set(gloss, row.article ?? "");
      }
    }

    for (const concept of batch) {
      const gloss = (
        concept.translations.en?.text ?? concept.conceptKey
      ).toLowerCase();
      const answer = byGloss.get(gloss)?.trim().toLowerCase() ?? "";
      // Anything outside the closed set is treated as "not a noun". A wrong
      // article taught confidently is worse than no article at all.
      const article = allowed.includes(answer) ? answer : "";
      concept.translations[lang]!.article = article;
      if (article) {
        nouns += 1;
      } else {
        others += 1;
      }
    }

    // Saved per batch, not once at the end: this is ~25 requests per language,
    // and a rate-limit halfway would otherwise throw away everything before it.
    if (!dryRun) {
      saveConcepts(concepts);
    }

    if (start + BATCH < targets.length) {
      await sleep(REQUEST_SLEEP_MS);
    }
  }

  console.log(`\n${nouns} nouns given an article, ${others} marked non-noun.`);
  for (const concept of sample(targets, lang, 10)) {
    console.log(
      `   ${concept.translations[lang]!.article} ${concept.translations[lang]!.text}  (${concept.translations.en?.text})`,
    );
  }

  if (dryRun) {
    console.log("\nDry run — data/concepts.json not written.");
  } else {
    console.log(`\nWritten. Next: npx tsx scripts/seed-concepts.ts`);
  }
  process.exit(0);
}

function sample(concepts: Concept[], lang: Lang, count: number): Concept[] {
  return concepts
    .filter((concept) => concept.translations[lang]?.article)
    .slice(0, count);
}

run().catch((error) => {
  console.error("Fill failed:", error);
  process.exit(1);
});
