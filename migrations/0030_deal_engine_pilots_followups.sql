-- Deal Engine: pilots + follow-ups tables
-- These are Deal Engine-native concepts, not mirrored from other apps.

CREATE TABLE IF NOT EXISTS deal_engine_pilots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id VARCHAR(255) NOT NULL,
  account_id VARCHAR(255) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  product VARCHAR(50) NOT NULL,
  pilot_status VARCHAR(30) NOT NULL DEFAULT 'proposed',
  success_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
  start_date TIMESTAMPTZ,
  target_review_date TIMESTAMPTZ,
  owner VARCHAR(255) NOT NULL,
  ingestion_status VARCHAR(30),
  checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_blockers JSONB NOT NULL DEFAULT '[]'::jsonb,
  days_active INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_de_pilots_deal ON deal_engine_pilots(deal_id);
CREATE INDEX IF NOT EXISTS idx_de_pilots_status ON deal_engine_pilots(pilot_status);

CREATE TABLE IF NOT EXISTS deal_engine_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id VARCHAR(255),
  pilot_id VARCHAR(255),
  account_name VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  owner VARCHAR(255) NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  due_date TIMESTAMPTZ NOT NULL,
  is_overdue BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  trigger VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_de_followups_owner ON deal_engine_follow_ups(owner);
CREATE INDEX IF NOT EXISTS idx_de_followups_due ON deal_engine_follow_ups(due_date);
