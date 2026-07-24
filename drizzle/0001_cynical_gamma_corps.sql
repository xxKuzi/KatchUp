CREATE TABLE "user_word_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"word_id" text NOT NULL,
	"language" text NOT NULL,
	"is_unlocked" boolean DEFAULT true NOT NULL,
	"is_mastered" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_word_progress" ADD CONSTRAINT "user_word_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_word_progress_user_id_word_id_key" ON "user_word_progress" USING btree ("user_id","word_id");--> statement-breakpoint
CREATE INDEX "user_word_progress_user_id_language_idx" ON "user_word_progress" USING btree ("user_id","language");