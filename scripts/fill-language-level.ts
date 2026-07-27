/**
 * Fills a CEFR band for one *language*, rather than for English.
 *
 * The main generator grows an English spine and lets the model rate each
 * translation independently — deliberately, because difficulty is not shared:
 * a word can be C1 in English and B2 in Spanish. The side effect is that the
 * non-English C1 bands cannot be targeted at all. Of the 202 English-C1
 * concepts only 43 are also C1 in Spanish, so filling Spanish C1 through the
 * spine would mean generating roughly five English words per Spanish one and
 * badly unbalancing English in the process.
 *
 * This asks the model for words at the level being filled *in that language*,
 * takes the English equivalent along for the ride, and pins the level it was
 * generated for. `generate-concepts --translate-only` then fills the remaining
 * languages without touching what is already there.
 *
 *   npx tsx scripts/fill-language-level.ts --lang es --level C1 --count 120
 *   npx tsx scripts/fill-language-level.ts --lang es --level C1 --count 120 --dry-run
 */

import {
  callGemini,
  loadConcepts,
  loadEnv,
  REQUEST_SLEEP_MS,
  saveConcepts,
  sleep,
  slugify,
  type Concept,
  type GeminiSchema,
} from "./_lib/conceptGen";
import {
  CEFR_LEVELS,
  isLang,
  LANG_ENGLISH_NAMES,
  type CefrLevel,
  type Lang,
} from "../app/_lib/languages";

loadEnv();

/** Words per request. Large batches drift off-level and repeat themselves. */
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
      word: { type: "string" },
      english: { type: "string" },
      category: { type: "string" },
    },
    required: ["word", "english", "category"],
  },
};

async function run() {
  const langArg = arg("lang");
  const levelArg = arg("level")?.toUpperCase();
  const count = Number(arg("count") ?? 100);
  const dryRun = process.argv.includes("--dry-run");

  if (!langArg || !isLang(langArg) || langArg === "en") {
    console.error("--lang must be one of: de, es, cs");
    process.exit(1);
  }
  if (!levelArg || !(CEFR_LEVELS as readonly string[]).includes(levelArg)) {
    console.error(`--level must be one of: ${CEFR_LEVELS.join(", ")}`);
    process.exit(1);
  }

  const lang = langArg as Exclude<Lang, "en">;
  const level = levelArg as CefrLevel;
  const langName = LANG_ENGLISH_NAMES[lang];

  const concepts = loadConcepts();
  const byKey = new Set(concepts.map((concept) => concept.conceptKey));
  // Also matched on the target-language text: a new word whose Spanish is
  // already in the corpus under a different English label would be a second
  // way to learn the same word, which is what the app spent a rewrite undoing.
  const byText = new Set(
    concepts
      .map((concept) => concept.translations[lang]?.text?.trim().toLowerCase())
      .filter((text): text is string => Boolean(text)),
  );

  const have = concepts.filter(
    (concept) => concept.translations[lang]?.level === level,
  ).length;

  console.log(
    `${langName} ${level}: ${have} in the corpus, asking for ${count} more.\n`,
  );

  const added: Concept[] = [];

  // Enough passes to actually reach the target: the model repeats itself as the
  // avoid-list grows, so a fixed three would stop well short on a large ask.
  const maxAttempts = Math.ceil(count / BATCH) + 4;

  for (let attempt = 1; attempt <= maxAttempts && added.length < count; attempt += 1) {
    const need = Math.min(BATCH, count - added.length);
    // A sample rather than the whole band: the list is the bulk of the prompt,
    // and duplicates that slip past it are dropped below anyway.
    const avoid = [...byText].slice(0, 400).join(", ");

    const prompt = `Generate exactly ${need} distinct ${langName} vocabulary words that a learner OF ${langName.toUpperCase()} typically meets at CEFR level ${level}.

Rules:
- Judge the level for ${langName} itself, not for English. A word that is an obvious cognate of its English equivalent is easier and does NOT belong at ${level}.
- Everyday vocabulary a real learner would use — not technical or literary rarities.
- Dictionary form, correct casing and accents (German nouns capitalised, Spanish accents, Czech diacritics). No articles — "Sehnsucht", never "die Sehnsucht".
- "word": the ${langName} word. "english": its most common English equivalent, lowercase, in plain dictionary form with no leading "to" ("to suspect" -> "suspect").
- "category": one lowercase word (general, food, travel, home, work, nature, body, emotions, verbs, adjectives, time).
${avoid ? `\nDo NOT include any of these, which already exist:\n${avoid}` : ""}`;

    console.log(`Requesting ${need} (attempt ${attempt})...`);
    const rows = await callGemini<
      Array<{ word: string; english: string; category: string }>
    >(prompt, SCHEMA);

    let fresh = 0;
    for (const row of rows) {
      // German nouns come back as "die Sehnsucht" however the prompt is worded,
      // but the corpus stores them bare — an article here would show up in the
      // game and have to be typed to score a correct answer.
      const word = row.word?.trim().replace(/^(der|die|das)\s+/i, "");
      // The spine stores verbs bare ("run", not "to run"), so an infinitive
      // marker here would slugify to a second key for a word already present.
      const english = row.english?.trim().toLowerCase().replace(/^to\s+/, "");
      if (!word || !english) continue;

      const conceptKey = slugify(english);
      const textKey = word.toLowerCase();
      if (!conceptKey || byKey.has(conceptKey) || byText.has(textKey)) continue;

      byKey.add(conceptKey);
      byText.add(textKey);
      added.push({
        conceptKey,
        category: (row.category ?? "general").trim().toLowerCase() || "general",
        translations: {
          // The English level is a guess the translate pass never revisits, so
          // it is set to the band asked for; what matters is the pinned target.
          en: { text: english, level },
          [lang]: { text: word, level },
        },
      });
      fresh += 1;
      if (added.length >= count) break;
    }

    console.log(`  ${fresh} new, ${count - added.length} still wanted.`);
    if (added.length < count) await sleep(REQUEST_SLEEP_MS);
  }

  console.log(`\n${added.length} new ${langName} ${level} words.`);
  for (const concept of added.slice(0, 10)) {
    console.log(
      `   ${concept.translations[lang]?.text}  (${concept.translations.en?.text})`,
    );
  }

  if (dryRun) {
    console.log("\nDry run — data/concepts.json not written.");
    process.exit(0);
  }

  saveConcepts([...concepts, ...added]);
  console.log(`\nWritten. Next: npx tsx scripts/generate-concepts.ts --translate-only`);
  process.exit(0);
}

run().catch((error) => {
  console.error("Fill failed:", error);
  process.exit(1);
});
