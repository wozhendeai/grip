CREATE TYPE "public"."access_key_type" AS ENUM('secp256k1', 'p256', 'webauthn');--> statement-breakpoint
CREATE TABLE "access_key" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"root_wallet_id" text NOT NULL,
	"key_wallet_id" text NOT NULL,
	"chain_id" integer NOT NULL,
	"expiry" integer,
	"limits" text,
	"authorization_signature" text NOT NULL,
	"authorization_hash" text NOT NULL,
	"status" text NOT NULL,
	"label" text,
	"revoked_at" text,
	"created_at" text,
	"updated_at" text,
	"organization_id" text,
	"is_dedicated" boolean DEFAULT false,
	"revoked_reason" text,
	"last_used_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL,
	"source_type" varchar(20) DEFAULT 'manual_invite',
	"github_org_role" varchar(20)
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"created_at" timestamp NOT NULL,
	"metadata" text,
	"github_org_id" bigint,
	"github_org_login" varchar(39),
	"sync_membership" boolean DEFAULT false,
	"last_synced_at" timestamp,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug"),
	CONSTRAINT "organization_github_org_id_unique" UNIQUE("github_org_id")
);
--> statement-breakpoint
CREATE TABLE "passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"created_at" timestamp,
	"aaguid" text
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"github_user_id" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_github_user_id_unique" UNIQUE("github_user_id")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet" (
	"id" text PRIMARY KEY NOT NULL,
	"address" varchar(42) NOT NULL,
	"key_type" varchar(20) NOT NULL,
	"wallet_type" varchar(20) NOT NULL,
	"passkey_id" text,
	"user_id" text,
	"label" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_address_unique" UNIQUE("address"),
	CONSTRAINT "wallet_passkey_id_unique" UNIQUE("passkey_id")
);
--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"chain_id" integer,
	"user_id" text,
	"repo_settings_id" bigint,
	"bounty_id" uuid,
	"submission_id" uuid,
	"payout_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bounties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"repo_settings_id" bigint,
	"github_repo_id" bigint NOT NULL,
	"github_owner" varchar(39) NOT NULL,
	"github_repo" varchar(100) NOT NULL,
	"github_full_name" varchar(140) NOT NULL,
	"github_issue_number" integer NOT NULL,
	"github_issue_id" bigint NOT NULL,
	"github_issue_author_id" bigint,
	"title" varchar(500) NOT NULL,
	"body" text,
	"labels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_funded" numeric(78, 0) DEFAULT 0 NOT NULL,
	"token_address" varchar(42) NOT NULL,
	"primary_funder_id" text,
	"organization_id" text,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"approved_at" timestamp,
	"owner_approved_at" timestamp,
	"paid_at" timestamp,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "idx_bounties_unique_issue" UNIQUE("chain_id","github_issue_id")
);
--> statement-breakpoint
CREATE TABLE "bounty_funders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bounty_id" uuid NOT NULL,
	"funder_id" text,
	"organization_id" text,
	"amount" numeric(78, 0) NOT NULL,
	"token_address" varchar(42) NOT NULL,
	"chain_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"withdrawn_at" timestamp,
	CONSTRAINT "bounty_funders_bounty_id_funder_id_unique" UNIQUE("bounty_id","funder_id")
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"email_bounty_funded" boolean DEFAULT true NOT NULL,
	"email_submission_received" boolean DEFAULT true NOT NULL,
	"email_bounty_completed" boolean DEFAULT true NOT NULL,
	"email_payout_received" boolean DEFAULT true NOT NULL,
	"email_weekly_digest" boolean DEFAULT false NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"quiet_hours_start" text,
	"quiet_hours_end" text,
	"quiet_hours_timezone" text DEFAULT 'UTC',
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"link_url" text NOT NULL,
	"read_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"payment_type" varchar(20) DEFAULT 'bounty' NOT NULL,
	"submission_id" uuid,
	"bounty_id" uuid,
	"repo_settings_id" bigint,
	"payer_user_id" text,
	"payer_organization_id" text,
	"recipient_user_id" text NOT NULL,
	"recipient_passkey_id" text,
	"recipient_address" varchar(42),
	"amount" numeric(78, 0) NOT NULL,
	"token_address" varchar(42) NOT NULL,
	"tx_hash" varchar(66),
	"block_number" bigint,
	"confirmed_at" timestamp,
	"memo_issue_number" integer,
	"memo_pr_number" integer,
	"memo_contributor" varchar(39),
	"memo_bytes32" varchar(66),
	"memo_message" text,
	"work_receipt_hash" varchar(66),
	"work_receipt_locator" varchar(255),
	"custodial_wallet_id" uuid,
	"is_custodial" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "repo_settings" (
	"github_repo_id" bigint PRIMARY KEY NOT NULL,
	"github_owner" varchar(39) NOT NULL,
	"github_repo" varchar(100) NOT NULL,
	"require_owner_approval" boolean DEFAULT false NOT NULL,
	"verified_owner_user_id" text,
	"verified_at" timestamp,
	"webhook_id" bigint,
	"webhook_secret" text,
	"installation_id" bigint,
	"auto_pay_enabled" boolean DEFAULT false NOT NULL,
	"default_expiration_days" integer,
	"contributor_eligibility" text DEFAULT 'anyone' NOT NULL,
	"show_amounts_publicly" boolean DEFAULT true NOT NULL,
	"email_on_submission" boolean DEFAULT true NOT NULL,
	"email_on_merge" boolean DEFAULT true NOT NULL,
	"email_on_payment_failure" boolean DEFAULT true NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bounty_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"github_user_id" bigint,
	"github_pr_id" bigint,
	"github_pr_number" integer,
	"github_pr_url" text,
	"github_pr_title" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"funder_approved_at" timestamp,
	"funder_approved_by" text,
	"owner_approved_at" timestamp,
	"owner_approved_by" text,
	"rejected_at" timestamp,
	"rejected_by" text,
	"rejection_note" text,
	"pr_merged_at" timestamp,
	"pr_closed_at" timestamp,
	"submitted_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "idx_submissions_unique_pr" UNIQUE("github_pr_id")
);
--> statement-breakpoint
CREATE TABLE "tokens" (
	"address" varchar(42) NOT NULL,
	"chain_id" integer NOT NULL,
	"symbol" varchar(10) NOT NULL,
	"name" text NOT NULL,
	"decimals" integer DEFAULT 6 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "tokens_address_chain_id_pk" PRIMARY KEY("address","chain_id"),
	CONSTRAINT "tokens_chain_id_symbol_unique" UNIQUE("chain_id","symbol")
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_delivery_id" varchar(64) NOT NULL,
	"github_repo_id" bigint,
	"github_installation_id" bigint,
	"event_type" varchar(64) NOT NULL,
	"action" varchar(64),
	"status" varchar(20) NOT NULL,
	"error_message" text,
	"payload_summary" jsonb,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_deliveries_github_delivery_id_unique" UNIQUE("github_delivery_id")
);
--> statement-breakpoint
ALTER TABLE "access_key" ADD CONSTRAINT "access_key_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_key" ADD CONSTRAINT "access_key_root_wallet_id_wallet_id_fk" FOREIGN KEY ("root_wallet_id") REFERENCES "public"."wallet"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_key" ADD CONSTRAINT "access_key_key_wallet_id_wallet_id_fk" FOREIGN KEY ("key_wallet_id") REFERENCES "public"."wallet"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_key" ADD CONSTRAINT "access_key_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet" ADD CONSTRAINT "wallet_passkey_id_passkey_id_fk" FOREIGN KEY ("passkey_id") REFERENCES "public"."passkey"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet" ADD CONSTRAINT "wallet_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_repo_settings_id_repo_settings_github_repo_id_fk" FOREIGN KEY ("repo_settings_id") REFERENCES "public"."repo_settings"("github_repo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_payout_id_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounties" ADD CONSTRAINT "bounties_repo_settings_id_repo_settings_github_repo_id_fk" FOREIGN KEY ("repo_settings_id") REFERENCES "public"."repo_settings"("github_repo_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounties" ADD CONSTRAINT "bounties_primary_funder_id_user_id_fk" FOREIGN KEY ("primary_funder_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounties" ADD CONSTRAINT "bounties_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounties" ADD CONSTRAINT "bounties_token_address_chain_id_tokens_address_chain_id_fk" FOREIGN KEY ("token_address","chain_id") REFERENCES "public"."tokens"("address","chain_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounty_funders" ADD CONSTRAINT "bounty_funders_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounty_funders" ADD CONSTRAINT "bounty_funders_funder_id_user_id_fk" FOREIGN KEY ("funder_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounty_funders" ADD CONSTRAINT "bounty_funders_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounty_funders" ADD CONSTRAINT "bounty_funders_token_address_chain_id_tokens_address_chain_id_fk" FOREIGN KEY ("token_address","chain_id") REFERENCES "public"."tokens"("address","chain_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_repo_settings_id_repo_settings_github_repo_id_fk" FOREIGN KEY ("repo_settings_id") REFERENCES "public"."repo_settings"("github_repo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_payer_user_id_user_id_fk" FOREIGN KEY ("payer_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_payer_organization_id_organization_id_fk" FOREIGN KEY ("payer_organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_recipient_passkey_id_passkey_id_fk" FOREIGN KEY ("recipient_passkey_id") REFERENCES "public"."passkey"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_token_address_chain_id_tokens_address_chain_id_fk" FOREIGN KEY ("token_address","chain_id") REFERENCES "public"."tokens"("address","chain_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_settings" ADD CONSTRAINT "repo_settings_verified_owner_user_id_user_id_fk" FOREIGN KEY ("verified_owner_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_funder_approved_by_user_id_fk" FOREIGN KEY ("funder_approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_owner_approved_by_user_id_fk" FOREIGN KEY ("owner_approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_rejected_by_user_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_key_userId_idx" ON "access_key" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "access_key_rootWalletId_idx" ON "access_key" USING btree ("root_wallet_id");--> statement-breakpoint
CREATE INDEX "access_key_keyWalletId_idx" ON "access_key" USING btree ("key_wallet_id");--> statement-breakpoint
CREATE INDEX "access_key_status_idx" ON "access_key" USING btree ("status");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_userId_idx" ON "passkey" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_credentialID_idx" ON "passkey" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "wallet_userId_idx" ON "wallet" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wallet_passkeyId_idx" ON "wallet" USING btree ("passkey_id");--> statement-breakpoint
CREATE INDEX "wallet_address_idx" ON "wallet" USING btree ("address");--> statement-breakpoint
CREATE INDEX "idx_activity_log_event_type" ON "activity_log" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_activity_log_chain" ON "activity_log" USING btree ("chain_id");--> statement-breakpoint
CREATE INDEX "idx_activity_log_user" ON "activity_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_activity_log_created_at" ON "activity_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_bounties_chain_status" ON "bounties" USING btree ("chain_id","status");--> statement-breakpoint
CREATE INDEX "idx_bounties_chain_repo" ON "bounties" USING btree ("chain_id","github_repo_id");--> statement-breakpoint
CREATE INDEX "idx_bounties_primary_funder" ON "bounties" USING btree ("primary_funder_id");--> statement-breakpoint
CREATE INDEX "idx_bounties_repo_settings" ON "bounties" USING btree ("repo_settings_id");--> statement-breakpoint
CREATE INDEX "idx_bounties_org" ON "bounties" USING btree ("organization_id","chain_id");--> statement-breakpoint
CREATE INDEX "idx_bounty_funders_bounty" ON "bounty_funders" USING btree ("bounty_id");--> statement-breakpoint
CREATE INDEX "idx_bounty_funders_funder" ON "bounty_funders" USING btree ("funder_id");--> statement-breakpoint
CREATE INDEX "idx_bounty_funders_org" ON "bounty_funders" USING btree ("organization_id","chain_id");--> statement-breakpoint
CREATE INDEX "idx_bounty_funders_chain" ON "bounty_funders" USING btree ("chain_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_user" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_unread" ON "notifications" USING btree ("user_id","created_at") WHERE "notifications"."read_at" is null;--> statement-breakpoint
CREATE INDEX "idx_payouts_chain_user" ON "payouts" USING btree ("chain_id","recipient_user_id");--> statement-breakpoint
CREATE INDEX "idx_payouts_chain_status" ON "payouts" USING btree ("chain_id","status");--> statement-breakpoint
CREATE INDEX "idx_payouts_submission" ON "payouts" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "idx_payouts_tx_hash" ON "payouts" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "idx_payouts_custodial" ON "payouts" USING btree ("custodial_wallet_id");--> statement-breakpoint
CREATE INDEX "idx_payouts_payment_type" ON "payouts" USING btree ("chain_id","payment_type","recipient_user_id");--> statement-breakpoint
CREATE INDEX "idx_payouts_sender" ON "payouts" USING btree ("chain_id","payer_user_id");--> statement-breakpoint
CREATE INDEX "idx_payouts_payer_org" ON "payouts" USING btree ("payer_organization_id","chain_id");--> statement-breakpoint
CREATE INDEX "idx_repo_settings_owner" ON "repo_settings" USING btree ("verified_owner_user_id");--> statement-breakpoint
CREATE INDEX "idx_repo_settings_name" ON "repo_settings" USING btree ("github_owner","github_repo");--> statement-breakpoint
CREATE INDEX "idx_repo_settings_installation" ON "repo_settings" USING btree ("installation_id");--> statement-breakpoint
CREATE INDEX "idx_submissions_bounty" ON "submissions" USING btree ("bounty_id");--> statement-breakpoint
CREATE INDEX "idx_submissions_user" ON "submissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_submissions_status" ON "submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_tokens_chain_active" ON "tokens" USING btree ("chain_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_repo_id" ON "webhook_deliveries" USING btree ("github_repo_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_installation" ON "webhook_deliveries" USING btree ("github_installation_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_received_at" ON "webhook_deliveries" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_status" ON "webhook_deliveries" USING btree ("status");