ALTER TABLE "deck_words" ADD COLUMN "concept_id" uuid;--> statement-breakpoint
ALTER TABLE "deck_words" ADD CONSTRAINT "deck_words_concept_id_word_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."word_concepts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deck_words_concept_id_idx" ON "deck_words" USING btree ("concept_id");