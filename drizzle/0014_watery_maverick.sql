ALTER TABLE "user_word_stats" DROP CONSTRAINT "user_word_stats_deck_word_id_deck_words_id_fk";
--> statement-breakpoint
ALTER TABLE "user_word_stats" ALTER COLUMN "deck_word_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_word_stats" ADD COLUMN "concept_id" uuid;--> statement-breakpoint
ALTER TABLE "user_word_stats" ADD COLUMN "native_lang" text;--> statement-breakpoint
ALTER TABLE "user_word_stats" ADD COLUMN "foreign_lang" text;--> statement-breakpoint
ALTER TABLE "user_word_stats" ADD COLUMN "native_key" text;--> statement-breakpoint
ALTER TABLE "user_word_stats" ADD COLUMN "foreign_key" text;--> statement-breakpoint
ALTER TABLE "user_word_stats" ADD COLUMN "vocab_key" text;--> statement-breakpoint
ALTER TABLE "user_word_stats" ADD COLUMN "native_text" text;--> statement-breakpoint
ALTER TABLE "user_word_stats" ADD COLUMN "foreign_text" text;--> statement-breakpoint
ALTER TABLE "user_word_stats" ADD CONSTRAINT "user_word_stats_concept_id_word_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."word_concepts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_word_stats" ADD CONSTRAINT "user_word_stats_deck_word_id_deck_words_id_fk" FOREIGN KEY ("deck_word_id") REFERENCES "public"."deck_words"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_word_stats_identity_idx" ON "user_word_stats" USING btree ("user_id","native_lang","foreign_lang","vocab_key");--> statement-breakpoint
CREATE INDEX "user_word_stats_user_id_foreign_lang_known_idx" ON "user_word_stats" USING btree ("user_id","foreign_lang","known");