-- Console payments compatibility: stripe_connections
-- Reconciles legacy stripe_connections schema to current app expectations.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stripe_connection_status') THEN
    CREATE TYPE stripe_connection_status AS ENUM ('connected', 'error');
  ELSE
    ALTER TYPE stripe_connection_status ADD VALUE IF NOT EXISTS 'connected';
    ALTER TYPE stripe_connection_status ADD VALUE IF NOT EXISTS 'error';
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS stripe_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  account_id TEXT NOT NULL,
  livemode BOOLEAN NOT NULL DEFAULT false,
  status stripe_connection_status NOT NULL DEFAULT 'connected',
  connected_by TEXT NOT NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_event_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE stripe_connections
  ADD COLUMN IF NOT EXISTS account_id TEXT,
  ADD COLUMN IF NOT EXISTS livemode BOOLEAN,
  ADD COLUMN IF NOT EXISTS connected_by TEXT,
  ADD COLUMN IF NOT EXISTS last_event_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE stripe_connections
SET account_id = stripe_account_id
WHERE account_id IS NULL
  AND stripe_account_id IS NOT NULL;

UPDATE stripe_connections
SET livemode = false
WHERE livemode IS NULL;

UPDATE stripe_connections
SET connected_by = 'system_migrated'
WHERE connected_by IS NULL OR btrim(connected_by) = '';

UPDATE stripe_connections
SET connected_at = COALESCE(connected_at, created_at, now())
WHERE connected_at IS NULL;

UPDATE stripe_connections
SET created_at = COALESCE(created_at, connected_at, now())
WHERE created_at IS NULL;

UPDATE stripe_connections
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

UPDATE stripe_connections
SET status = 'connected'::stripe_connection_status
WHERE status = 'active'::stripe_connection_status;

UPDATE stripe_connections
SET status = 'error'::stripe_connection_status
WHERE status = 'revoked'::stripe_connection_status;

ALTER TABLE stripe_connections
  ALTER COLUMN account_id SET NOT NULL,
  ALTER COLUMN livemode SET NOT NULL,
  ALTER COLUMN livemode SET DEFAULT false,
  ALTER COLUMN connected_by SET NOT NULL,
  ALTER COLUMN connected_at SET NOT NULL,
  ALTER COLUMN connected_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN status SET DEFAULT 'connected';

CREATE INDEX IF NOT EXISTS stripe_connections_org_updated_idx
  ON stripe_connections (org_id, updated_at DESC);
