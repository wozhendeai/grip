CREATE TABLE "bounty_funders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bounty_id" uuid NOT NULL,
	"funder_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"token_address" varchar(42) NOT NULL,
	"network" varchar(10) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"withdrawn_at" timestamp,
	CONSTRAINT "bounty_funders_bounty_id_funder_id_unique" UNIQUE("bounty_id","funder_id")
);
--> statement-breakpoint
ALTER TABLE "payout_batches" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project_members" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_stats" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "payout_batches" CASCADE;--> statement-breakpoint
DROP TABLE "project_members" CASCADE;--> statement-breakpoint
DROP TABLE "user_stats" CASCADE;--> statement-breakpoint
ALTER TABLE "projects" RENAME TO "repo_settings";--> statement-breakpoint
ALTER TABLE "claims" RENAME TO "submissions";--> statement-breakpoint
ALTER TABLE "activity_log" RENAME COLUMN "project_id" TO "repo_settings_id_old";--> statement-breakpoint
ALTER TABLE "activity_log" ADD COLUMN "repo_settings_id" bigint;--> statement-breakpoint
UPDATE "activity_log" al SET repo_settings_id = p.github_repo_id FROM repo_settings p WHERE al.repo_settings_id_old = p.id;--> statement-breakpoint
ALTER TABLE "activity_log" DROP COLUMN "repo_settings_id_old";--> statement-breakpoint
ALTER TABLE "activity_log" RENAME COLUMN "claim_id" TO "submission_id";--> statement-breakpoint
ALTER TABLE "bounties" RENAME COLUMN "project_id" TO "repo_settings_id_old";--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "repo_settings_id" bigint;--> statement-breakpoint
UPDATE "bounties" b SET repo_settings_id = p.github_repo_id FROM repo_settings p WHERE b.repo_settings_id_old = p.id;--> statement-breakpoint
ALTER TABLE "bounties" DROP COLUMN "repo_settings_id_old";--> statement-breakpoint
ALTER TABLE "bounties" RENAME COLUMN "github_repo_owner" TO "github_owner";--> statement-breakpoint
ALTER TABLE "bounties" RENAME COLUMN "github_repo_name" TO "github_repo";--> statement-breakpoint
ALTER TABLE "bounties" RENAME COLUMN "amount" TO "total_funded";--> statement-breakpoint
ALTER TABLE "bounties" RENAME COLUMN "funded_by" TO "primary_funder_id";--> statement-breakpoint
ALTER TABLE "submissions" RENAME COLUMN "pr_number" TO "github_pr_number";--> statement-breakpoint
ALTER TABLE "submissions" RENAME COLUMN "pr_url" TO "github_pr_url";--> statement-breakpoint
ALTER TABLE "submissions" RENAME COLUMN "pr_title" TO "github_pr_title";--> statement-breakpoint
ALTER TABLE "submissions" RENAME COLUMN "resolution_note" TO "rejection_note";--> statement-breakpoint
ALTER TABLE "payouts" RENAME COLUMN "claim_id" TO "submission_id";--> statement-breakpoint
ALTER TABLE "payouts" RENAME COLUMN "project_id" TO "repo_settings_id_old";--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "repo_settings_id" bigint;--> statement-breakpoint
UPDATE "payouts" p SET repo_settings_id = ps.github_repo_id FROM repo_settings ps WHERE p.repo_settings_id_old = ps.id;--> statement-breakpoint
ALTER TABLE "payouts" DROP COLUMN "repo_settings_id_old";--> statement-breakpoint
ALTER TABLE "payouts" RENAME COLUMN "user_id" TO "recipient_user_id";--> statement-breakpoint
ALTER TABLE "repo_settings" RENAME COLUMN "owner_id" TO "verified_owner_user_id";--> statement-breakpoint
ALTER TABLE "repo_settings" DROP CONSTRAINT "projects_github_repo_id_unique";--> statement-breakpoint
ALTER TABLE "bounties" DROP CONSTRAINT "bounties_funded_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "bounties" DROP CONSTRAINT "bounties_claimed_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "bounties" DROP CONSTRAINT "bounties_completed_by_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "bounties" DROP CONSTRAINT "bounties_approved_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "repo_settings" DROP CONSTRAINT "projects_owner_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "repo_settings" DROP CONSTRAINT "projects_treasury_passkey_id_passkey_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "idx_bounties_network_project";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_payouts_network_user";--> statement-breakpoint
ALTER TABLE "bounties" ALTER COLUMN "github_repo_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bounties" ALTER COLUMN "github_full_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bounties" ALTER COLUMN "status" SET DEFAULT 'open';--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "submitted_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "repo_settings" DROP CONSTRAINT "projects_pkey";--> statement-breakpoint
ALTER TABLE "repo_settings" ADD PRIMARY KEY ("github_repo_id");--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "github_user_id" bigint;--> statement-breakpoint
UPDATE "user" u SET github_user_id = CAST(a.account_id AS bigint) FROM account a WHERE a.user_id = u.id AND a.provider_id = 'github';--> statement-breakpoint
ALTER TABLE "activity_log" ADD COLUMN "network" varchar(10);--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "github_issue_author_id" bigint;--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "owner_approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "github_user_id" bigint;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "github_pr_id" bigint;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "funder_approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "funder_approved_by" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "owner_approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "owner_approved_by" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "rejected_at" timestamp;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "rejected_by" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "pr_merged_at" timestamp;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "pr_closed_at" timestamp;--> statement-breakpoint
ALTER TABLE "repo_settings" ADD COLUMN "require_owner_approval" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "repo_settings" ADD COLUMN "verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "bounty_funders" ADD CONSTRAINT "bounty_funders_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounty_funders" ADD CONSTRAINT "bounty_funders_funder_id_user_id_fk" FOREIGN KEY ("funder_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounty_funders" ADD CONSTRAINT "bounty_funders_token_address_network_tokens_address_network_fk" FOREIGN KEY ("token_address","network") REFERENCES "public"."tokens"("address","network") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bounty_funders_bounty" ON "bounty_funders" USING btree ("bounty_id");--> statement-breakpoint
CREATE INDEX "idx_bounty_funders_funder" ON "bounty_funders" USING btree ("funder_id");--> statement-breakpoint
CREATE INDEX "idx_bounty_funders_network" ON "bounty_funders" USING btree ("network");--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_repo_settings_id_repo_settings_github_repo_id_fk" FOREIGN KEY ("repo_settings_id") REFERENCES "public"."repo_settings"("github_repo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounties" ADD CONSTRAINT "bounties_repo_settings_id_repo_settings_github_repo_id_fk" FOREIGN KEY ("repo_settings_id") REFERENCES "public"."repo_settings"("github_repo_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounties" ADD CONSTRAINT "bounties_primary_funder_id_user_id_fk" FOREIGN KEY ("primary_funder_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_funder_approved_by_user_id_fk" FOREIGN KEY ("funder_approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_owner_approved_by_user_id_fk" FOREIGN KEY ("owner_approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_rejected_by_user_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_repo_settings_id_repo_settings_github_repo_id_fk" FOREIGN KEY ("repo_settings_id") REFERENCES "public"."repo_settings"("github_repo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_token_address_network_tokens_address_network_fk" FOREIGN KEY ("token_address","network") REFERENCES "public"."tokens"("address","network") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_settings" ADD CONSTRAINT "repo_settings_verified_owner_user_id_user_id_fk" FOREIGN KEY ("verified_owner_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_activity_log_event_type" ON "activity_log" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_activity_log_network" ON "activity_log" USING btree ("network");--> statement-breakpoint
CREATE INDEX "idx_activity_log_user" ON "activity_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_activity_log_created_at" ON "activity_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_bounties_primary_funder" ON "bounties" USING btree ("primary_funder_id");--> statement-breakpoint
CREATE INDEX "idx_bounties_repo_settings" ON "bounties" USING btree ("repo_settings_id");--> statement-breakpoint
CREATE INDEX "idx_submissions_bounty" ON "submissions" USING btree ("bounty_id");--> statement-breakpoint
CREATE INDEX "idx_submissions_user" ON "submissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_submissions_status" ON "submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_notifications_user" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_unread" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_payouts_submission" ON "payouts" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "idx_payouts_tx_hash" ON "payouts" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "idx_repo_settings_owner" ON "repo_settings" USING btree ("verified_owner_user_id");--> statement-breakpoint
CREATE INDEX "idx_repo_settings_name" ON "repo_settings" USING btree ("github_owner","github_repo");--> statement-breakpoint
CREATE INDEX "idx_tokens_network_active" ON "tokens" USING btree ("network","is_active");--> statement-breakpoint
CREATE INDEX "idx_payouts_network_user" ON "payouts" USING btree ("network","recipient_user_id");--> statement-breakpoint
ALTER TABLE "bounties" DROP COLUMN "payout_mode";--> statement-breakpoint
ALTER TABLE "bounties" DROP COLUMN "claim_deadline_days";--> statement-breakpoint
ALTER TABLE "bounties" DROP COLUMN "max_claims";--> statement-breakpoint
ALTER TABLE "bounties" DROP COLUMN "claimed_by";--> statement-breakpoint
ALTER TABLE "bounties" DROP COLUMN "claimed_at";--> statement-breakpoint
ALTER TABLE "bounties" DROP COLUMN "claim_expires_at";--> statement-breakpoint
ALTER TABLE "bounties" DROP COLUMN "pr_number";--> statement-breakpoint
ALTER TABLE "bounties" DROP COLUMN "pr_url";--> statement-breakpoint
ALTER TABLE "bounties" DROP COLUMN "submitted_at";--> statement-breakpoint
ALTER TABLE "bounties" DROP COLUMN "completed_by_github_username";--> statement-breakpoint
ALTER TABLE "bounties" DROP COLUMN "completed_by_user_id";--> statement-breakpoint
ALTER TABLE "bounties" DROP COLUMN "pr_merged_at";--> statement-breakpoint
ALTER TABLE "bounties" DROP COLUMN "approved_by";--> statement-breakpoint
ALTER TABLE "submissions" DROP COLUMN "claimed_at";--> statement-breakpoint
ALTER TABLE "submissions" DROP COLUMN "expires_at";--> statement-breakpoint
ALTER TABLE "submissions" DROP COLUMN "resolved_at";--> statement-breakpoint
ALTER TABLE "submissions" DROP COLUMN "resolution";--> statement-breakpoint
ALTER TABLE "submissions" DROP COLUMN "resolved_by";--> statement-breakpoint
ALTER TABLE "payouts" DROP COLUMN "approval_type";--> statement-breakpoint
ALTER TABLE "repo_settings" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "repo_settings" DROP COLUMN "github_full_name";--> statement-breakpoint
ALTER TABLE "repo_settings" DROP COLUMN "github_default_branch";--> statement-breakpoint
ALTER TABLE "repo_settings" DROP COLUMN "treasury_passkey_id";--> statement-breakpoint
ALTER TABLE "repo_settings" DROP COLUMN "payout_mode";--> statement-breakpoint
ALTER TABLE "repo_settings" DROP COLUMN "default_claim_days";--> statement-breakpoint
ALTER TABLE "repo_settings" DROP COLUMN "total_funded";--> statement-breakpoint
ALTER TABLE "repo_settings" DROP COLUMN "total_paid";--> statement-breakpoint
ALTER TABLE "repo_settings" DROP COLUMN "bounties_created";--> statement-breakpoint
ALTER TABLE "repo_settings" DROP COLUMN "bounties_completed";--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_github_user_id_unique" UNIQUE("github_user_id");--> statement-breakpoint
ALTER TABLE "bounties" ADD CONSTRAINT "idx_bounties_unique_issue" UNIQUE("network","github_issue_id");--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "idx_submissions_unique_pr" UNIQUE("github_pr_id");