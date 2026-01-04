ALTER TABLE "repo_settings" ADD COLUMN "default_expiration_days" integer;--> statement-breakpoint
ALTER TABLE "repo_settings" ADD COLUMN "contributor_eligibility" text DEFAULT 'anyone' NOT NULL;--> statement-breakpoint
ALTER TABLE "repo_settings" ADD COLUMN "show_amounts_publicly" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "repo_settings" ADD COLUMN "email_on_submission" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "repo_settings" ADD COLUMN "email_on_merge" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "repo_settings" ADD COLUMN "email_on_payment_failure" boolean DEFAULT true NOT NULL;