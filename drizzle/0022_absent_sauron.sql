CREATE TABLE "deck_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deck_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"code" text NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deck_members" ADD CONSTRAINT "deck_members_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_members" ADD CONSTRAINT "deck_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_shares" ADD CONSTRAINT "deck_shares_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deck_members_deck_id_user_id_key" ON "deck_members" USING btree ("deck_id","user_id");--> statement-breakpoint
CREATE INDEX "deck_members_user_id_idx" ON "deck_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deck_shares_deck_id_key" ON "deck_shares" USING btree ("deck_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deck_shares_code_key" ON "deck_shares" USING btree ("code");