-- Migration 0017: TrustCore Law 25 Schema
-- Privacy compliance and governance tables for the TrustCore module.
-- All tables are org-scoped (org_id → orgs.id).
--
-- Apply manually (postgres):
--   psql $DATABASE_URL -f packages/db/drizzle/0017_trustcore_law25.sql

-- ── Enums ──────────────────────────────────────────────────────────────────

CREATE TYPE IF NOT EXISTS "public"."tc_program_status"
  AS ENUM('draft', 'active', 'needs_review');

CREATE TYPE IF NOT EXISTS "public"."tc_data_category"
  AS ENUM('identity', 'contact', 'financial', 'health', 'employment', 'children', 'sensitive', 'other');

CREATE TYPE IF NOT EXISTS "public"."tc_sensitivity_level"
  AS ENUM('low', 'medium', 'high', 'critical');

CREATE TYPE IF NOT EXISTS "public"."tc_asset_status"
  AS ENUM('active', 'archived', 'needs_review');

CREATE TYPE IF NOT EXISTS "public"."tc_pia_trigger"
  AS ENUM('new_system', 'sensitive_data', 'cross_border', 'ai_or_automated_decision', 'vendor_change', 'major_change', 'other');

CREATE TYPE IF NOT EXISTS "public"."tc_pia_status"
  AS ENUM('draft', 'in_review', 'approved', 'rejected', 'mitigation_required');

CREATE TYPE IF NOT EXISTS "public"."tc_incident_type"
  AS ENUM('unauthorized_access', 'unauthorized_use', 'unauthorized_disclosure', 'loss', 'other');

CREATE TYPE IF NOT EXISTS "public"."tc_severity"
  AS ENUM('low', 'medium', 'high', 'critical');

CREATE TYPE IF NOT EXISTS "public"."tc_resolution_status"
  AS ENUM('open', 'contained', 'resolved', 'closed');

CREATE TYPE IF NOT EXISTS "public"."tc_dsr_request_type"
  AS ENUM('access', 'rectification', 'deletion', 'portability', 'consent_withdrawal', 'other');

CREATE TYPE IF NOT EXISTS "public"."tc_dsr_status"
  AS ENUM('received', 'verifying_identity', 'in_progress', 'completed', 'denied', 'overdue');

CREATE TYPE IF NOT EXISTS "public"."tc_consent_method"
  AS ENUM('web_form', 'paper', 'email', 'verbal', 'imported', 'other');

CREATE TYPE IF NOT EXISTS "public"."tc_vendor_risk"
  AS ENUM('low', 'medium', 'high', 'critical');

CREATE TYPE IF NOT EXISTS "public"."tc_vendor_status"
  AS ENUM('active', 'pending_review', 'suspended', 'archived');

-- ── A) trustcore_privacy_programs ─────────────────────────────────────────

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

CREATE INDEX IF NOT EXISTS "tc_privacy_programs_org_idx"
  ON "trustcore_privacy_programs" ("org_id");
CREATE INDEX IF NOT EXISTS "tc_privacy_programs_org_status_idx"
  ON "trustcore_privacy_programs" ("org_id", "status");

-- ── B) trustcore_data_assets ───────────────────────────────────────────────

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

CREATE INDEX IF NOT EXISTS "tc_data_assets_org_idx"
  ON "trustcore_data_assets" ("org_id");
CREATE INDEX IF NOT EXISTS "tc_data_assets_org_status_idx"
  ON "trustcore_data_assets" ("org_id", "status");
CREATE INDEX IF NOT EXISTS "tc_data_assets_org_sensitivity_idx"
  ON "trustcore_data_assets" ("org_id", "sensitivity_level");

-- ── C) trustcore_pias ─────────────────────────────────────────────────────

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

CREATE INDEX IF NOT EXISTS "tc_pias_org_idx"
  ON "trustcore_pias" ("org_id");
CREATE INDEX IF NOT EXISTS "tc_pias_org_status_idx"
  ON "trustcore_pias" ("org_id", "status");

-- ── D) trustcore_incidents ─────────────────────────────────────────────────

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

CREATE INDEX IF NOT EXISTS "tc_incidents_org_idx"
  ON "trustcore_incidents" ("org_id");
CREATE INDEX IF NOT EXISTS "tc_incidents_org_status_idx"
  ON "trustcore_incidents" ("org_id", "resolution_status");
CREATE INDEX IF NOT EXISTS "tc_incidents_org_severity_idx"
  ON "trustcore_incidents" ("org_id", "severity");

-- ── E) trustcore_dsr_requests ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "trustcore_dsr_requests" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"           uuid NOT NULL REFERENCES "orgs"("id"),
  "requester_name"   text NOT NULL,
  "requester_email"  text NOT NULL,
  "request_type"     tc_dsr_request_type NOT NULL,
  "identity_verified" boolean NOT NULL DEFAULT false,
  "received_at"      timestamptz NOT NULL,
  "due_at"           timestamptz NOT NULL,
  "completed_at"     timestamptz,
  "status"           tc_dsr_status NOT NULL DEFAULT 'received',
  "response_summary" text,
  "denial_reason"    text,
  "created_at"       timestamptz NOT NULL DEFAULT now(),
  "updated_at"       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "tc_dsr_requests_org_idx"
  ON "trustcore_dsr_requests" ("org_id");
CREATE INDEX IF NOT EXISTS "tc_dsr_requests_org_status_idx"
  ON "trustcore_dsr_requests" ("org_id", "status");
CREATE INDEX IF NOT EXISTS "tc_dsr_requests_org_due_idx"
  ON "trustcore_dsr_requests" ("org_id", "due_at");

-- ── F) trustcore_consent_records ──────────────────────────────────────────

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

CREATE INDEX IF NOT EXISTS "tc_consent_records_org_idx"
  ON "trustcore_consent_records" ("org_id");
CREATE INDEX IF NOT EXISTS "tc_consent_records_org_created_idx"
  ON "trustcore_consent_records" ("org_id", "created_at");

-- ── G) trustcore_vendors ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "trustcore_vendors" (
  "id"                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"                 uuid NOT NULL REFERENCES "orgs"("id"),
  "name"                   text NOT NULL,
  "service_description"    text,
  "country"                text,
  "data_shared_description" text,
  "risk_level"             tc_vendor_risk NOT NULL DEFAULT 'low',
  "cross_border_transfer"  boolean NOT NULL DEFAULT false,
  "pia_required"           boolean NOT NULL DEFAULT false,
  "contract_reviewed"      boolean NOT NULL DEFAULT false,
  "status"                 tc_vendor_status NOT NULL DEFAULT 'active',
  "created_at"             timestamptz NOT NULL DEFAULT now(),
  "updated_at"             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "tc_vendors_org_idx"
  ON "trustcore_vendors" ("org_id");
CREATE INDEX IF NOT EXISTS "tc_vendors_org_status_idx"
  ON "trustcore_vendors" ("org_id", "status");
CREATE INDEX IF NOT EXISTS "tc_vendors_org_risk_idx"
  ON "trustcore_vendors" ("org_id", "risk_level");

-- ── H) trustcore_evidence_events ──────────────────────────────────────────

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

CREATE INDEX IF NOT EXISTS "tc_evidence_events_org_idx"
  ON "trustcore_evidence_events" ("org_id");
CREATE INDEX IF NOT EXISTS "tc_evidence_events_org_created_idx"
  ON "trustcore_evidence_events" ("org_id", "created_at");
CREATE INDEX IF NOT EXISTS "tc_evidence_events_org_entity_idx"
  ON "trustcore_evidence_events" ("org_id", "entity_type", "entity_id");
