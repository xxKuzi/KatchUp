DROP INDEX "decks_topic_key_foreign_lang_key";--> statement-breakpoint
CREATE UNIQUE INDEX "decks_topic_key_lang_key" ON "decks" USING btree ("topic_key","native_lang","foreign_lang");