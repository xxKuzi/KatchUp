CREATE TABLE "deck_words" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"native" text NOT NULL,
	"foreign" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid,
	"kind" text NOT NULL,
	"topic_key" text,
	"name" text NOT NULL,
	"native_lang" text NOT NULL,
	"foreign_lang" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_word_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"deck_word_id" uuid NOT NULL,
	"box" integer DEFAULT 0 NOT NULL,
	"streak" integer DEFAULT 0 NOT NULL,
	"times_seen" integer DEFAULT 0 NOT NULL,
	"times_correct" integer DEFAULT 0 NOT NULL,
	"times_wrong" integer DEFAULT 0 NOT NULL,
	"known" boolean DEFAULT false NOT NULL,
	"last_seen_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deck_words" ADD CONSTRAINT "deck_words_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_word_stats" ADD CONSTRAINT "user_word_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_word_stats" ADD CONSTRAINT "user_word_stats_deck_word_id_deck_words_id_fk" FOREIGN KEY ("deck_word_id") REFERENCES "public"."deck_words"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deck_words_deck_id_idx" ON "deck_words" USING btree ("deck_id");--> statement-breakpoint
CREATE UNIQUE INDEX "decks_topic_key_foreign_lang_key" ON "decks" USING btree ("topic_key","foreign_lang");--> statement-breakpoint
CREATE INDEX "decks_owner_user_id_idx" ON "decks" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_word_stats_user_id_deck_word_id_key" ON "user_word_stats" USING btree ("user_id","deck_word_id");--> statement-breakpoint
CREATE INDEX "user_word_stats_user_id_idx" ON "user_word_stats" USING btree ("user_id");