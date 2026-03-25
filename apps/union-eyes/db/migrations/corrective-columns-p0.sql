-- =============================================================================
-- Corrective Migration: P0 Column-Level Drift
-- Date: 2026-03-16
-- Purpose: Fix tables that exist but have missing columns, plus create tables
--          that don't exist yet but are actively referenced by API routes.
--
-- Tables addressed:
--   1. course_registrations    — CREATE TABLE (45 cols, used by education-reminders cron)
--   2. audit_security.audit_logs — CREATE SCHEMA + TABLE (20 cols, audit infrastructure)
--   3. consent_records          — ALTER ADD 11 columns (campaigns.ts canonical export)
--   4. arbitration_precedents   — ALTER ADD 31 columns (full precedent DB)
--   5. votes                    — ALTER ADD 11 columns (Drizzle voting schema)
--   6. audit_security.security_events      — CREATE TABLE
--   7. audit_security.failed_login_attempts — CREATE TABLE
--   8. audit_security.rate_limit_events     — CREATE TABLE
-- =============================================================================

-- =============================================================================
-- PHASE A: Create enums (must be committed before use in same session)
-- =============================================================================

-- Create missing consent_channel enum
DO $$ BEGIN
  CREATE TYPE "consent_channel" AS ENUM ('email','sms','push','phone','mail');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add missing consent_status values
ALTER TYPE consent_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE consent_status ADD VALUE IF NOT EXISTS 'revoked';


-- =============================================================================
-- PHASE B: Schema changes (single transaction)
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. course_registrations — full CREATE (training.ts)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "course_registrations" (
  "id"                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id"           uuid NOT NULL REFERENCES "organizations"("id"),
  "member_id"                 varchar(255) NOT NULL,
  "course_id"                 uuid NOT NULL REFERENCES "training_courses"("id"),
  "session_id"                uuid NOT NULL REFERENCES "course_sessions"("id"),
  "registration_date"         timestamptz DEFAULT now(),
  "registration_status"       varchar(50) DEFAULT 'registered',
  "requires_approval"         boolean DEFAULT false,
  "approved_by"               varchar(255),
  "approved_date"             date,
  "approval_notes"            text,
  "attended"                  boolean DEFAULT false,
  "attendance_dates"          jsonb,
  "attendance_hours"          numeric(5,2),
  "completed"                 boolean DEFAULT false,
  "completion_date"           date,
  "completion_percentage"     numeric(5,2) DEFAULT 0.00,
  "pre_test_score"            numeric(5,2),
  "post_test_score"           numeric(5,2),
  "final_grade"               varchar(10),
  "passed"                    boolean,
  "certificate_issued"        boolean DEFAULT false,
  "certificate_number"        varchar(100),
  "certificate_issue_date"    date,
  "certificate_url"           text,
  "evaluation_completed"      boolean DEFAULT false,
  "evaluation_rating"         numeric(3,2),
  "evaluation_comments"       text,
  "evaluation_submitted_date" date,
  "travel_required"           boolean DEFAULT false,
  "travel_subsidy_requested"  boolean DEFAULT false,
  "travel_subsidy_approved"   boolean DEFAULT false,
  "travel_subsidy_amount"     numeric(10,2),
  "accommodation_required"    boolean DEFAULT false,
  "course_fee"                numeric(10,2) DEFAULT 0.00,
  "fee_paid"                  boolean DEFAULT false,
  "fee_payment_date"          date,
  "fee_waived"                boolean DEFAULT false,
  "fee_waiver_reason"         text,
  "cancellation_date"         date,
  "cancellation_reason"       text,
  "notes"                     text,
  "created_at"                timestamptz DEFAULT now(),
  "updated_at"                timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_course_registrations_completed"
  ON "course_registrations" USING btree ("completed");
CREATE INDEX IF NOT EXISTS "idx_course_registrations_course"
  ON "course_registrations" USING btree ("course_id");
CREATE INDEX IF NOT EXISTS "idx_course_registrations_member"
  ON "course_registrations" USING btree ("member_id");
CREATE INDEX IF NOT EXISTS "idx_course_registrations_org"
  ON "course_registrations" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_course_registrations_session"
  ON "course_registrations" USING btree ("session_id");
CREATE INDEX IF NOT EXISTS "idx_course_registrations_status"
  ON "course_registrations" USING btree ("registration_status");


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. audit_security schema + tables
-- ─────────────────────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS "audit_security";

-- audit_logs
CREATE TABLE IF NOT EXISTS "audit_security"."audit_logs" (
  "audit_id"        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid,
  "user_id"         varchar(255),
  "action"          varchar(100) NOT NULL CHECK (action != ''),
  "resource_type"   varchar(50) NOT NULL,
  "resource_id"     uuid,
  "old_values"      jsonb,
  "new_values"      jsonb,
  "ip_address"      varchar(45),
  "user_agent"      text,
  "session_id"      uuid,
  "correlation_id"  uuid,
  "severity"        varchar(20) DEFAULT 'info'
                    CHECK (severity IN ('debug','info','warning','error','critical')),
  "outcome"         varchar(20) DEFAULT 'success'
                    CHECK (outcome IN ('success','failure','error')),
  "error_message"   text,
  "metadata"        jsonb DEFAULT '{}'::jsonb,
  "archived"        boolean NOT NULL DEFAULT false,
  "archived_at"     timestamptz,
  "archived_path"   text,
  "created_at"      timestamptz DEFAULT now()
);

-- security_events
CREATE TABLE IF NOT EXISTS "audit_security"."security_events" (
  "event_id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id"   uuid,
  "user_id"           varchar(255),
  "event_type"        varchar(50) NOT NULL,
  "event_category"    varchar(30) NOT NULL
                      CHECK (event_category IN ('authentication','authorization','data_access','configuration','suspicious')),
  "severity"          varchar(20) NOT NULL
                      CHECK (severity IN ('low','medium','high','critical')),
  "description"       text NOT NULL,
  "source_ip"         varchar(45),
  "user_agent"        text,
  "additional_data"   jsonb DEFAULT '{}'::jsonb,
  "risk_score"        integer DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  "is_resolved"       boolean DEFAULT false,
  "resolved_at"       timestamptz,
  "resolved_by"       varchar(255),
  "resolution_notes"  text,
  "created_at"        timestamptz DEFAULT now()
);

-- failed_login_attempts
CREATE TABLE IF NOT EXISTS "audit_security"."failed_login_attempts" (
  "attempt_id"      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email"           varchar(255) NOT NULL,
  "ip_address"      varchar(45) NOT NULL,
  "user_agent"      text,
  "failure_reason"  varchar(100) NOT NULL,
  "attempted_at"    timestamptz DEFAULT now()
);

-- rate_limit_events
CREATE TABLE IF NOT EXISTS "audit_security"."rate_limit_events" (
  "event_id"        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "identifier"      varchar(255) NOT NULL,
  "identifier_type" varchar(20) NOT NULL
                    CHECK (identifier_type IN ('ip','user','api_key')),
  "endpoint"        varchar(255) NOT NULL,
  "request_count"   integer NOT NULL,
  "limit_exceeded"  boolean DEFAULT false,
  "window_start"    timestamptz NOT NULL,
  "window_end"      timestamptz NOT NULL,
  "created_at"      timestamptz DEFAULT now()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. consent_records — ADD columns from campaigns.ts (canonical export)
--    Existing: id, created_at, updated_at, subject_type
--    Table is empty, so NOT NULL is safe.
--    Enums created in PHASE A above.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "consent_records"
  ADD COLUMN IF NOT EXISTS "organization_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  ADD COLUMN IF NOT EXISTS "user_id"         varchar(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "consent_type"    varchar(100) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "channel"         consent_channel NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS "status"          consent_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "method"          varchar(50),
  ADD COLUMN IF NOT EXISTS "consent_text"    text,
  ADD COLUMN IF NOT EXISTS "ip_address"      varchar(45),
  ADD COLUMN IF NOT EXISTS "user_agent"      text,
  ADD COLUMN IF NOT EXISTS "expires_at"      timestamptz,
  ADD COLUMN IF NOT EXISTS "metadata"        jsonb DEFAULT '{}';

-- Remove temporary defaults from NOT NULL columns (table is empty so safe)
ALTER TABLE "consent_records"
  ALTER COLUMN "organization_id" DROP DEFAULT,
  ALTER COLUMN "user_id"         DROP DEFAULT,
  ALTER COLUMN "consent_type"    DROP DEFAULT,
  ALTER COLUMN "channel"         DROP DEFAULT,
  ALTER COLUMN "status"          DROP DEFAULT;

-- Add FK for organization_id
DO $$ BEGIN
  ALTER TABLE "consent_records"
    ADD CONSTRAINT "consent_records_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS "idx_consent_records_org"     ON "consent_records" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_consent_records_user"    ON "consent_records" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_consent_records_channel" ON "consent_records" ("channel");
CREATE INDEX IF NOT EXISTS "idx_consent_records_status"  ON "consent_records" ("status");
CREATE INDEX IF NOT EXISTS "idx_consent_records_created" ON "consent_records" ("created_at");


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. arbitration_precedents — ADD 31 columns
--    Existing: id, created_at, updated_at, source_organization_id
--    Table is empty, so NOT NULL is safe.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "arbitration_precedents"
  ADD COLUMN IF NOT EXISTS "source_decision_id"     uuid,
  ADD COLUMN IF NOT EXISTS "case_number"            varchar(100),
  ADD COLUMN IF NOT EXISTS "case_title"             varchar(500) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "decision_date"          date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS "is_parties_anonymized"  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "union_name"             varchar(200),
  ADD COLUMN IF NOT EXISTS "employer_name"          varchar(200),
  ADD COLUMN IF NOT EXISTS "arbitrator_name"        varchar(200) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "jurisdiction"           varchar(50) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "grievance_type"         varchar(100) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "issue_summary"          text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "union_position"         text,
  ADD COLUMN IF NOT EXISTS "employer_position"      text,
  ADD COLUMN IF NOT EXISTS "outcome"                varchar(50) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "decision_summary"       text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "reasoning"              text,
  ADD COLUMN IF NOT EXISTS "precedential_value"     varchar(20) DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS "key_principles"         text[],
  ADD COLUMN IF NOT EXISTS "related_legislation"    text,
  ADD COLUMN IF NOT EXISTS "cited_cases"            uuid[],
  ADD COLUMN IF NOT EXISTS "citation_count"         integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "document_url"           varchar(500),
  ADD COLUMN IF NOT EXISTS "document_path"          varchar(500),
  ADD COLUMN IF NOT EXISTS "redacted_document_url"  varchar(500),
  ADD COLUMN IF NOT EXISTS "redacted_document_path" varchar(500),
  ADD COLUMN IF NOT EXISTS "has_redacted_version"   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sharing_level"          varchar(50) NOT NULL DEFAULT 'federation',
  ADD COLUMN IF NOT EXISTS "shared_with_org_ids"    uuid[],
  ADD COLUMN IF NOT EXISTS "sector"                 varchar(100),
  ADD COLUMN IF NOT EXISTS "province"               varchar(2),
  ADD COLUMN IF NOT EXISTS "view_count"             integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "download_count"         integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "created_by"             varchar(255) NOT NULL DEFAULT '';

-- Remove temporary defaults from NOT NULL columns
ALTER TABLE "arbitration_precedents"
  ALTER COLUMN "case_title"        DROP DEFAULT,
  ALTER COLUMN "decision_date"     DROP DEFAULT,
  ALTER COLUMN "arbitrator_name"   DROP DEFAULT,
  ALTER COLUMN "jurisdiction"      DROP DEFAULT,
  ALTER COLUMN "grievance_type"    DROP DEFAULT,
  ALTER COLUMN "issue_summary"     DROP DEFAULT,
  ALTER COLUMN "outcome"           DROP DEFAULT,
  ALTER COLUMN "decision_summary"  DROP DEFAULT,
  ALTER COLUMN "sharing_level"     DROP DEFAULT,
  ALTER COLUMN "created_by"        DROP DEFAULT;

-- Wait, sharing_level has a real default of 'federation' in the schema — keep it
ALTER TABLE "arbitration_precedents"
  ALTER COLUMN "sharing_level" SET DEFAULT 'federation';

-- Add indexes
CREATE INDEX IF NOT EXISTS "idx_precedents_org"          ON "arbitration_precedents" ("source_organization_id");
CREATE INDEX IF NOT EXISTS "idx_precedents_type"         ON "arbitration_precedents" ("grievance_type");
CREATE INDEX IF NOT EXISTS "idx_precedents_outcome"      ON "arbitration_precedents" ("outcome");
CREATE INDEX IF NOT EXISTS "idx_precedents_arbitrator"   ON "arbitration_precedents" ("arbitrator_name");
CREATE INDEX IF NOT EXISTS "idx_precedents_jurisdiction" ON "arbitration_precedents" ("jurisdiction");
CREATE INDEX IF NOT EXISTS "idx_precedents_sharing"      ON "arbitration_precedents" ("sharing_level");
CREATE INDEX IF NOT EXISTS "idx_precedents_level"        ON "arbitration_precedents" ("precedential_value");
CREATE INDEX IF NOT EXISTS "idx_precedents_sector"       ON "arbitration_precedents" ("sector");


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. votes — ADD Drizzle columns alongside existing Django columns
--    Existing Django cols: id, org_id, approval_id, voter_person_id, weight, choice, cast_at
--    Adding Drizzle cols: session_id, option_id, voter_id, voter_hash, signature,
--                         receipt_id, verification_code, audit_hash, is_anonymous,
--                         voter_type, voter_metadata
--    Table is empty but nullable to co-exist with Django schema.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "votes"
  ADD COLUMN IF NOT EXISTS "session_id"         uuid REFERENCES "voting_sessions"("id") ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS "option_id"          uuid REFERENCES "voting_options"("id") ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS "voter_id"           varchar(100),
  ADD COLUMN IF NOT EXISTS "voter_hash"         varchar(100),
  ADD COLUMN IF NOT EXISTS "signature"          text,
  ADD COLUMN IF NOT EXISTS "receipt_id"         varchar(255),
  ADD COLUMN IF NOT EXISTS "verification_code"  varchar(100),
  ADD COLUMN IF NOT EXISTS "audit_hash"         varchar(255),
  ADD COLUMN IF NOT EXISTS "is_anonymous"       boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS "voter_type"         varchar(20) DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS "voter_metadata"     jsonb DEFAULT '{}'::jsonb;


COMMIT;
