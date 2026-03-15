-- Pilot enrollment and milestones tables
-- Required by /api/pilot/current endpoint

CREATE TABLE IF NOT EXISTS pilot_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  pilot_id VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enrolled_by VARCHAR(255),
  organizer_adoption_rate REAL NOT NULL DEFAULT 0,
  member_engagement_rate REAL NOT NULL DEFAULT 0,
  cases_managed INTEGER NOT NULL DEFAULT 0,
  avg_time_to_resolution REAL NOT NULL DEFAULT 0,
  health_score REAL NOT NULL DEFAULT 0,
  last_calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pilot_enrollments_org
  ON pilot_enrollments (organization_id);

CREATE TABLE IF NOT EXISTS pilot_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  target_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pilot_milestones_org
  ON pilot_milestones (organization_id);
