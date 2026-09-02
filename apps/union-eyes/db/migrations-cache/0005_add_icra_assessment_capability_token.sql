ALTER TABLE "icra_assessments" ADD COLUMN "capability_token_hash" varchar(128);--> statement-breakpoint
ALTER TABLE "icra_assessments" ADD COLUMN "capability_token_expires_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "icra_assessments_capability_token_hash_idx" ON "icra_assessments" USING btree ("capability_token_hash");