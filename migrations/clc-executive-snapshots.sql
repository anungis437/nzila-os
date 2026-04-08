-- CLC Executive Intelligence — Snapshot Persistence Table
-- Stores point-in-time executive intelligence snapshots for delta comparison.
-- Retention: managed by application (30 per org), not by DB policy.

CREATE TABLE IF NOT EXISTS clc_executive_snapshots (
  id            TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  snapshot_data JSONB NOT NULL,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clc_exec_snap_org_date
  ON clc_executive_snapshots (organization_id, generated_at DESC);
