CREATE INDEX "async_scores_user_id_idx" ON "async_scores" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "match_answers_match_id_idx" ON "match_answers" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "match_answers_user_id_idx" ON "match_answers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "match_players_match_user_idx" ON "match_players" USING btree ("match_id","user_id");--> statement-breakpoint
CREATE INDEX "match_players_match_id_idx" ON "match_players" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "match_players_user_id_idx" ON "match_players" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "match_questions_match_user_idx" ON "match_questions" USING btree ("match_id","user_id");--> statement-breakpoint
CREATE INDEX "match_questions_match_id_idx" ON "match_questions" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "match_questions_user_id_idx" ON "match_questions" USING btree ("user_id");