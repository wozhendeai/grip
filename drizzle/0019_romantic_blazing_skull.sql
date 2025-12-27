ALTER TABLE "repo_settings" ADD COLUMN "installation_id" bigint;--> statement-breakpoint
CREATE INDEX "idx_repo_settings_installation" ON "repo_settings" USING btree ("installation_id");