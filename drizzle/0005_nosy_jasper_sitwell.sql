CREATE TABLE "concept_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"concept_id" uuid NOT NULL,
	"lang" text NOT NULL,
	"text" text NOT NULL,
	"level" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "word_concepts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"concept_key" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"lecture_index" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "word_concepts_concept_key_unique" UNIQUE("concept_key")
);
--> statement-breakpoint
ALTER TABLE "concept_translations" ADD CONSTRAINT "concept_translations_concept_id_word_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."word_concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "concept_translations_concept_id_lang_key" ON "concept_translations" USING btree ("concept_id","lang");--> statement-breakpoint
CREATE INDEX "concept_translations_lang_level_idx" ON "concept_translations" USING btree ("lang","level");