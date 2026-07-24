ALTER TABLE "match_questions" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "mode" text DEFAULT 'fair' NOT NULL;--> statement-breakpoint
ALTER TABLE "match_questions" ADD CONSTRAINT "match_questions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;