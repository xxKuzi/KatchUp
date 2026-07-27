DROP INDEX "user_word_stats_user_id_deck_word_id_key";--> statement-breakpoint
DROP INDEX "user_word_stats_identity_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "user_word_stats_identity_key" ON "user_word_stats" USING btree ("user_id","native_lang","foreign_lang","vocab_key");--> statement-breakpoint
CREATE INDEX "user_word_stats_deck_word_id_idx" ON "user_word_stats" USING btree ("deck_word_id");