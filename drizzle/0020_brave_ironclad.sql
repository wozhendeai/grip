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
ALTER TABLE "repo_settings" ADD COLUMN "auto_pay_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_repo_id" ON "webhook_deliveries" USING btree ("github_repo_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_installation" ON "webhook_deliveries" USING btree ("github_installation_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_received_at" ON "webhook_deliveries" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_status" ON "webhook_deliveries" USING btree ("status");