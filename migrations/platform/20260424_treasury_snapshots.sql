-- Console executive intelligence: treasury snapshots
-- Adds the missing backing table used by finance-spine and autopilot data paths.

CREATE TABLE IF NOT EXISTS treasury_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  date TIMESTAMPTZ NOT NULL,
  cash_on_hand NUMERIC(18, 2) NOT NULL DEFAULT 0,
  restricted_cash NUMERIC(18, 2) NOT NULL DEFAULT 0,
  receivables NUMERIC(18, 2) NOT NULL DEFAULT 0,
  liabilities_due_30d NUMERIC(18, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS treasury_snapshots_org_date_idx
  ON treasury_snapshots (org_id, date);
