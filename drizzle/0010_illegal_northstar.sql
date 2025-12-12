CREATE TYPE "public"."access_key_type" AS ENUM('secp256k1', 'p256', 'webauthn');--> statement-breakpoint
CREATE TABLE "access_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"network" varchar(10) NOT NULL,
	"user_id" text NOT NULL,
	"backend_wallet_address" varchar(42) NOT NULL,
	"key_type" "access_key_type" DEFAULT 'secp256k1' NOT NULL,
	"chain_id" integer NOT NULL,
	"expiry" bigint,
	"limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"authorization_signature" text NOT NULL,
	"authorization_hash" varchar(66) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"revoked_at" timestamp,
	"revoked_reason" text,
	"label" varchar(100),
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "idx_access_keys_unique_active" UNIQUE("user_id","backend_wallet_address","network")
);
--> statement-breakpoint
DROP INDEX "idx_notifications_unread";--> statement-breakpoint
ALTER TABLE "access_keys" ADD CONSTRAINT "access_keys_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_access_keys_user" ON "access_keys" USING btree ("user_id","network");--> statement-breakpoint
CREATE INDEX "idx_access_keys_status" ON "access_keys" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_access_keys_backend_wallet" ON "access_keys" USING btree ("backend_wallet_address");--> statement-breakpoint
CREATE INDEX "idx_notifications_unread" ON "notifications" USING btree ("user_id","created_at") WHERE "notifications"."read_at" is null;