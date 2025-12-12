CREATE TABLE "custodial_wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"network" varchar(10) NOT NULL,
	"github_user_id" bigint NOT NULL,
	"github_username" varchar(39) NOT NULL,
	"turnkey_wallet_id" varchar(255) NOT NULL,
	"turnkey_account_id" varchar(255) NOT NULL,
	"address" varchar(42) NOT NULL,
	"claim_token" varchar(64) NOT NULL,
	"claim_expires_at" timestamp NOT NULL,
	"claimed_at" timestamp,
	"user_id" text,
	"transferred_to_passkey_id" text,
	"transfer_tx_hash" varchar(66),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "custodial_wallets_turnkey_wallet_id_unique" UNIQUE("turnkey_wallet_id"),
	CONSTRAINT "custodial_wallets_claim_token_unique" UNIQUE("claim_token")
);
--> statement-breakpoint
ALTER TABLE "payouts" ALTER COLUMN "recipient_passkey_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payouts" ALTER COLUMN "recipient_address" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "custodial_wallet_id" uuid;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "is_custodial" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "custodial_wallets" ADD CONSTRAINT "custodial_wallets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custodial_wallets" ADD CONSTRAINT "custodial_wallets_transferred_to_passkey_id_passkey_id_fk" FOREIGN KEY ("transferred_to_passkey_id") REFERENCES "public"."passkey"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_custodial_wallets_github_user" ON "custodial_wallets" USING btree ("network","github_user_id");--> statement-breakpoint
CREATE INDEX "idx_custodial_wallets_claim_token" ON "custodial_wallets" USING btree ("claim_token");--> statement-breakpoint
CREATE INDEX "idx_custodial_wallets_status" ON "custodial_wallets" USING btree ("network","status");--> statement-breakpoint
CREATE INDEX "idx_custodial_wallets_address" ON "custodial_wallets" USING btree ("address");--> statement-breakpoint
CREATE INDEX "idx_payouts_custodial" ON "payouts" USING btree ("custodial_wallet_id");