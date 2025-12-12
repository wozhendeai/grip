CREATE TABLE "tokens" (
	"address" varchar(42) NOT NULL,
	"network" varchar(10) NOT NULL,
	"symbol" varchar(10) NOT NULL,
	"name" text NOT NULL,
	"decimals" integer DEFAULT 6 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "tokens_address_network_pk" PRIMARY KEY("address","network"),
	CONSTRAINT "tokens_network_symbol_unique" UNIQUE("network","symbol")
);
--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "network" varchar(10) NOT NULL;--> statement-breakpoint
ALTER TABLE "payout_batches" ADD COLUMN "network" varchar(10) NOT NULL;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "network" varchar(10) NOT NULL;--> statement-breakpoint
ALTER TABLE "bounties" ADD CONSTRAINT "bounties_token_address_network_tokens_address_network_fk" FOREIGN KEY ("token_address","network") REFERENCES "public"."tokens"("address","network") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bounties_network_status" ON "bounties" USING btree ("network","status");--> statement-breakpoint
CREATE INDEX "idx_bounties_network_project" ON "bounties" USING btree ("network","project_id");--> statement-breakpoint
CREATE INDEX "idx_bounties_network_repo" ON "bounties" USING btree ("network","github_repo_id");--> statement-breakpoint
CREATE INDEX "idx_payout_batches_network_project" ON "payout_batches" USING btree ("network","project_id");--> statement-breakpoint
CREATE INDEX "idx_payout_batches_network_status" ON "payout_batches" USING btree ("network","status");--> statement-breakpoint
CREATE INDEX "idx_payouts_network_user" ON "payouts" USING btree ("network","user_id");--> statement-breakpoint
CREATE INDEX "idx_payouts_network_status" ON "payouts" USING btree ("network","status");