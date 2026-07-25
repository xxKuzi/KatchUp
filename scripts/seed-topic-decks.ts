/**
 * Creates the canonical topic decks from the vocabulary corpus.
 * Idempotent — existing decks are left untouched.
 *
 * Run after scripts/seed-concepts.ts, since topic words are resolved from
 * word_concepts / concept_translations.
 *
 *   npx tsx scripts/seed-topic-decks.ts
 */

import { loadEnv } from "./_lib/conceptGen";

loadEnv();

async function run() {
  const { seedTopicDecks, refreshTopicDeckWords } = await import(
    "../app/api/decks/_lib/deckStore"
  );

  // Rewrites words in decks that already exist. Destructive — it drops the
  // per-word stats users accumulated on those decks.
  if (process.argv.includes("--refresh")) {
    const refreshed = await refreshTopicDeckWords();
    console.log(
      `Refreshed ${refreshed.refreshedDecks} existing decks (${refreshed.replacedWords} words replaced).`,
    );
  }

  const result = await seedTopicDecks();
  console.log(`Created ${result.createdDecks} decks, ${result.createdWords} words.`);

  if (result.skippedPairs.length) {
    console.warn(`\nSkipped ${result.skippedPairs.length} topic/pair combos:`);
    for (const pair of result.skippedPairs) {
      console.warn(`  - ${pair}`);
    }
  }

  process.exit(0);
}

run().catch((error) => {
  console.error("Seeding failed:", error);
  process.exit(1);
});
