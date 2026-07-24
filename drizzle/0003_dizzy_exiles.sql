CREATE TABLE "global_words" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"language" text NOT NULL,
	"level" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"native" text NOT NULL,
	"foreign" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_word_progress" ADD COLUMN "streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "global_words_lang_level_idx" ON "global_words" USING btree ("language","level");