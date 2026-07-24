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

loadEnv();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY as string;
if (!GEMINI_API_KEY) {
  console.error("Error: GEMINI_API_KEY is not defined in the environment.");
  process.exit(1);
}

interface Word {
  native: string;
  foreign: string;
  category: string;
  level: string;
}

const LANGUAGES = ["german", "spanish", "czech"] as const;
type Language = typeof LANGUAGES[number];
const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
type Level = typeof LEVELS[number];

async function generateWordsForLevel(language: Language, level: Level): Promise<Word[]> {
  console.log(`Generating 200 words for ${language} at level ${level}...`);
  const prompt = `Generate exactly 200 vocabulary words for learning ${language} at CEFR level ${level}.
For each word, provide:
1. "native": The English meaning of the word (use lowercase, e.g., "bread").
2. "foreign": The ${language} translation. Make sure it has correct casing/accents (e.g. for German nouns, capitalize like "Brot", and for Spanish verbs, keep accents like "hablar").
3. "category": A single-word category label (e.g., general, food, travel, home, animals, clothing, family, nature, verbs, adjectives).`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              native: { type: "string" },
              foreign: { type: "string" },
              category: { type: "string" },
            },
            required: ["native", "foreign", "category"],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error("Empty response from Gemini API");
  }

  const parsed = JSON.parse(rawText) as Array<{ native: string; foreign: string; category: string }>;
  
  // Tag them with level
  return parsed.map((item) => ({
    ...item,
    level,
  }));
}

async function run() {
  const outputDir = path.resolve(process.cwd(), "public", "data");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const lang of LANGUAGES) {
    const allWords: Word[] = [];
    for (const lvl of LEVELS) {
      try {
        const words = await generateWordsForLevel(lang, lvl);
        console.log(`Successfully generated ${words.length} words for ${lang} ${lvl}.`);
        allWords.push(...words);
      } catch (err) {
        console.error(`Failed to generate words for ${lang} ${lvl}:`, err);
        process.exit(1);
      }
      // Brief sleep to avoid hitting rate limits
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    const outputPath = path.join(outputDir, `words-${lang}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(allWords, null, 2), "utf8");
    console.log(`Saved ${allWords.length} words for ${lang} to ${outputPath}.`);
  }

  console.log("All generation complete!");
}

run().catch((err) => {
  console.error("Execution failed:", err);
  process.exit(1);
});
