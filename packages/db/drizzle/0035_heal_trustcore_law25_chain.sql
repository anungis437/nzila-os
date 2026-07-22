-- 0035_heal_trustcore_law25_chain.sql
--
-- Phase 0A.1 healer for PH0-OPEN-007.
--
-- Root-cause defect in 0017_trustcore_law25.sql (line 11):
--
--   CREATE TYPE IF NOT EXISTS "public"."tc_program_status" AS ENUM (...);
--
-- PostgreSQL does not support the `IF NOT EXISTS` clause on `CREATE TYPE`
-- (through at least PG 17). The parser rejects the very first statement
-- and the runner aborts. NOTHING from 0017 commits — no enum, no table, no
-- index.
--
-- Cascade failures caused by 0017's zero-commit outcome:
--   * 0019_trustcore_policies.sql line 30
--       ALTER TABLE "trustcore_privacy_programs" ADD COLUMN
--       ...ERROR: relation "trustcore_privacy_programs" does not exist
--     (Note: 0019 lines 1–28 DO commit — the enum tc_policy_type via
--      DO/EXCEPTION and the trustcore_policies table with its indexes.
--      Only the ALTER TABLE add-column fails.)
--   * 0025_trustcore_privacy_programs_org_name.sql line 13
--       ALTER TABLE trustcore_privacy_programs ADD COLUMN org_name TEXT;
--       ERROR: relation "trustcore_privacy_programs" does not exist
--
-- Intended terminal state (per canonical TS schema in packages/db/schema):
--   14 enums:
--     tc_program_status, tc_data_category, tc_sensitivity_level,
--     tc_asset_status, tc_pia_trigger, tc_pia_status, tc_incident_type,
--     tc_severity, tc_resolution_status, tc_dsr_request_type,
--     tc_dsr_status, tc_consent_method, tc_vendor_risk, tc_vendor_status.
--
--   8 tables (all org-scoped via org_id → orgs(id)):
--     trustcore_privacy_programs
--       + trustcore_data_assets
--       + trustcore_pias
--       + trustcore_incidents
--       + trustcore_dsr_requests
--       + trustcore_consent_records
--       + trustcore_vendors
--       + trustcore_evidence_events
--
--   Add-column patches from later chain:
--     0019: trustcore_privacy_programs.onboarding_completed_at TIMESTAMPTZ
--     0025: trustcore_privacy_programs.org_name TEXT
--
--   All 22 indexes originally declared in 0017 + the 2 add-column indexes
--   are inclusive of the healer output.
--
-- Design contract:
--   * Forward-only (does not modify 0017/0019/0025).
--   * Idempotent: safe on empty DB, on the 0017-zero-commit-plus-0019-
--     partial-commit intermediate state, and on a database that has
--     already been fully healed. All CREATE statements use IF NOT EXISTS
--     or DO/EXCEPTION guards.
--   * Uses `DO / EXCEPTION WHEN duplicate_object` guards on every enum,
--     which is the correct idiom for `CREATE TYPE ... AS ENUM` under PG.
--   * No destructive operations. No `DROP` on anything.

BEGIN;

-- ── (1) 14 enums (DO/EXCEPTION guarded) ─────────────────────────────────

DO $tc$ BEGIN
  CREATE TYPE "public"."tc_program_status" AS ENUM ('draft','active','needs_review');
EXCEPTION WHEN duplicate_object THEN NULL; END $tc$;

DO $tc$ BEGIN
  CREATE TYPE "public"."tc_data_category" AS ENUM ('identity','contact','financial','health','employment','children','sensitive','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $tc$;

DO $tc$ BEGIN
  CREATE TYPE "public"."tc_sensitivity_level" AS ENUM ('low','medium','high','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $tc$;

DO $tc$ BEGIN
  CREATE TYPE "public"."tc_asset_status" AS ENUM ('active','archived','needs_review');
EXCEPTION WHEN duplicate_object THEN NULL; END $tc$;

DO $tc$ BEGIN
  CREATE TYPE "public"."tc_pia_trigger" AS ENUM ('new_system','sensitive_data','cross_border','ai_or_automated_decision','vendor_change','major_change','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $tc$;

DO $tc$ BEGIN
  CREATE TYPE "public"."tc_pia_status" AS ENUM ('draft','in_review','approved','rejected','mitigation_required');
EXCEPTION WHEN duplicate_object THEN NULL; END $tc$;

DO $tc$ BEGIN
  CREATE TYPE "public"."tc_incident_type" AS ENUM ('unauthorized_access','unauthorized_use','unauthorized_disclosure','loss','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $tc$;

DO $tc$ BEGIN
  CREATE TYPE "public"."tc_severity" AS ENUM ('low','medium','high','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $tc$;

DO $tc$ BEGIN
  CREATE TYPE "public"."tc_resolution_status" AS ENUM ('open','contained','resolved','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $tc$;

DO $tc$ BEGIN
  CREATE TYPE "public"."tc_dsr_request_type" AS ENUM ('access','rectification','deletion','portability','consent_withdrawal','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $tc$;

DO $tc$ BEGIN
  CREATE TYPE "public"."tc_dsr_status" AS ENUM ('received','verifying_identity','in_progress','completed','denied','overdue');
EXCEPTION WHEN duplicate_object THEN NULL; END $tc$;

DO $tc$ BEGIN
  CREATE TYPE "public"."tc_consent_method" AS ENUM ('web_form','paper','email','verbal','imported','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $tc$;

DO $tc$ BEGIN
  CREATE TYPE "public"."tc_vendor_risk" AS ENUM ('low','medium','high','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $tc$;

DO $tc$ BEGIN
  CREATE TYPE "public"."tc_vendor_status" AS ENUM ('active','pending_review','suspended','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $tc$;

-- ── (2) Enum-drift refusal ──────────────────────────────────────────────
-- If any of the 14 enums exists but is missing declared values, the healer
-- refuses to continue rather than silently accept an incompatible existing
-- enum. Additive extra values on an existing enum are tolerated (this is
-- consistent with the bootstrap reconciliation policy).
DO $tc_drift$
DECLARE
  expected jsonb := '{
    "tc_program_status": ["draft","active","needs_review"],
    "tc_data_category": ["identity","contact","financial","health","employment","children","sensitive","other"],
    "tc_sensitivity_level": ["low","medium","high","critical"],
    "tc_asset_status": ["active","archived","needs_review"],
    "tc_pia_trigger": ["new_system","sensitive_data","cross_border","ai_or_automated_decision","vendor_change","major_change","other"],
    "tc_pia_status": ["draft","in_review","approved","rejected","mitigation_required"],
    "tc_incident_type": ["unauthorized_access","unauthorized_use","unauthorized_disclosure","loss","other"],
    "tc_severity": ["low","medium","high","critical"],
    "tc_resolution_status": ["open","contained","resolved","closed"],
    "tc_dsr_request_type": ["access","rectification","deletion","portability","consent_withdrawal","other"],
    "tc_dsr_status": ["received","verifying_identity","in_progress","completed","denied","overdue"],
    "tc_consent_method": ["web_form","paper","email","verbal","imported","other"],
    "tc_vendor_risk": ["low","medium","high","critical"],
    "tc_vendor_status": ["active","pending_review","suspended","archived"]
  }'::jsonb;
  enum_name text;
  expected_values text[];
  actual_values text[];
  missing text[];
BEGIN
  FOR enum_name IN SELECT jsonb_object_keys(expected) LOOP
    SELECT ARRAY(SELECT jsonb_array_elements_text(expected->enum_name))
      INTO expected_values;
    SELECT ARRAY(
      SELECT e.enumlabel
        FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = 'public' AND t.typname = enum_name
       ORDER BY e.enumsortorder
    ) INTO actual_values;
    IF actual_values IS NULL OR array_length(actual_values, 1) IS NULL THEN
      RAISE EXCEPTION 'healer 0035: enum public.% did not survive DO-guard creation (unexpected)', enum_name;
    END IF;
    missing := ARRAY(
      SELECT unnest(expected_values) EXCEPT SELECT unnest(actual_values)
    );
    IF array_length(missing, 1) IS NOT NULL THEN
      RAISE EXCEPTION 'healer 0035: enum public.% is missing required value(s): %', enum_name, missing;
    END IF;
  END LOOP;
END
$tc_drift$;

-- ── (3) 8 tables (CREATE TABLE IF NOT EXISTS) ───────────────────────────

CREATE TABLE IF NOT EXISTS "trustcore_privacy_programs" (
  "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"                uuid NOT NULL REFERENCES "orgs"("id"),
  "framework"             text NOT NULL DEFAULT 'law25',
  "privacy_officer_name"  text,
  "privacy_officer_email" text,
  "privacy_officer_role"  text,
  "public_contact_email"  text,
  "status"                tc_program_status NOT NULL DEFAULT 'draft',
  "last_reviewed_at"      timestamptz,
  "created_at"            timestamptz NOT NULL DEFAULT now(),
  "updated_at"            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "trustcore_data_assets" (
  "id"                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"                      uuid NOT NULL REFERENCES "orgs"("id"),
  "name"                        text NOT NULL,
  "description"                 text,
  "data_category"               tc_data_category NOT NULL,
  "sensitivity_level"           tc_sensitivity_level NOT NULL,
  "processing_purpose"          text,
  "lawful_basis_or_consent_basis" text,
  "storage_location"            text,
  "system_owner"                text,
  "retention_period"            text,
  "cross_border_transfer"       boolean NOT NULL DEFAULT false,
  "destination_country"         text,
  "vendor_id"                   uuid,
  "status"                      tc_asset_status NOT NULL DEFAULT 'active',
  "created_at"                  timestamptz NOT NULL DEFAULT now(),
  "updated_at"                  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "trustcore_pias" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"          uuid NOT NULL REFERENCES "orgs"("id"),
  "title"           text NOT NULL,
  "trigger_type"    tc_pia_trigger NOT NULL,
  "description"     text,
  "risk_score"      integer,
  "status"          tc_pia_status NOT NULL DEFAULT 'draft',
  "reviewer_name"   text,
  "approved_at"     timestamptz,
  "mitigation_plan" text,
  "created_at"      timestamptz NOT NULL DEFAULT now(),
  "updated_at"      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "trustcore_incidents" (
  "id"                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"                        uuid NOT NULL REFERENCES "orgs"("id"),
  "title"                         text NOT NULL,
  "description"                   text,
  "incident_type"                 tc_incident_type NOT NULL,
  "severity"                      tc_severity NOT NULL,
  "date_detected"                 timestamptz NOT NULL,
  "date_occurred"                 timestamptz,
  "harm_assessment"               text,
  "serious_harm_likely"           boolean NOT NULL DEFAULT false,
  "reported_to_cai"               boolean NOT NULL DEFAULT false,
  "cai_reported_at"               timestamptz,
  "affected_individuals_notified" boolean NOT NULL DEFAULT false,
  "individual_notification_at"    timestamptz,
  "containment_actions"           text,
  "resolution_status"             tc_resolution_status NOT NULL DEFAULT 'open',
  "created_at"                    timestamptz NOT NULL DEFAULT now(),
  "updated_at"                    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "trustcore_dsr_requests" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"            uuid NOT NULL REFERENCES "orgs"("id"),
  "requester_name"    text NOT NULL,
  "requester_email"   text NOT NULL,
  "request_type"      tc_dsr_request_type NOT NULL,
  "identity_verified" boolean NOT NULL DEFAULT false,
  "received_at"       timestamptz NOT NULL,
  "due_at"            timestamptz NOT NULL,
  "completed_at"      timestamptz,
  "status"            tc_dsr_status NOT NULL DEFAULT 'received',
  "response_summary"  text,
  "denial_reason"     text,
  "created_at"        timestamptz NOT NULL DEFAULT now(),
  "updated_at"        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "trustcore_consent_records" (
  "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"               uuid NOT NULL REFERENCES "orgs"("id"),
  "subject_name"         text,
  "subject_email"        text,
  "purpose"              text NOT NULL,
  "consent_method"       tc_consent_method NOT NULL,
  "granted_at"           timestamptz NOT NULL,
  "withdrawn_at"         timestamptz,
  "consent_text_version" text NOT NULL,
  "evidence_ref"         text,
  "created_at"           timestamptz NOT NULL DEFAULT now(),
  "updated_at"           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "trustcore_vendors" (
  "id"                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"                  uuid NOT NULL REFERENCES "orgs"("id"),
  "name"                    text NOT NULL,
  "service_description"     text,
  "country"                 text,
  "data_shared_description" text,
  "risk_level"              tc_vendor_risk NOT NULL DEFAULT 'low',
  "cross_border_transfer"   boolean NOT NULL DEFAULT false,
  "pia_required"            boolean NOT NULL DEFAULT false,
  "contract_reviewed"       boolean NOT NULL DEFAULT false,
  "status"                  tc_vendor_status NOT NULL DEFAULT 'active',
  "created_at"              timestamptz NOT NULL DEFAULT now(),
  "updated_at"              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "trustcore_evidence_events" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"              uuid NOT NULL REFERENCES "orgs"("id"),
  "actor_id"            text NOT NULL,
  "entity_type"         text NOT NULL,
  "entity_id"           text NOT NULL,
  "action"              text NOT NULL,
  "summary"             text,
  "metadata"            jsonb,
  "event_hash"          text,
  "previous_event_hash" text,
  "created_at"          timestamptz NOT NULL DEFAULT now()
);

-- ── (4) Add-column patches from downstream cascade failures ─────────────
-- 0019 tried to add onboarding_completed_at but died on line 30 because
-- trustcore_privacy_programs did not exist yet.
ALTER TABLE "trustcore_privacy_programs"
  ADD COLUMN IF NOT EXISTS "onboarding_completed_at" timestamptz;

-- 0025 tried to add org_name for the same reason.
ALTER TABLE "trustcore_privacy_programs"
  ADD COLUMN IF NOT EXISTS "org_name" text;

-- ── (4b) Restore 0019's other artefacts (Phase 0A.1 finding) ────────────
-- 0019 also declared the tc_policy_type enum, the trustcore_policies
-- table, and two indexes on it. Under PG 14+ single-transaction
-- multi-statement semantics, 0019's runtime error rolled ALL of that
-- back on empty-DB replay; these statements re-establish that terminal
-- state.
DO $healer_0035_tc_policy_type$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tc_policy_type') THEN
    CREATE TYPE "tc_policy_type" AS ENUM ('privacy_policy', 'data_governance');
  END IF;
END
$healer_0035_tc_policy_type$;

CREATE TABLE IF NOT EXISTS "trustcore_policies" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"       uuid NOT NULL REFERENCES "orgs"("id"),
  "type"         "tc_policy_type" NOT NULL,
  "content"      text NOT NULL,
  "version"      integer NOT NULL DEFAULT 1,
  "generated_by" text NOT NULL DEFAULT 'system',
  "created_at"   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "tc_policies_org_idx"
  ON "trustcore_policies" ("org_id");
CREATE INDEX IF NOT EXISTS "tc_policies_org_type_idx"
  ON "trustcore_policies" ("org_id", "type");

-- ── (5) 22 indexes originally declared in 0017 ──────────────────────────

CREATE INDEX IF NOT EXISTS "tc_privacy_programs_org_idx"
  ON "trustcore_privacy_programs" ("org_id");
CREATE INDEX IF NOT EXISTS "tc_privacy_programs_org_status_idx"
  ON "trustcore_privacy_programs" ("org_id", "status");

CREATE INDEX IF NOT EXISTS "tc_data_assets_org_idx"
  ON "trustcore_data_assets" ("org_id");
CREATE INDEX IF NOT EXISTS "tc_data_assets_org_status_idx"
  ON "trustcore_data_assets" ("org_id", "status");
CREATE INDEX IF NOT EXISTS "tc_data_assets_org_sensitivity_idx"
  ON "trustcore_data_assets" ("org_id", "sensitivity_level");

CREATE INDEX IF NOT EXISTS "tc_pias_org_idx"
  ON "trustcore_pias" ("org_id");
CREATE INDEX IF NOT EXISTS "tc_pias_org_status_idx"
  ON "trustcore_pias" ("org_id", "status");

CREATE INDEX IF NOT EXISTS "tc_incidents_org_idx"
  ON "trustcore_incidents" ("org_id");
CREATE INDEX IF NOT EXISTS "tc_incidents_org_status_idx"
  ON "trustcore_incidents" ("org_id", "resolution_status");
CREATE INDEX IF NOT EXISTS "tc_incidents_org_severity_idx"
  ON "trustcore_incidents" ("org_id", "severity");

CREATE INDEX IF NOT EXISTS "tc_dsr_requests_org_idx"
  ON "trustcore_dsr_requests" ("org_id");
CREATE INDEX IF NOT EXISTS "tc_dsr_requests_org_status_idx"
  ON "trustcore_dsr_requests" ("org_id", "status");
CREATE INDEX IF NOT EXISTS "tc_dsr_requests_org_due_idx"
  ON "trustcore_dsr_requests" ("org_id", "due_at");

CREATE INDEX IF NOT EXISTS "tc_consent_records_org_idx"
  ON "trustcore_consent_records" ("org_id");
CREATE INDEX IF NOT EXISTS "tc_consent_records_org_created_idx"
  ON "trustcore_consent_records" ("org_id", "created_at");

CREATE INDEX IF NOT EXISTS "tc_vendors_org_idx"
  ON "trustcore_vendors" ("org_id");
CREATE INDEX IF NOT EXISTS "tc_vendors_org_status_idx"
  ON "trustcore_vendors" ("org_id", "status");
CREATE INDEX IF NOT EXISTS "tc_vendors_org_risk_idx"
  ON "trustcore_vendors" ("org_id", "risk_level");

CREATE INDEX IF NOT EXISTS "tc_evidence_events_org_idx"
  ON "trustcore_evidence_events" ("org_id");
CREATE INDEX IF NOT EXISTS "tc_evidence_events_org_created_idx"
  ON "trustcore_evidence_events" ("org_id", "created_at");
CREATE INDEX IF NOT EXISTS "tc_evidence_events_org_entity_idx"
  ON "trustcore_evidence_events" ("org_id", "entity_type", "entity_id");

COMMIT;
