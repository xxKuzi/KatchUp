CREATE TABLE "user_topic_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"language" text NOT NULL,
	"topic_id" text NOT NULL,
	"completed_levels" integer[] DEFAULT '{}' NOT NULL,
	"unlocked" boolean DEFAULT false NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"is_legendary" boolean DEFAULT false NOT NULL,
	"key_celebrated" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_topic_progress" ADD CONSTRAINT "user_topic_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_topic_progress_user_id_language_topic_id_key" ON "user_topic_progress" USING btree ("user_id","language","topic_id");--> statement-breakpoint
CREATE INDEX "user_topic_progress_user_id_language_idx" ON "user_topic_progress" USING btree ("user_id","language");