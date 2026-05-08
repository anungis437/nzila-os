-- Fixup: align modern schema after 0019 drops + missing newer migrations.
-- Migration 0019_lonely_stephen_strange drops ~400 tables that newer migrations
-- never recreated (they were factored into a single mega-schema migration that
-- isn't tracked in the journal). Some app code + seeds still expect a few of
-- these tables and additional organization columns added by 0093/CLC migrations.
-- This fixup adds back only what's needed for `seed:test-env` and runtime
-- read paths used by E2E. Idempotent — safe to re-run.

-- =====================================================
-- Organizations: add columns expected by Drizzle schema
-- =====================================================
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "app_id" uuid;
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "clc_affiliate_code" varchar(20);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "per_capita_rate" numeric(10, 2);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "remittance_day" integer DEFAULT 15;
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "last_remittance_date" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "fiscal_year_end" date DEFAULT '2024-12-31';
--> statement-breakpoint

-- =====================================================
-- Claims + claim_updates (dropped by 0019, never recreated)
-- =====================================================
-- Earlier migrations (0001_phase5b) may have created claims with the legacy
-- shape (claim_id PK, tenant_id, varchar money columns). Drop and recreate
-- with the modern Drizzle-defined shape used by app code + seeds.
DROP TABLE IF EXISTS "claim_updates" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "claims" CASCADE;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."claim_priority" AS ENUM('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."claim_status" AS ENUM('submitted', 'under_review', 'assigned', 'investigation', 'pending_documentation', 'resolved', 'rejected', 'closed');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."claim_type" AS ENUM('grievance_discipline', 'grievance_schedule', 'grievance_pay', 'workplace_safety', 'discrimination_age', 'discrimination_gender', 'discrimination_race', 'discrimination_disability', 'harassment_verbal', 'harassment_physical', 'harassment_sexual', 'contract_dispute', 'retaliation', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."visibility_scope" AS ENUM('member', 'staff', 'admin', 'public');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "claims" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "claim_id" uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  "claim_number" varchar(50) UNIQUE,
  "organization_id" uuid NOT NULL,
  "member_id" varchar(255),
  "is_anonymous" boolean DEFAULT true,
  "claim_type" "claim_type",
  "status" "claim_status" NOT NULL DEFAULT 'submitted',
  "priority" "claim_priority" NOT NULL DEFAULT 'medium',
  "incident_date" timestamp with time zone,
  "location" text,
  "description" text,
  "desired_outcome" text,
  "witnesses_present" boolean DEFAULT false,
  "witness_details" text,
  "previously_reported" boolean DEFAULT false,
  "previous_report_details" text,
  "assigned_to" varchar(255),
  "assigned_at" timestamp with time zone,
  "ai_score" integer,
  "ai_analysis" jsonb,
  "merit_confidence" integer,
  "precedent_match" integer,
  "complexity_score" integer,
  "progress" integer DEFAULT 0,
  "claim_amount" numeric(14, 2) NOT NULL DEFAULT '0',
  "settlement_amount" numeric(14, 2) NOT NULL DEFAULT '0',
  "legal_costs" numeric(14, 2) NOT NULL DEFAULT '0',
  "court_costs" numeric(14, 2) NOT NULL DEFAULT '0',
  "resolution_outcome" varchar(100),
  "filed_date" timestamp with time zone,
  "resolved_at" timestamp with time zone,
  "attachments" jsonb DEFAULT '[]'::jsonb,
  "voice_transcriptions" jsonb DEFAULT '[]'::jsonb,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "idempotency_hash" varchar(64) UNIQUE,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "closed_at" timestamp with time zone
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "claim_updates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "update_id" uuid UNIQUE DEFAULT gen_random_uuid(),
  "claim_id" uuid NOT NULL REFERENCES "claims"("claim_id") ON DELETE CASCADE,
  "update_type" varchar(50),
  "message" text,
  "created_by" varchar(255),
  "is_internal" boolean DEFAULT false,
  "visibility_scope" "visibility_scope" NOT NULL DEFAULT 'member',
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_claims_org" ON "claims" ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_claims_status" ON "claims" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_claims_member" ON "claims" ("member_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_claims_created" ON "claims" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_claims_type" ON "claims" ("claim_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_claims_priority" ON "claims" ("priority");
