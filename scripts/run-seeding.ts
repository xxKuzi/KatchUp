import { seedTopicDecks } from "../app/api/decks/_lib/deckStore";
import { db } from "../lib/db";
import { globalWords } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

// 1. Dependency-free .env loader
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || "";
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1);
        }
        process.env[key] = value.trim();
      }
    }
  }
}

// Since imports are hoisted, we make sure process.env is set.
// But we will also pass DATABASE_URL from shell command just in case.
loadEnv();

async function seedGlobalWords() {
  let createdCount = 0;
  const languages = ["german", "spanish", "czech"];

  for (const lang of languages) {
    const [existingLang] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(globalWords)
      .where(eq(globalWords.language, lang));

    if (existingLang && existingLang.count > 0) {
      console.log(`Already seeded globalWords for ${lang}, skipping...`);
      continue;
    }
    const filePath = path.resolve(process.cwd(), "public", "data", `words-${lang}.json`);
    if (!fs.existsSync(filePath)) {
      console.warn(`Seed file not found: ${filePath}`);
      continue;
    }

    const raw = fs.readFileSync(filePath, "utf8");
    const words = JSON.parse(raw) as Array<{
      native: string;
      foreign: string;
      category: string;
      level: string;
    }>;

    if (words.length === 0) continue;

    console.log(`Seeding ${words.length} ${lang} words...`);

    // Batch insert into database
    const batchSize = 100;
    for (let i = 0; i < words.length; i += batchSize) {
      const chunk = words.slice(i, i + batchSize);
      await db.insert(globalWords).values(
        chunk.map((w) => ({
          language: lang,
          level: w.level,
          category: w.category || "general",
          native: w.native,
          foreign: w.foreign,
        }))
      );
      createdCount += chunk.length;
    }
  }

  console.log(`Seed globalWords complete! Created ${createdCount} words.`);
  return { globalWordsCreated: createdCount };
}

async function run() {
  console.log("Starting DB seeding...");
  const deckResult = await seedTopicDecks();
  console.log("seedTopicDecks completed:", deckResult);
  const wordResult = await seedGlobalWords();
  console.log("seedGlobalWords completed:", wordResult);
  console.log("Seeding process finished!");
  process.exit(0);
}

run().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
