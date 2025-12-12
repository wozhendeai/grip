ALTER TABLE "bounties" ALTER COLUMN "labels" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bounties" ALTER COLUMN "total_funded" SET DATA TYPE numeric(78, 0);--> statement-breakpoint
ALTER TABLE "bounties" ALTER COLUMN "total_funded" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "bounty_funders" ALTER COLUMN "amount" SET DATA TYPE numeric(78, 0);--> statement-breakpoint
ALTER TABLE "custodial_wallets" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "payouts" ALTER COLUMN "amount" SET DATA TYPE numeric(78, 0);--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "chk_tokens_decimals_6" CHECK ("decimals" = 6);--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "chk_payouts_type_shape" CHECK (("payment_type" = 'bounty' AND "bounty_id" IS NOT NULL AND "submission_id" IS NOT NULL) OR ("payment_type" = 'direct' AND "bounty_id" IS NULL AND "submission_id" IS NULL));--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "chk_payouts_custodial_shape" CHECK (("is_custodial" = true AND "custodial_wallet_id" IS NOT NULL) OR ("is_custodial" = false AND "custodial_wallet_id" IS NULL));