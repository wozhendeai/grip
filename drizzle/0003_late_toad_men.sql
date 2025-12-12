CREATE TABLE "payout_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"payout_ids" uuid[] NOT NULL,
	"payout_count" integer NOT NULL,
	"total_amount" bigint NOT NULL,
	"token_address" varchar(42) NOT NULL,
	"tx_hash" varchar(66),
	"block_number" bigint,
	"status" varchar(20) DEFAULT 'pending',
	"signed_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"confirmed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "payout_mode" varchar(20) DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "approval_type" varchar(20) DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE "payout_batches" ADD CONSTRAINT "payout_batches_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_batches" ADD CONSTRAINT "payout_batches_signed_by_user_id_fk" FOREIGN KEY ("signed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;