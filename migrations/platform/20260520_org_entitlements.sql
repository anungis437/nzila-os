-- Migration: 20260520_org_entitlements
-- Watch 3 — Control Plane entitlement DB adapter.
--
-- Creates the durable per-org feature entitlement ledger that the
-- Control Plane reads when CONTROL_PLANE_ENTITLEMENT_SOURCE=db. Until
-- this table is populated for an org, the resolver falls back to the
-- conservative stub allow-list.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'entitlement_tier') THEN
    CREATE TYPE entitlement_tier AS ENUM (
      'free',
      'standard',
      'professional',
      'enterprise'
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS org_entitlements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  feature     TEXT NOT NULL,
  tier        entitlement_tier NOT NULL DEFAULT 'standard',
  "limit"     INTEGER,
  expires_at  TIMESTAMPTZ,
  source      TEXT NOT NULL DEFAULT 'manual',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS org_entitlements_org_feature_uidx
  ON org_entitlements (org_id, feature);

CREATE INDEX IF NOT EXISTS org_entitlements_org_idx
  ON org_entitlements (org_id);

CREATE INDEX IF NOT EXISTS org_entitlements_expires_idx
  ON org_entitlements (expires_at);
