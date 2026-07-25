ALTER TABLE "match_players" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "match_players" ADD COLUMN "accepted_at" timestamp;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "start_at" timestamp;