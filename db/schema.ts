import {
  boolean,
  index,
  integer,
  json,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.provider, table.providerAccountId],
    }),
  }),
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.identifier, table.token] }),
  }),
);

export const matches = pgTable("matches", {
  id: uuid("id").defaultRandom().primaryKey(),
  language: text("language").notNull(),
  level: text("level").notNull(),
  mode: text("mode").default("fair").notNull(),
  status: text("status").notNull(),
  winnerUserId: uuid("winner_user_id"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { mode: "date" }),
});

export const matchPlayers = pgTable("match_players", {
  id: uuid("id").defaultRandom().primaryKey(),
  matchId: uuid("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  side: text("side").notNull(),
  progress: integer("progress").notNull().default(0),
  correctCount: integer("correct_count").notNull().default(0),
  finishedAt: timestamp("finished_at", { mode: "date" }),
});

export const matchQuestions = pgTable("match_questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  matchId: uuid("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull(),
  prompt: text("prompt").notNull(),
  options: json("options").notNull(),
  correctOption: text("correct_option").notNull(),
});

export const matchAnswers = pgTable("match_answers", {
  id: uuid("id").defaultRandom().primaryKey(),
  matchId: uuid("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  questionId: uuid("question_id")
    .notNull()
    .references(() => matchQuestions.id, { onDelete: "cascade" }),
  selectedOption: text("selected_option").notNull(),
  isCorrect: boolean("is_correct").notNull(),
  responseMs: integer("response_ms").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const asyncScores = pgTable("async_scores", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  language: text("language").notNull(),
  level: text("level").notNull(),
  score: integer("score").notNull(),
  correct: integer("correct").notNull(),
  timeMs: integer("time_ms").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const userWordProgress = pgTable(
  "user_word_progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    wordId: text("word_id").notNull(),
    language: text("language").notNull(),
    isUnlocked: boolean("is_unlocked").default(true).notNull(),
    isMastered: boolean("is_mastered").default(false).notNull(),
    streak: integer("streak").default(0).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userWordUnique: uniqueIndex("user_word_progress_user_id_word_id_key").on(
      table.userId,
      table.wordId,
    ),
    userLanguageIdx: index("user_word_progress_user_id_language_idx").on(
      table.userId,
      table.language,
    ),
  }),
);

// Decks unify topic decks (system-owned, one per topicKey + foreignLang) and
// custom decks (user-owned). Both hold their words in `deck_words`.
export const decks = pgTable(
  "decks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Null for system/topic decks; set for user-created custom decks.
    ownerUserId: uuid("owner_user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    kind: text("kind").notNull(), // "topic" | "custom"
    // Stable key for topic decks (e.g. "autos"); null for custom decks.
    topicKey: text("topic_key"),
    name: text("name").notNull(),
    nativeLang: text("native_lang").notNull(),
    foreignLang: text("foreign_lang").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    // One canonical topic deck per (topicKey, foreignLang). Custom decks keep
    // topicKey null; Postgres treats nulls as distinct, so they don't collide.
    topicKeyLangUnique: uniqueIndex("decks_topic_key_foreign_lang_key").on(
      table.topicKey,
      table.foreignLang,
    ),
    ownerIdx: index("decks_owner_user_id_idx").on(table.ownerUserId),
  }),
);

export const deckWords = pgTable(
  "deck_words",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    native: text("native").notNull(),
    foreign: text("foreign").notNull(),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    deckIdx: index("deck_words_deck_id_idx").on(table.deckId),
  }),
);

// Per-user spaced-repetition stats for a single deck word (Leitner box + counts).
export const userWordStats = pgTable(
  "user_word_stats",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deckWordId: uuid("deck_word_id")
      .notNull()
      .references(() => deckWords.id, { onDelete: "cascade" }),
    box: integer("box").notNull().default(0),
    streak: integer("streak").notNull().default(0),
    timesSeen: integer("times_seen").notNull().default(0),
    timesCorrect: integer("times_correct").notNull().default(0),
    timesWrong: integer("times_wrong").notNull().default(0),
    // True when mastered via streak threshold OR the user tapped "I know this".
    known: boolean("known").notNull().default(false),
    lastSeenAt: timestamp("last_seen_at", { mode: "date" }),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userDeckWordUnique: uniqueIndex(
      "user_word_stats_user_id_deck_word_id_key",
    ).on(table.userId, table.deckWordId),
    userIdx: index("user_word_stats_user_id_idx").on(table.userId),
  }),
);

export const globalWords = pgTable(
  "global_words",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    language: text("language").notNull(), // "german" | "spanish"
    level: text("level").notNull(), // "A1" | "A2" | "B1" | "B2" | "C1"
    category: text("category").notNull().default("general"),
    native: text("native").notNull(),
    foreign: text("foreign").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    langLevelIdx: index("global_words_lang_level_idx").on(
      table.language,
      table.level,
    ),
  }),
);
