ALTER TABLE "payouts" ALTER COLUMN "bounty_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "payment_type" varchar(20) DEFAULT 'bounty' NOT NULL;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "memo_message" text;--> statement-breakpoint
CREATE INDEX "idx_payouts_payment_type" ON "payouts" USING btree ("network","payment_type","recipient_user_id");--> statement-breakpoint
CREATE INDEX "idx_payouts_sender" ON "payouts" USING btree ("network","payer_user_id");