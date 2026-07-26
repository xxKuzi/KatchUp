/**
 * Re-arms the "You earned a key!" popup for a finished pack.
 *
 * The popup is shown once and then never again: dismissing it writes
 * `keyCelebrated`, which the server keeps and OR-s with whatever the browser
 * reports. That makes it a one-shot thing to test — this clears the flag on the
 * account and prints the snippet that clears the browser's copy, which has to
 * follow or the next sync pushes the old value straight back.
 *
 *   npx tsx scripts/reset-key-popup.ts <email> [topicId]
 *
 * With no topicId every completed pack for that account is re-armed.
 */

import fs from "fs";
import path from "path";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      process.env[match[1]] = (match[2] ?? "")
        .replace(/^["']|["']$/g, "")
        .trim();
    }
  }
}
loadEnv();

async function main() {
  const [email, topicId] = process.argv.slice(2);

  if (!email) {
    console.error("Usage: npx tsx scripts/reset-key-popup.ts <email> [topicId]");
    process.exit(1);
  }

  const { db } = await import("../lib/db/index");
  const { and, eq } = await import("drizzle-orm");
  const { users, userTopicProgress } = await import("../db/schema");

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email));

  if (!user) {
    console.error(`No account for ${email}.`);
    process.exit(1);
  }

  const scope = topicId
    ? and(
        eq(userTopicProgress.userId, user.id),
        eq(userTopicProgress.topicId, topicId),
      )
    : eq(userTopicProgress.userId, user.id);

  const rows = await db
    .update(userTopicProgress)
    .set({ keyCelebrated: false })
    .where(scope)
    .returning({
      topicId: userTopicProgress.topicId,
      language: userTopicProgress.language,
      completedLevels: userTopicProgress.completedLevels,
      isCompleted: userTopicProgress.isCompleted,
    });

  if (rows.length === 0) {
    console.error(
      topicId
        ? `${email} has no progress row for "${topicId}" — play a level of it first.`
        : `${email} has no topic progress yet.`,
    );
    process.exit(1);
  }

  console.log(`Re-armed on the account for ${email}:`);
  for (const row of rows) {
    console.log(
      `  ${row.topicId} (${row.language}) — levels ${JSON.stringify(
        row.completedLevels,
      )}${row.isCompleted ? ", pack complete" : ", pack NOT complete yet — the popup needs all five"}`,
    );
  }

  // The browser's copy is the other half: it is merged with OR, so a tab still
  // holding `true` puts it back within seconds of the next sync.
  const packs = topicId ? `['${topicId}']` : "null";
  console.log(
    `\nNow run this in the browser console (only one KatchUp tab open):\n
const only = ${packs};
Object.keys(localStorage)
  .filter((k) => k.startsWith('katchup-topics-state-v1'))
  .forEach((k) => {
    const s = JSON.parse(localStorage.getItem(k));
    Object.entries(s?.state?.topicProgress ?? {}).forEach(([id, p]) => {
      if (!only || only.includes(id)) p.keyCelebrated = false;
    });
    s.savedAt = Date.now();
    localStorage.setItem(k, JSON.stringify(s));
  });
location.reload();
`,
  );
}

main();
