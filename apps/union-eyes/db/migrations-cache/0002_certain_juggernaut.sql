ALTER TABLE "icra_assessments" ADD COLUMN "stripe_payment_ref" varchar(255);--> statement-breakpoint
ALTER TABLE "icra_assessments" ADD COLUMN "claim_email" varchar(320);--> statement-breakpoint
ALTER TABLE "icra_assessments" ADD COLUMN "claim_token" varchar(128);--> statement-breakpoint
ALTER TABLE "icra_assessments" ADD COLUMN "claim_token_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "icra_assessments" ADD COLUMN "claimed_by_user_id" varchar(128);--> statement-breakpoint
ALTER TABLE "icra_assessments" ADD COLUMN "claimed_org_id" uuid;--> statement-breakpoint
ALTER TABLE "icra_assessments" ADD COLUMN "claimed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "icra_assessments_claim_token_idx" ON "icra_assessments" USING btree ("claim_token");