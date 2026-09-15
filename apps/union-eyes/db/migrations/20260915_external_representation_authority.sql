-- UnionEyes external representation authority foundation.
-- Forward migration only; rollback companion:
-- 20260915_external_representation_authority_rollback.sql

DO $$ BEGIN
  CREATE TYPE representation_authority_status AS ENUM (
    'pending',
    'active',
    'revoked',
    'expired',
    'superseded'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE representation_authority_scope AS ENUM (
    'grievance',
    'wcb_claim'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE external_matter_grant_status AS ENUM (
    'active',
    'revoked',
    'expired'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE external_document_grant_status AS ENUM (
    'active',
    'revoked',
    'expired'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS representation_authorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  matter_type representation_authority_scope NOT NULL,
  matter_id uuid NOT NULL,
  represented_person_id uuid NOT NULL,
  representative_user_id uuid NOT NULL,
  representative_organization_id uuid NOT NULL,
  scope text[] NOT NULL DEFAULT '{}',
  source text NOT NULL DEFAULT 'recorded_authority',
  status representation_authority_status NOT NULL DEFAULT 'pending',
  effective_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  superseded_by_authority_id uuid,
  evidence_document_id uuid REFERENCES documents(id),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT representation_authorities_revoked_status_ck
    CHECK ((revoked_at IS NULL AND status <> 'revoked') OR (revoked_at IS NOT NULL)),
  CONSTRAINT representation_authorities_expiry_ck
    CHECK (expires_at IS NULL OR expires_at > effective_at)
);

CREATE INDEX IF NOT EXISTS idx_representation_authorities_org
  ON representation_authorities(organization_id);
CREATE INDEX IF NOT EXISTS idx_representation_authorities_actor
  ON representation_authorities(representative_user_id);
CREATE INDEX IF NOT EXISTS idx_representation_authorities_specialist_org
  ON representation_authorities(representative_organization_id);
CREATE INDEX IF NOT EXISTS idx_representation_authorities_matter
  ON representation_authorities(organization_id, matter_type, matter_id);
CREATE INDEX IF NOT EXISTS idx_representation_authorities_status
  ON representation_authorities(status);
CREATE INDEX IF NOT EXISTS idx_representation_authorities_expires
  ON representation_authorities(expires_at);

CREATE TABLE IF NOT EXISTS external_matter_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  authority_id uuid NOT NULL REFERENCES representation_authorities(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  matter_type representation_authority_scope NOT NULL,
  matter_id uuid NOT NULL,
  user_id uuid NOT NULL,
  representative_organization_id uuid NOT NULL,
  status external_matter_grant_status NOT NULL DEFAULT 'active',
  can_view boolean NOT NULL DEFAULT true,
  can_comment boolean NOT NULL DEFAULT false,
  can_upload_documents boolean NOT NULL DEFAULT false,
  can_view_documents boolean NOT NULL DEFAULT false,
  can_download_documents boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  granted_by uuid NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT external_matter_grants_revoked_status_ck
    CHECK ((revoked_at IS NULL AND status <> 'revoked') OR (revoked_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_external_matter_grants_authority
  ON external_matter_access_grants(authority_id);
CREATE INDEX IF NOT EXISTS idx_external_matter_grants_org_matter
  ON external_matter_access_grants(organization_id, matter_type, matter_id);
CREATE INDEX IF NOT EXISTS idx_external_matter_grants_user
  ON external_matter_access_grants(user_id);
CREATE INDEX IF NOT EXISTS idx_external_matter_grants_status
  ON external_matter_access_grants(status);

CREATE TABLE IF NOT EXISTS external_document_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  authority_id uuid NOT NULL REFERENCES representation_authorities(id) ON DELETE CASCADE,
  matter_grant_id uuid NOT NULL REFERENCES external_matter_access_grants(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  matter_type representation_authority_scope NOT NULL,
  matter_id uuid NOT NULL,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  representative_organization_id uuid NOT NULL,
  status external_document_grant_status NOT NULL DEFAULT 'active',
  can_view boolean NOT NULL DEFAULT true,
  can_download boolean NOT NULL DEFAULT false,
  can_share boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  granted_by uuid NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT external_document_grants_revoked_status_ck
    CHECK ((revoked_at IS NULL AND status <> 'revoked') OR (revoked_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_external_document_grants_authority
  ON external_document_access_grants(authority_id);
CREATE INDEX IF NOT EXISTS idx_external_document_grants_matter_grant
  ON external_document_access_grants(matter_grant_id);
CREATE INDEX IF NOT EXISTS idx_external_document_grants_document
  ON external_document_access_grants(document_id);
CREATE INDEX IF NOT EXISTS idx_external_document_grants_user
  ON external_document_access_grants(user_id);
CREATE INDEX IF NOT EXISTS idx_external_document_grants_org_matter
  ON external_document_access_grants(organization_id, matter_type, matter_id);
CREATE INDEX IF NOT EXISTS idx_external_document_grants_status
  ON external_document_access_grants(status);

ALTER TABLE grievance_deadlines
  ADD COLUMN IF NOT EXISTS confirmation_status text NOT NULL DEFAULT 'SYSTEM_CALCULATED',
  ADD COLUMN IF NOT EXISTS calculated_due_date timestamptz,
  ADD COLUMN IF NOT EXISTS calculation_provenance jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS override_due_date timestamptz,
  ADD COLUMN IF NOT EXISTS override_reason text,
  ADD COLUMN IF NOT EXISTS override_at timestamptz,
  ADD COLUMN IF NOT EXISTS override_by uuid,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
  ADD COLUMN IF NOT EXISTS superseded_by uuid;

UPDATE grievance_deadlines
  SET calculated_due_date = due_date
  WHERE calculated_due_date IS NULL;

ALTER TABLE grievance_deadlines
  ADD CONSTRAINT grievance_deadlines_confirmation_status_ck
  CHECK (confirmation_status IN ('SYSTEM_CALCULATED', 'HUMAN_CONFIRMED', 'OVERRIDDEN', 'SUPERSEDED'));

CREATE INDEX IF NOT EXISTS idx_grievance_deadlines_confirmation_status
  ON grievance_deadlines(confirmation_status);
