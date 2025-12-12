-- Make project_id nullable for permissionless bounties
ALTER TABLE "payouts" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint

-- Add completion tracking fields to bounties
ALTER TABLE "bounties" ADD COLUMN "completed_by_github_username" varchar(39);--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "completed_by_user_id" text;--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "pr_merged_at" timestamp;--> statement-breakpoint

-- Add payer_user_id column (nullable first for backfill)
ALTER TABLE "payouts" ADD COLUMN "payer_user_id" text;--> statement-breakpoint

-- Backfill payer_user_id for existing payouts (payer = project owner)
UPDATE "payouts" p
SET payer_user_id = proj.owner_id
FROM "projects" proj
WHERE p.project_id = proj.id
  AND p.payer_user_id IS NULL;--> statement-breakpoint

-- Make payer_user_id NOT NULL after backfill
ALTER TABLE "payouts" ALTER COLUMN "payer_user_id" SET NOT NULL;--> statement-breakpoint

-- Add foreign key constraints
ALTER TABLE "bounties" ADD CONSTRAINT "bounties_completed_by_user_id_user_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_payer_user_id_user_id_fk" FOREIGN KEY ("payer_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;