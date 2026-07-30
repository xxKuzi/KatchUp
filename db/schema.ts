import { sql } from "drizzle-orm";
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
  // The creator's language settings. Fair-mode players share them;
  // personalized players keep their own settings on matchPlayers.
  language: text("language").notNull(),
  // Null on matches created before language pairs existed (read as English).
  nativeLang: text("native_lang"),
  level: text("level").notNull(),
  mode: text("mode").default("fair").notNull(),
  // "pending" until both players accept, then "active", then "finished".
  status: text("status").notNull(),
  winnerUserId: uuid("winner_user_id"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  // Set when the second player accepts: the moment both clocks start, so the
  // countdown is anchored to the same instant on both screens.
  startAt: timestamp("start_at", { mode: "date" }),
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
  // The player's friends-profile nickname. Duels show this instead of the
  // account name, which is the real name people signed up with.
  displayName: text("display_name"),
  // Snapshot of the avatar selected in the KatchUp friends profile. Keeping it
  // on the match avoids replacing it with the account photo during live sync.
  displayAvatar: text("display_avatar"),
  // Personalized duels can pair players using entirely different settings.
  // Keep each player's pair and level here rather than relying on the
  // match-level fields, which describe only the player who created the match.
  nativeLang: text("native_lang"),
  language: text("language"),
  level: text("level"),
  progress: integer("progress").notNull().default(0),
  correctCount: integer("correct_count").notNull().default(0),
  acceptedAt: timestamp("accepted_at", { mode: "date" }),
  finishedAt: timestamp("finished_at", { mode: "date" }),
}, (table) => ({
  matchUserIdx: index("match_players_match_user_idx").on(table.matchId, table.userId),
  matchIdx: index("match_players_match_id_idx").on(table.matchId),
  userIdx: index("match_players_user_id_idx").on(table.userId),
}));

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
  // Which word the question is about. Duels are graded on the server, so the
  // only way an answer can count toward the word is if the row remembers it —
  // the question text alone cannot be turned back into a concept. Null for
  // questions built from a deck word the corpus does not cover.
  conceptId: uuid("concept_id").references(() => wordConcepts.id, {
    onDelete: "set null",
  }),
}, (table) => ({
  matchUserIdx: index("match_questions_match_user_idx").on(table.matchId, table.userId),
  matchIdx: index("match_questions_match_id_idx").on(table.matchId),
  userIdx: index("match_questions_user_id_idx").on(table.userId),
}));

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
}, (table) => ({
  matchIdx: index("match_answers_match_id_idx").on(table.matchId),
  userIdx: index("match_answers_user_id_idx").on(table.userId),
}));

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
}, (table) => ({
  userIdx: index("async_scores_user_id_idx").on(table.userId),
}));

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
    // One canonical topic deck per (topicKey, nativeLang, foreignLang). The
    // native side is part of the key so the same topic can exist for speakers
    // of different languages — "Food" for an English speaker learning German
    // is a different deck from "Food" for a Czech speaker learning German.
    // Custom decks keep topicKey null; Postgres treats nulls as distinct, so
    // they don't collide.
    topicKeyLangUnique: uniqueIndex("decks_topic_key_lang_key").on(
      table.topicKey,
      table.nativeLang,
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
    /**
     * Definite article of `foreign` in the deck's foreignLang ("der", "la",
     * "the"). Null for words that take none — verbs, adjectives, all of Czech —
     * and for every row written before articles existed. Stored as the surface
     * word rather than a gender code because Spanish needs number as well as
     * gender ("las gafas"), and every consumer wants the word, not the gender.
     */
    article: text("article"),
    // The corpus entry this word was copied from, when there is one. A deck word
    // used to be text and nothing else, so the same word in two decks was two
    // unrelated learnings; this is what lets progress key on the word itself.
    // Null for free text a user typed or the generator invented — those still
    // get an identity, just a text-derived one.
    conceptId: uuid("concept_id").references(() => wordConcepts.id, {
      onDelete: "set null",
    }),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    deckIdx: index("deck_words_deck_id_idx").on(table.deckId),
    conceptIdx: index("deck_words_concept_id_idx").on(table.conceptId),
    // One row per word per deck. Two decks holding the same word is fine — they
    // resolve to one identity and share its progress — but two rows inside one
    // deck would make the deck read as longer than it is, shift its level
    // windows, and leave both rows competing for a single stat row.
    deckWordUnique: uniqueIndex("deck_words_deck_id_text_key").on(
      table.deckId,
      sql`lower(${table.native})`,
      sql`lower(${table.foreign})`,
    ),
  }),
);

// The share link for one custom deck. Sharing is live rather than a copy: the
// link points at the deck itself, so words the owner adds later show up for
// everyone who joined. One link per deck — rotating it (delete + recreate)
// invalidates the old URL without touching who already joined.
export const deckShares = pgTable(
  "deck_shares",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    // Random, unguessable; the link is the only credential needed to preview.
    code: text("code").notNull(),
    // What the link grants: "viewer" may practise, "editor" may also change
    // the words. Stored on the link so the owner can hand out edit rights
    // without approving each person.
    role: text("role").notNull().default("viewer"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    deckUnique: uniqueIndex("deck_shares_deck_id_key").on(table.deckId),
    codeUnique: uniqueIndex("deck_shares_code_key").on(table.code),
  }),
);

// Who, besides the owner, has access to a custom deck. A row is written when
// someone opens a share link and joins. Role is copied from the link at join
// time, so downgrading a link later does not silently demote people who
// already joined — the owner changes that per member.
export const deckMembers = pgTable(
  "deck_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("viewer"), // "viewer" | "editor"
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    memberUnique: uniqueIndex("deck_members_deck_id_user_id_key").on(
      table.deckId,
      table.userId,
    ),
    userIdx: index("deck_members_user_id_idx").on(table.userId),
  }),
);

// Per-user spaced-repetition stats for one vocabulary item (Leitner box + counts).
//
// These used to be keyed on `deck_word_id`, which made the same word in two
// decks two unrelated learnings: the level counted it twice and mastering it in
// one deck left the other still drilling it. The identity columns below carry
// that anchor instead — see `vocabIdentity.ts`.
export const userWordStats = pgTable(
  "user_word_stats",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Provenance, not identity: which deck row first created this stat, kept for
    // labelling. Null once that deck word is gone, and `set null` rather than
    // `cascade` because deleting one deck must not destroy progress the user
    // earned on the same word elsewhere.
    deckWordId: uuid("deck_word_id").references(() => deckWords.id, {
      onDelete: "set null",
    }),
    // The corpus entry, when the word has one. Null for free text.
    conceptId: uuid("concept_id").references(() => wordConcepts.id, {
      onDelete: "set null",
    }),
    // Canonical language codes ("de", not "german"), so the identity is stable
    // against the legacy spellings still sitting in `decks.foreign_lang`.
    nativeLang: text("native_lang"),
    foreignLang: text("foreign_lang"),
    // Normalised texts. Diacritics are preserved deliberately: Czech být/byt are
    // different words, and folding them would merge two learnings for good.
    nativeKey: text("native_key"),
    foreignKey: text("foreign_key"),
    // "c:<conceptId>" when corpus-backed, else "t:<nativeKey>|<foreignKey>".
    vocabKey: text("vocab_key"),
    // Display copies, so a row learned in free play renders without needing a
    // deck word to join to.
    nativeText: text("native_text"),
    foreignText: text("foreign_text"),
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
    userIdx: index("user_word_stats_user_id_idx").on(table.userId),
    // One row per word per user, whichever decks it happens to live in. The old
    // key was (user, deck word), which is what let the same word be learned
    // twice; this is the invariant that replaces it.
    identityUnique: uniqueIndex("user_word_stats_identity_key").on(
      table.userId,
      table.nativeLang,
      table.foreignLang,
      table.vocabKey,
    ),
    // Provenance is no longer unique, but is still probed for deck labels.
    deckWordIdx: index("user_word_stats_deck_word_id_idx").on(table.deckWordId),
    // Serves the mastered-word count that drives the CEFR level.
    knownIdx: index("user_word_stats_user_id_foreign_lang_known_idx").on(
      table.userId,
      table.foreignLang,
      table.known,
    ),
    // Serves the free-play round builder: which words were seen last session,
    // and which are due to come back round again.
    lastSeenIdx: index("user_word_stats_user_id_foreign_lang_last_seen_idx").on(
      table.userId,
      table.foreignLang,
      table.lastSeenAt,
    ),
  }),
);

// Which deck words a user has actually answered *inside that deck*.
//
// Knowing a word and clearing a pack level are different questions. Mastery is
// per word, shared across every deck and every game — otherwise the same word
// gets drilled in three places. Pack progress has to stay per deck, or playing
// from the games hub would silently clear topic levels and mint keys for packs
// the player never opened. So the ladder reads this, and only deck rounds
// write it.
export const userDeckWordClears = pgTable(
  "user_deck_word_clears",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deckWordId: uuid("deck_word_id")
      .notNull()
      .references(() => deckWords.id, { onDelete: "cascade" }),
    timesCorrect: integer("times_correct").notNull().default(0),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userDeckWordUnique: uniqueIndex(
      "user_deck_word_clears_user_id_deck_word_id_key",
    ).on(table.userId, table.deckWordId),
    userIdx: index("user_deck_word_clears_user_id_idx").on(table.userId),
  }),
);

// Unified vocabulary. One row per *concept* (an idea like "bread"), with its
// wording in each language living in `concept_translations`. This replaces the
// old per-language `global_words` rows, which pinned English to the "native"
// side and so made pairs like German -> English impossible to express.
export const wordConcepts = pgTable("word_concepts", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Slug of the English word — stable identity for re-seeding.
  conceptKey: text("concept_key").notNull().unique(),
  category: text("category").notNull().default("general"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// CEFR level lives here rather than on the concept because difficulty is
// language-dependent: "voyage" is A1 in Spanish (viaje) but B2 in German
// (Seereise). Cognates make the same idea easy in one language and hard in
// another, so each translation carries its own level.
export const conceptTranslations = pgTable(
  "concept_translations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conceptId: uuid("concept_id")
      .notNull()
      .references(() => wordConcepts.id, { onDelete: "cascade" }),
    lang: text("lang").notNull(), // "en" | "de" | "es" | "cs"
    text: text("text").notNull(),
    // Definite article of `text` in `lang`, or null where the language or the
    // part of speech has none. See deckWords.article for why the surface word
    // is stored rather than a gender code.
    article: text("article"),
    level: text("level").notNull(), // "A1" | "A2" | "B1" | "B2" | "C1"
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    conceptLangUnique: uniqueIndex(
      "concept_translations_concept_id_lang_key",
    ).on(table.conceptId, table.lang),
    // Serves the hot query: pick N concepts where the target language sits at
    // a given level, joined to the prompt language on concept_id.
    langLevelIdx: index("concept_translations_lang_level_idx").on(
      table.lang,
      table.level,
    ),
  }),
);


// The topic ladder: one row per (user, UI language, pack). Keys and unlocks used
// to live in localStorage only, so signing in on a second device showed a player
// with no keys, no unlocked packs and no crowns. Every column here only ever
// moves forward, which is what lets two devices merge by union alone.
//
// The key balance is deliberately absent: it is derived from `is_completed` and
// `unlocked` (see `deriveKeys`), because a counter cannot be merged without
// double-spending or losing a key.
export const userTopicProgress = pgTable(
  "user_topic_progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // UI language the ladder is tracked under — progress is per language, the
    // same way the packs themselves are.
    language: text("language").notNull(),
    // Topic key from TOPICS ("autos", "essen", ...).
    topicId: text("topic_id").notNull(),
    // Levels 1..5 answered through at least once.
    completedLevels: integer("completed_levels").array().notNull().default([]),
    unlocked: boolean("unlocked").notNull().default(false),
    isCompleted: boolean("is_completed").notNull().default(false),
    // Earned by scoring 85% on the pack's review round.
    isLegendary: boolean("is_legendary").notNull().default(false),
    keyCelebrated: boolean("key_celebrated").notNull().default(false),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userLanguageTopicUnique: uniqueIndex(
      "user_topic_progress_user_id_language_topic_id_key",
    ).on(table.userId, table.language, table.topicId),
    userLanguageIdx: index("user_topic_progress_user_id_language_idx").on(
      table.userId,
      table.language,
    ),
  }),
);

// A learner's level normally follows their mastered-word count, but passing the
// level test skips them straight to the first word count of the next band. That
// promotion is recorded here as a floor: the effective count is
// max(actual mastered words, wordFloor), so real study still moves them onward.
export const userLevelProgress = pgTable(
  "user_level_progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Canonical language code of the language being learned ("de", "en", ...).
    language: text("language").notNull(),
    wordFloor: integer("word_floor").notNull().default(0),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userLanguageUnique: uniqueIndex(
      "user_level_progress_user_id_language_key",
    ).on(table.userId, table.language),
  }),
);

export const userProfiles = pgTable(
  "user_profiles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .primaryKey(),
    profileCode: text("profile_code").notNull(),
    nickname: text("nickname").notNull(),
    avatarBackgroundId: text("avatar_background_id").notNull(),
    avatarIcon: text("avatar_icon").notNull(),
    currentXp: integer("current_xp").notNull().default(0),
    leagueName: text("league_name").notNull().default("Bronze"),
    friendsCount: integer("friends_count").notNull().default(0),
    matchesPlayed: integer("matches_played").notNull().default(0),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    profileCodeUnique: uniqueIndex("user_profiles_profile_code_key").on(
      table.profileCode,
    ),
    profileCodeIdx: index("user_profiles_profile_code_idx").on(
      table.profileCode,
    ),
    nicknameIdx: index("user_profiles_nickname_idx").on(table.nickname),
  }),
);

export const friendships = pgTable(
  "friendships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    friendUserId: uuid("friend_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userFriendUnique: uniqueIndex("friendships_user_id_friend_user_id_key").on(
      table.userId,
      table.friendUserId,
    ),
    userIdx: index("friendships_user_id_idx").on(table.userId),
    friendUserIdx: index("friendships_friend_user_id_idx").on(table.friendUserId),
  }),
);

export const duoQuests = pgTable(
  "duo_quests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    weekKey: text("week_key").notNull(),
    userAId: uuid("user_a_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userBId: uuid("user_b_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetWordCount: integer("target_word_count").notNull(),
    tasksJson: json("tasks_json").notNull().default([]),
    claimedA: boolean("claimed_a").notNull().default(false),
    claimedB: boolean("claimed_b").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    weekUsersUnique: uniqueIndex("duo_quests_week_users_key").on(
      table.weekKey,
      table.userAId,
      table.userBId,
    ),
    userAIdx: index("duo_quests_user_a_idx").on(table.userAId),
    userBIdx: index("duo_quests_user_b_idx").on(table.userBId),
  }),
);


