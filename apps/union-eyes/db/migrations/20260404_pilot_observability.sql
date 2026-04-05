-- Pilot observability & feedback tables
-- Lightweight event tracking for CUPE pilot usage metrics

-- Pilot Events: tracks user actions for engagement measurement
CREATE TABLE IF NOT EXISTS pilot_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(100) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pilot_events_org ON pilot_events (organization_id);
CREATE INDEX IF NOT EXISTS idx_pilot_events_user ON pilot_events (user_id);
CREATE INDEX IF NOT EXISTS idx_pilot_events_type ON pilot_events (event_type);
CREATE INDEX IF NOT EXISTS idx_pilot_events_session ON pilot_events (session_id);
CREATE INDEX IF NOT EXISTS idx_pilot_events_created ON pilot_events (created_at);

-- Pilot Feedback: in-app feedback capture
CREATE TABLE IF NOT EXISTS pilot_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  ease_rating INTEGER NOT NULL,
  category VARCHAR(50),
  comment TEXT,
  trigger VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pilot_feedback_org ON pilot_feedback (organization_id);
CREATE INDEX IF NOT EXISTS idx_pilot_feedback_user ON pilot_feedback (user_id);
CREATE INDEX IF NOT EXISTS idx_pilot_feedback_created ON pilot_feedback (created_at);
