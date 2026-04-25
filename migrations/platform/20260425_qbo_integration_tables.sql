-- Console finance integration: QBO sync compatibility migration
-- Handles both clean installs and legacy qbo_* table layouts.

-- ── Enums ────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'qbo_sync_status') THEN
    CREATE TYPE qbo_sync_status AS ENUM ('pending', 'running', 'completed', 'failed');
  ELSE
    ALTER TYPE qbo_sync_status ADD VALUE IF NOT EXISTS 'pending';
    ALTER TYPE qbo_sync_status ADD VALUE IF NOT EXISTS 'running';
    ALTER TYPE qbo_sync_status ADD VALUE IF NOT EXISTS 'completed';
    ALTER TYPE qbo_sync_status ADD VALUE IF NOT EXISTS 'failed';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'qbo_report_type') THEN
    CREATE TYPE qbo_report_type AS ENUM (
      'trial_balance',
      'profit_and_loss',
      'balance_sheet',
      'cash_flow',
      'aging_receivable',
      'aging_payable',
      'general_ledger'
    );
  ELSE
    ALTER TYPE qbo_report_type ADD VALUE IF NOT EXISTS 'trial_balance';
    ALTER TYPE qbo_report_type ADD VALUE IF NOT EXISTS 'profit_and_loss';
    ALTER TYPE qbo_report_type ADD VALUE IF NOT EXISTS 'balance_sheet';
    ALTER TYPE qbo_report_type ADD VALUE IF NOT EXISTS 'cash_flow';
    ALTER TYPE qbo_report_type ADD VALUE IF NOT EXISTS 'aging_receivable';
    ALTER TYPE qbo_report_type ADD VALUE IF NOT EXISTS 'aging_payable';
    ALTER TYPE qbo_report_type ADD VALUE IF NOT EXISTS 'general_ledger';
  END IF;
END$$;

-- ── Connections ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS qbo_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  realm_id TEXT NOT NULL,
  company_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  connected_by TEXT NOT NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disconnected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE qbo_connections
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

UPDATE qbo_connections
SET is_active = true
WHERE is_active IS NULL;

CREATE INDEX IF NOT EXISTS qbo_connections_org_active_connected_idx
  ON qbo_connections (org_id, is_active, connected_at);

-- ── Tokens ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS qbo_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES qbo_connections(id),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  access_token_expires_at TIMESTAMPTZ NOT NULL,
  refresh_token_expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE qbo_tokens
  ADD COLUMN IF NOT EXISTS access_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refresh_token_expires_at TIMESTAMPTZ;

UPDATE qbo_tokens
SET access_token_expires_at = COALESCE(access_token_expires_at, expires_at, now() + interval '1 hour')
WHERE access_token_expires_at IS NULL;

UPDATE qbo_tokens
SET refresh_token_expires_at = COALESCE(refresh_token_expires_at, expires_at, now() + interval '90 days')
WHERE refresh_token_expires_at IS NULL;

UPDATE qbo_tokens
SET refresh_token = ''
WHERE refresh_token IS NULL;

ALTER TABLE qbo_tokens
  ALTER COLUMN access_token_expires_at SET NOT NULL,
  ALTER COLUMN refresh_token_expires_at SET NOT NULL,
  ALTER COLUMN refresh_token SET NOT NULL;

CREATE INDEX IF NOT EXISTS qbo_tokens_connection_created_idx
  ON qbo_tokens (connection_id, created_at);

-- ── Sync runs ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS qbo_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  connection_id UUID NOT NULL REFERENCES qbo_connections(id),
  report_type qbo_report_type NOT NULL,
  period_start DATE,
  period_end DATE,
  status qbo_sync_status NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE qbo_sync_runs
  ADD COLUMN IF NOT EXISTS report_type qbo_report_type,
  ADD COLUMN IF NOT EXISTS period_start DATE,
  ADD COLUMN IF NOT EXISTS period_end DATE,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

UPDATE qbo_sync_runs
SET completed_at = finished_at
WHERE completed_at IS NULL
  AND finished_at IS NOT NULL;

UPDATE qbo_sync_runs
SET error_message = error
WHERE error_message IS NULL
  AND error IS NOT NULL;

UPDATE qbo_sync_runs
SET report_type = 'trial_balance'::qbo_report_type
WHERE report_type IS NULL;

UPDATE qbo_sync_runs
SET status = 'running'::qbo_sync_status
WHERE status = 'started'::qbo_sync_status;

UPDATE qbo_sync_runs
SET status = 'completed'::qbo_sync_status
WHERE status = 'success'::qbo_sync_status;

ALTER TABLE qbo_sync_runs
  ALTER COLUMN report_type SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS qbo_sync_runs_org_completed_idx
  ON qbo_sync_runs (org_id, completed_at);

CREATE INDEX IF NOT EXISTS qbo_sync_runs_connection_created_idx
  ON qbo_sync_runs (connection_id, created_at);

-- ── Reports ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS qbo_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  sync_run_id UUID NOT NULL REFERENCES qbo_sync_runs(id),
  report_type qbo_report_type NOT NULL,
  period_start DATE,
  period_end DATE,
  document_id UUID NOT NULL,
  sha256 TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE qbo_reports
  ADD COLUMN IF NOT EXISTS sha256 TEXT,
  ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ;

UPDATE qbo_reports
SET sha256 = COALESCE(sha256, checksum, '')
WHERE sha256 IS NULL;

UPDATE qbo_reports
SET fetched_at = COALESCE(fetched_at, generated_at, created_at, now())
WHERE fetched_at IS NULL;

ALTER TABLE qbo_reports
  ALTER COLUMN period_start DROP NOT NULL,
  ALTER COLUMN period_end DROP NOT NULL,
  ALTER COLUMN sha256 SET NOT NULL,
  ALTER COLUMN fetched_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS qbo_reports_org_fetched_idx
  ON qbo_reports (org_id, fetched_at);

CREATE INDEX IF NOT EXISTS qbo_reports_sync_run_idx
  ON qbo_reports (sync_run_id);

