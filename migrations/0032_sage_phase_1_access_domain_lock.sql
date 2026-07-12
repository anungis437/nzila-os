-- Migration 0032: SAGE Phase 1 — access model, domain lock, and stakeholder authorization
-- Purpose: repo-native foundation for the SAGE workspace (Service Assurance & Governance Evidence).
-- Scope: stakeholder access model, workspace boundary lock, evidence/decision domain tables.
-- Notes:
--   * Aligns with docs/public-service/sage-world-class-implementation-blueprint.md.
--   * org_id is the tenancy boundary (matches packages/audit AuditEntry.orgId convention).
--   * Idempotent: enums via DO $$ ... EXCEPTION WHEN duplicate_object; tables via IF NOT EXISTS.
--   * Cross-table invariant "export requester cannot approve own export" is enforced in the
--     TypeScript service/invariant layer (packages/sage-core), not by a raw-SQL CHECK.

-- ─── Enums ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE sage_workspace_status AS ENUM ('draft', 'active', 'locked', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sage_institution_type AS ENUM (
    'department_ministry',
    'crown_corporation',
    'regulator',
    'tribunal_ombuds_accountability',
    'public_broadcaster_cultural',
    'health_public_health',
    'education',
    'elections_democratic',
    'police_enforcement_corrections',
    'indigenous_government_or_service',
    'other_public_institution'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sage_risk_surface AS ENUM (
    'general_governance',
    'implementation_continuity',
    'regulatory_boundary',
    'tribunal_ombuds_boundary',
    'public_broadcaster_boundary',
    'health_phi_deferred',
    'student_records_boundary',
    'elections_security_boundary',
    'enforcement_corrections_boundary',
    'indigenous_protocol_boundary'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sage_evidence_lifecycle AS ENUM (
    'proposed', 'registered', 'classified', 'linked', 'reviewed',
    'accepted', 'needs_review', 'excluded', 'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sage_source_type AS ENUM (
    'public', 'administrative', 'authorized_only', 'excluded', 'unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sage_source_quality AS ENUM (
    'low', 'low_moderate', 'moderate', 'high', 'insufficient'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sage_authorization_level AS ENUM (
    'public', 'administrative', 'internal', 'authorized_only', 'sensitive', 'excluded'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sage_confidence_level AS ENUM (
    'low', 'low_moderate', 'moderate', 'high', 'insufficient'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sage_boundary_flag_type AS ENUM (
    'prohibited_use', 'sensitivity', 'exclusion', 'review_required', 'real_institution_risk'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sage_application_role AS ENUM (
    'platform_admin',
    'organization_admin',
    'workspace_owner',
    'evidence_steward',
    'evidence_contributor',
    'internal_reviewer',
    'decision_record_approver',
    'privacy_records_reviewer',
    'security_reviewer',
    'accessibility_language_reviewer',
    'read_only_observer',
    'external_reviewer'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sage_export_status AS ENUM ('requested', 'approved', 'denied', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sage_export_authority_level AS ENUM (
    'none', 'request', 'review', 'approve', 'deny', 'platform_emergency_hold'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Workspace (boundary lock) ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sage_workspace (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            text NOT NULL,
  name              text NOT NULL,
  status            sage_workspace_status NOT NULL DEFAULT 'draft',
  institution_type  sage_institution_type NOT NULL,
  risk_surface      sage_risk_surface NOT NULL,
  boundary_profile  jsonb NOT NULL,
  created_by        text NOT NULL,
  updated_by        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sage_workspace_boundary_profile_is_object
    CHECK (jsonb_typeof(boundary_profile) = 'object')
);
CREATE INDEX IF NOT EXISTS sage_workspace_org_idx ON sage_workspace (org_id);
CREATE INDEX IF NOT EXISTS sage_workspace_org_status_idx ON sage_workspace (org_id, status);
CREATE INDEX IF NOT EXISTS sage_workspace_institution_type_idx ON sage_workspace (institution_type);

-- ─── Access model: membership is separate from role assignment ───────────────

CREATE TABLE IF NOT EXISTS sage_workspace_member (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES sage_workspace (id) ON DELETE CASCADE,
  org_id        text NOT NULL,
  actor_id      text NOT NULL,
  created_by    text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sage_workspace_member_unique UNIQUE (workspace_id, actor_id)
);
CREATE INDEX IF NOT EXISTS sage_workspace_member_workspace_idx ON sage_workspace_member (workspace_id);
CREATE INDEX IF NOT EXISTS sage_workspace_member_actor_idx ON sage_workspace_member (actor_id);

CREATE TABLE IF NOT EXISTS sage_stakeholder_profile (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    text NOT NULL,
  actor_id                  text NOT NULL,
  stakeholder_function      text NOT NULL,
  institution_type_context  sage_institution_type,
  created_by                text NOT NULL,
  updated_by                text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sage_stakeholder_profile_unique UNIQUE (org_id, actor_id)
);

-- Role assignment is the enforceable application-permission layer.
-- It requires prior workspace membership (enforced in the service/invariant layer).
CREATE TABLE IF NOT EXISTS sage_role_assignment (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                uuid NOT NULL REFERENCES sage_workspace (id) ON DELETE CASCADE,
  org_id                      text NOT NULL,
  actor_id                    text NOT NULL,
  sage_application_role       sage_application_role NOT NULL,
  workspace_scope             text,
  time_bound_access_expires_at timestamptz,
  access_reason               text,
  approved_by                 text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  revoked_at                  timestamptz
);
CREATE INDEX IF NOT EXISTS sage_role_assignment_workspace_actor_idx
  ON sage_role_assignment (workspace_id, actor_id);
CREATE INDEX IF NOT EXISTS sage_role_assignment_role_idx
  ON sage_role_assignment (sage_application_role);

-- Evidence authorization is separate from the workspace role.
CREATE TABLE IF NOT EXISTS sage_evidence_authorization (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                uuid NOT NULL REFERENCES sage_workspace (id) ON DELETE CASCADE,
  org_id                      text NOT NULL,
  actor_id                    text NOT NULL,
  evidence_authorization_level sage_authorization_level NOT NULL,
  access_reason               text,
  approved_by                 text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  revoked_at                  timestamptz
);
CREATE INDEX IF NOT EXISTS sage_evidence_authorization_workspace_actor_idx
  ON sage_evidence_authorization (workspace_id, actor_id);
CREATE INDEX IF NOT EXISTS sage_evidence_authorization_level_idx
  ON sage_evidence_authorization (evidence_authorization_level);

-- Export: request is not approval; default status is not approved.
CREATE TABLE IF NOT EXISTS sage_export_request (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES sage_workspace (id) ON DELETE CASCADE,
  org_id        text NOT NULL,
  requested_by  text NOT NULL,
  scope         text,
  status        sage_export_status NOT NULL DEFAULT 'requested',
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sage_export_request_workspace_idx ON sage_export_request (workspace_id);
CREATE INDEX IF NOT EXISTS sage_export_request_status_idx ON sage_export_request (status);

-- Approver cannot be requester and external reviewer cannot approve:
-- enforced in the service/invariant layer (cross-table logic, awkward in raw SQL).
CREATE TABLE IF NOT EXISTS sage_export_approval (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_request_id      uuid NOT NULL REFERENCES sage_export_request (id) ON DELETE CASCADE,
  org_id                 text NOT NULL,
  export_authority_level sage_export_authority_level NOT NULL,
  approver_id            text NOT NULL,
  decision               text NOT NULL,
  decision_at            timestamptz NOT NULL DEFAULT now(),
  reason                 text
);
CREATE INDEX IF NOT EXISTS sage_export_approval_request_idx ON sage_export_approval (export_request_id);
CREATE INDEX IF NOT EXISTS sage_export_approval_approver_idx ON sage_export_approval (approver_id);

-- ─── Evidence and decision domain tables ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS sage_evidence_source (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                  uuid NOT NULL REFERENCES sage_workspace (id) ON DELETE CASCADE,
  org_id                        text NOT NULL,
  source_type                   sage_source_type NOT NULL,
  source_quality                sage_source_quality,
  authorization_level           sage_authorization_level NOT NULL,
  contains_personal_information boolean NOT NULL DEFAULT false,
  contains_sensitive_information boolean NOT NULL DEFAULT false,
  created_by                    text NOT NULL,
  created_at                    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sage_evidence_source_workspace_idx ON sage_evidence_source (workspace_id);
CREATE INDEX IF NOT EXISTS sage_evidence_source_workspace_auth_idx
  ON sage_evidence_source (workspace_id, authorization_level);

CREATE TABLE IF NOT EXISTS sage_evidence_item (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id                   uuid NOT NULL REFERENCES sage_evidence_source (id) ON DELETE CASCADE,
  workspace_id                uuid NOT NULL REFERENCES sage_workspace (id) ON DELETE CASCADE,
  org_id                      text NOT NULL,
  lifecycle_state             sage_evidence_lifecycle NOT NULL DEFAULT 'proposed',
  confidence_level            sage_confidence_level,
  excluded_from_external_review boolean NOT NULL DEFAULT false,
  human_review_required       boolean NOT NULL DEFAULT true,
  created_by                  text NOT NULL,
  updated_by                  text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sage_evidence_item_workspace_state_idx
  ON sage_evidence_item (workspace_id, lifecycle_state);
CREATE INDEX IF NOT EXISTS sage_evidence_item_source_idx ON sage_evidence_item (source_id);

CREATE TABLE IF NOT EXISTS sage_boundary_flag (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES sage_workspace (id) ON DELETE CASCADE,
  org_id        text NOT NULL,
  target_id     uuid,
  flag_type     sage_boundary_flag_type NOT NULL,
  note          text,
  created_by    text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sage_boundary_flag_workspace_idx ON sage_boundary_flag (workspace_id);
CREATE INDEX IF NOT EXISTS sage_boundary_flag_target_idx ON sage_boundary_flag (target_id);

-- Decision records require a named human reviewer (NOT NULL human_reviewer_id).
CREATE TABLE IF NOT EXISTS sage_decision_record (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL REFERENCES sage_workspace (id) ON DELETE CASCADE,
  org_id            text NOT NULL,
  decision          text NOT NULL,
  rationale         text,
  human_reviewer_id text NOT NULL,
  created_by        text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sage_decision_record_workspace_idx ON sage_decision_record (workspace_id);

-- Phase 2 TODO: audit persistence integrates via packages/audit (@nzila/audit) using
-- resource='sage_*' and resourceId=<entity id>. No parallel audit table is created here.
