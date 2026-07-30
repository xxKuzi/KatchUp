CREATE TABLE "duo_quests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_key" text NOT NULL,
	"user_a_id" uuid NOT NULL,
	"user_b_id" uuid NOT NULL,
	"target_word_count" integer NOT NULL,
	"tasks_json" json DEFAULT '[]'::json NOT NULL,
	"claimed_a" boolean DEFAULT false NOT NULL,
	"claimed_b" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "duo_quests" ADD CONSTRAINT "duo_quests_user_a_id_users_id_fk" FOREIGN KEY ("user_a_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duo_quests" ADD CONSTRAINT "duo_quests_user_b_id_users_id_fk" FOREIGN KEY ("user_b_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "duo_quests_week_users_key" ON "duo_quests" USING btree ("week_key","user_a_id","user_b_id");--> statement-breakpoint
CREATE INDEX "duo_quests_user_a_idx" ON "duo_quests" USING btree ("user_a_id");--> statement-breakpoint
CREATE INDEX "duo_quests_user_b_idx" ON "duo_quests" USING btree ("user_b_id");