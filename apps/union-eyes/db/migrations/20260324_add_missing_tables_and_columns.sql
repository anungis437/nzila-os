-- Migration: Add missing tables and columns
-- Date: 2026-03-24
--
-- 1. Add missing columns to reserved_matter_votes (created with partial schema)
-- 2. Create reports, report_templates, report_executions, scheduled_reports, report_shares tables
-- ============================================================================

-- ============================================================================
-- 1. reserved_matter_votes — add missing columns
-- ============================================================================

ALTER TABLE "reserved_matter_votes"
  ADD COLUMN IF NOT EXISTS "proposed_date" timestamp,
  ADD COLUMN IF NOT EXISTS "voting_deadline" timestamp,
  ADD COLUMN IF NOT EXISTS "matter_details" jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "class_a_votes_for" integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "class_a_votes_against" integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "class_a_abstain" integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "class_a_total_votes" integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "class_a_percent_for" integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "class_b_vote" text,
  ADD COLUMN IF NOT EXISTS "class_b_vote_date" timestamp,
  ADD COLUMN IF NOT EXISTS "class_b_vote_rationale" text,
  ADD COLUMN IF NOT EXISTS "class_b_council_members_voting" jsonb,
  ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "final_decision" text,
  ADD COLUMN IF NOT EXISTS "decision_date" timestamp,
  ADD COLUMN IF NOT EXISTS "implemented" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "implementation_date" timestamp,
  ADD COLUMN IF NOT EXISTS "implementation_notes" text;

-- ============================================================================
-- 2. Report enums
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE report_type AS ENUM ('custom', 'template', 'system', 'scheduled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE report_category AS ENUM ('claims', 'members', 'financial', 'compliance', 'performance', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE report_format AS ENUM ('pdf', 'excel', 'csv', 'json', 'html');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE schedule_frequency AS ENUM ('daily', 'weekly', 'monthly', 'quarterly', 'yearly');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 3. reports table
-- ============================================================================

CREATE TABLE IF NOT EXISTS "reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "description" text,
  "report_type" report_type NOT NULL DEFAULT 'custom',
  "category" report_category NOT NULL DEFAULT 'custom',
  "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "is_public" boolean NOT NULL DEFAULT false,
  "is_template" boolean NOT NULL DEFAULT false,
  "template_id" uuid,
  "created_by" varchar(255) NOT NULL,
  "updated_by" varchar(255),
  "last_run_at" timestamp,
  "run_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. report_templates table
-- ============================================================================

CREATE TABLE IF NOT EXISTS "report_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "description" text,
  "category" report_category NOT NULL,
  "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "is_system" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "thumbnail" varchar(500),
  "tags" jsonb,
  "created_by" varchar(255),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- ============================================================================
-- 5. report_executions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS "report_executions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "report_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "executed_by" varchar(255) NOT NULL,
  "executed_at" timestamp NOT NULL DEFAULT now(),
  "format" report_format NOT NULL DEFAULT 'pdf',
  "parameters" jsonb,
  "result_count" varchar(50),
  "execution_time_ms" varchar(50),
  "file_url" varchar(500),
  "file_size" varchar(50),
  "status" varchar(50) NOT NULL DEFAULT 'completed',
  "error_message" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- ============================================================================
-- 6. scheduled_reports table
-- ============================================================================

CREATE TABLE IF NOT EXISTS "scheduled_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "report_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "frequency" schedule_frequency NOT NULL,
  "day_of_week" varchar(20),
  "day_of_month" varchar(20),
  "time_of_day" varchar(10) NOT NULL DEFAULT '08:00',
  "timezone" varchar(100) NOT NULL DEFAULT 'UTC',
  "format" report_format NOT NULL DEFAULT 'pdf',
  "recipients" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "parameters" jsonb,
  "is_active" boolean NOT NULL DEFAULT true,
  "last_executed_at" timestamp,
  "next_execution_at" timestamp,
  "created_by" varchar(255) NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- ============================================================================
-- 7. report_shares table
-- ============================================================================

CREATE TABLE IF NOT EXISTS "report_shares" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "report_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "shared_by" varchar(255) NOT NULL,
  "shared_with" varchar(255),
  "can_edit" boolean NOT NULL DEFAULT false,
  "can_execute" boolean NOT NULL DEFAULT true,
  "expires_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);
