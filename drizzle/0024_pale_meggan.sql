CREATE TABLE "user_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"profile_code" text NOT NULL,
	"nickname" text NOT NULL,
	"avatar_background_id" text NOT NULL,
	"avatar_icon" text NOT NULL,
	"current_xp" integer DEFAULT 0 NOT NULL,
	"league_name" text DEFAULT 'Bronze' NOT NULL,
	"friends_count" integer DEFAULT 0 NOT NULL,
	"matches_played" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_profile_code_key" ON "user_profiles" USING btree ("profile_code");--> statement-breakpoint
CREATE INDEX "user_profiles_profile_code_idx" ON "user_profiles" USING btree ("profile_code");--> statement-breakpoint
CREATE INDEX "user_profiles_nickname_idx" ON "user_profiles" USING btree ("nickname");