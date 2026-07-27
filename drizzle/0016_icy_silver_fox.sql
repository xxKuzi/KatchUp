CREATE TABLE "user_deck_word_clears" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"deck_word_id" uuid NOT NULL,
	"times_correct" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_deck_word_clears" ADD CONSTRAINT "user_deck_word_clears_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_deck_word_clears" ADD CONSTRAINT "user_deck_word_clears_deck_word_id_deck_words_id_fk" FOREIGN KEY ("deck_word_id") REFERENCES "public"."deck_words"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_deck_word_clears_user_id_deck_word_id_key" ON "user_deck_word_clears" USING btree ("user_id","deck_word_id");--> statement-breakpoint
CREATE INDEX "user_deck_word_clears_user_id_idx" ON "user_deck_word_clears" USING btree ("user_id");