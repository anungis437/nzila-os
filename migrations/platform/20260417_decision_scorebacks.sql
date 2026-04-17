-- Console final ascent: decision scoreback table
-- Tracks expected vs actual outcome quality for executive decisions.

CREATE TABLE IF NOT EXISTS decision_scorebacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  decision_id UUID NOT NULL REFERENCES executive_decisions(id),
  expected_result TEXT NOT NULL,
  expected_roi_pct REAL,
  expected_by_date DATE,
  actual_result TEXT,
  actual_roi_pct REAL,
  outcome_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  accuracy_score REAL,
  confidence_at_decision REAL,
  evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS decision_scorebacks_org_status_idx
  ON decision_scorebacks (org_id, outcome_status);

CREATE INDEX IF NOT EXISTS decision_scorebacks_org_evaluated_idx
  ON decision_scorebacks (org_id, evaluated_at);

CREATE UNIQUE INDEX IF NOT EXISTS decision_scorebacks_org_decision_idx
  ON decision_scorebacks (org_id, decision_id);

ALTER TABLE decision_scorebacks
  DROP CONSTRAINT IF EXISTS decision_scorebacks_outcome_status_check;

ALTER TABLE decision_scorebacks
  ADD CONSTRAINT decision_scorebacks_outcome_status_check
  CHECK (outcome_status IN ('pending', 'on-track', 'exceeded', 'missed', 'cancelled'));
