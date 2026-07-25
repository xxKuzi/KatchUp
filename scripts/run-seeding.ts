import { seedTopicDecks } from "../app/api/decks/_lib/deckStore";
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

async function run() {
  console.log("Starting DB seeding...");
  const deckResult = await seedTopicDecks();
  console.log("seedTopicDecks completed:", deckResult);
  console.log("Seeding process finished!");
  process.exit(0);
}

run().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
