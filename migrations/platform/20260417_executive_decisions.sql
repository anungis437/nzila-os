-- Console 10/10 pass: closed-loop decision table
-- Briefing recommendation -> decision -> initiative linkage.

CREATE TABLE IF NOT EXISTS executive_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  title TEXT NOT NULL,
  rationale TEXT,
  venture_id VARCHAR(64),
  category VARCHAR(32) NOT NULL,
  priority VARCHAR(16) NOT NULL DEFAULT 'p2',
  owner VARCHAR(128),
  due_date DATE,
  status VARCHAR(32) NOT NULL DEFAULT 'proposed',
  linked_initiative_id UUID REFERENCES execution_initiatives(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS executive_decisions_org_status_idx
  ON executive_decisions (org_id, status);

CREATE INDEX IF NOT EXISTS executive_decisions_org_due_idx
  ON executive_decisions (org_id, due_date);

CREATE INDEX IF NOT EXISTS executive_decisions_org_venture_idx
  ON executive_decisions (org_id, venture_id);

CREATE INDEX IF NOT EXISTS executive_decisions_org_created_idx
  ON executive_decisions (org_id, created_at);

ALTER TABLE executive_decisions
  DROP CONSTRAINT IF EXISTS executive_decisions_status_check;

ALTER TABLE executive_decisions
  ADD CONSTRAINT executive_decisions_status_check
  CHECK (status IN ('proposed', 'approved', 'executing', 'done', 'cancelled'));

ALTER TABLE executive_decisions
  DROP CONSTRAINT IF EXISTS executive_decisions_priority_check;

ALTER TABLE executive_decisions
  ADD CONSTRAINT executive_decisions_priority_check
  CHECK (priority IN ('p0', 'p1', 'p2', 'p3'));

ALTER TABLE executive_decisions
  DROP CONSTRAINT IF EXISTS executive_decisions_category_check;

ALTER TABLE executive_decisions
  ADD CONSTRAINT executive_decisions_category_check
  CHECK (category IN ('sales', 'capital', 'hiring', 'product', 'risk'));
