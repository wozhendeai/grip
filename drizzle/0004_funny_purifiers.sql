ALTER TABLE "bounties" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "github_id" bigint;--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "github_repo_id" bigint;--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "github_repo_owner" varchar(39);--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "github_repo_name" varchar(100);--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "github_full_name" varchar(140);--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "funded_by" text;--> statement-breakpoint
ALTER TABLE "bounties" ADD CONSTRAINT "bounties_funded_by_user_id_fk" FOREIGN KEY ("funded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_github_id_unique" UNIQUE("github_id");