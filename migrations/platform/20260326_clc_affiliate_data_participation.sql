-- CLC Intelligence: DB-backed affiliate data participation (consent) registry
-- Replaces in-memory _participationRegistry with persistent storage
-- Related: lib/clc/governance.ts

CREATE TABLE IF NOT EXISTS affiliate_data_participation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  organization_name TEXT NOT NULL,

  -- Opt-in dimensions (independently toggleable)
  participates_in_cross_union_analytics BOOLEAN NOT NULL DEFAULT false,
  participates_in_sector_benchmarks     BOOLEAN NOT NULL DEFAULT false,
  participates_in_national_signals      BOOLEAN NOT NULL DEFAULT false,

  -- Consent lifecycle
  effective_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at     TIMESTAMPTZ,
  restrictions   TEXT,
  consent_source TEXT NOT NULL CHECK (consent_source IN (
    'affiliate_admin', 'federation_admin', 'clc_agreement', 'system_migration'
  )),

  -- Audit metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID,

  -- Prevent duplicate active records per org
  CONSTRAINT uq_active_participation UNIQUE (organization_id) WHERE (revoked_at IS NULL)
);

-- Index for fast lookups by dimension
CREATE INDEX IF NOT EXISTS idx_adp_cross_union
  ON affiliate_data_participation (organization_id)
  WHERE participates_in_cross_union_analytics = true AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_adp_sector
  ON affiliate_data_participation (organization_id)
  WHERE participates_in_sector_benchmarks = true AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_adp_national
  ON affiliate_data_participation (organization_id)
  WHERE participates_in_national_signals = true AND revoked_at IS NULL;

-- RLS policy: only org admins can modify their own participation
ALTER TABLE affiliate_data_participation ENABLE ROW LEVEL SECURITY;

CREATE POLICY adp_read_policy ON affiliate_data_participation
  FOR SELECT USING (true);

CREATE POLICY adp_write_policy ON affiliate_data_participation
  FOR ALL USING (
    organization_id = current_setting('app.organization_id', true)::uuid
  );
