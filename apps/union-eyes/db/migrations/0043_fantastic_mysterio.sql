CREATE TYPE "public"."exit_interview_indexing_status" AS ENUM('pending', 'indexing', 'indexed', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."exit_interview_sensitivity" AS ENUM('public_internal', 'restricted', 'privileged', 'legal_sensitive', 'executive_confidential');--> statement-breakpoint
ALTER TYPE "public"."exit_interview_event_type" ADD VALUE 'indexed';--> statement-breakpoint
ALTER TYPE "public"."exit_interview_event_type" ADD VALUE 'summarized';--> statement-breakpoint
ALTER TYPE "public"."exit_interview_event_type" ADD VALUE 'governance_updated';--> statement-breakpoint
ALTER TABLE "exit_interviews" ADD COLUMN "sensitivity_level" "exit_interview_sensitivity" DEFAULT 'public_internal' NOT NULL;--> statement-breakpoint
ALTER TABLE "exit_interviews" ADD COLUMN "consent_granted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "exit_interviews" ADD COLUMN "consent_granted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "exit_interviews" ADD COLUMN "consent_granted_by" text;--> statement-breakpoint
ALTER TABLE "exit_interviews" ADD COLUMN "expertise_tags" jsonb;--> statement-breakpoint
ALTER TABLE "exit_interviews" ADD COLUMN "continuity_risk_score" integer;--> statement-breakpoint
ALTER TABLE "exit_interviews" ADD COLUMN "continuity_risk_flags" jsonb;--> statement-breakpoint
ALTER TABLE "exit_interviews" ADD COLUMN "indexing_status" "exit_interview_indexing_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "exit_interviews" ADD COLUMN "indexed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "exit_interviews" ADD COLUMN "ai_summary" text;--> statement-breakpoint
ALTER TABLE "exit_interviews" ADD COLUMN "ai_summary_generated_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_exit_interviews_sensitivity" ON "exit_interviews" USING btree ("sensitivity_level");--> statement-breakpoint
CREATE INDEX "idx_exit_interviews_indexing_status" ON "exit_interviews" USING btree ("indexing_status");--> statement-breakpoint
CREATE INDEX "idx_exit_interviews_risk_score" ON "exit_interviews" USING btree ("continuity_risk_score");