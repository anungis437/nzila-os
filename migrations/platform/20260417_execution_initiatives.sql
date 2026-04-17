-- Console Phase 2: execution initiatives backing table
-- Enables live weekly execution actions in /execution and /today.

CREATE TABLE IF NOT EXISTS execution_initiatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  title TEXT NOT NULL,
  venture VARCHAR(64),
  zone VARCHAR(32),
  owner VARCHAR(128),
  due_date DATE,
  status VARCHAR(32) NOT NULL DEFAULT 'not-started',
  urgent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS execution_initiatives_org_status_idx
  ON execution_initiatives (org_id, status);

CREATE INDEX IF NOT EXISTS execution_initiatives_org_due_idx
  ON execution_initiatives (org_id, due_date);

CREATE INDEX IF NOT EXISTS execution_initiatives_org_zone_idx
  ON execution_initiatives (org_id, zone);

ALTER TABLE execution_initiatives
  DROP CONSTRAINT IF EXISTS execution_initiatives_status_check;

ALTER TABLE execution_initiatives
  ADD CONSTRAINT execution_initiatives_status_check
  CHECK (status IN ('not-started', 'in-progress', 'done'));
