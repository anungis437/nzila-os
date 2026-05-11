-- Migration 0023: TrustCore Risk Register v1
-- Adds trustcore_risks, trustcore_risk_reviews, and trustcore_risk_mitigations tables.
-- These tables back the Risk Register feature in the TrustCore privacy compliance app.

-- ── Enums ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE tc_risk_register_category AS ENUM (
    'governance',
    'data',
    'pia',
    'incidents',
    'dsr',
    'vendors',
    'security',
    'operational',
    'legal',
    'financial'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tc_risk_register_severity AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tc_risk_register_status AS ENUM (
    'open',
    'mitigating',
    'accepted',
    'transferred',
    'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tc_risk_mitigation_status AS ENUM (
    'planned',
    'in_progress',
    'completed',
    'blocked'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── trustcore_risks ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trustcore_risks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES orgs(id),
  title        TEXT NOT NULL,
  description  TEXT,
  category     tc_risk_register_category NOT NULL,
  severity     tc_risk_register_severity NOT NULL,
  status       tc_risk_register_status   NOT NULL DEFAULT 'open',
  owner        TEXT,
  due_at       TIMESTAMPTZ,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tc_risks_org_idx          ON trustcore_risks(org_id);
CREATE INDEX IF NOT EXISTS tc_risks_org_status_idx   ON trustcore_risks(org_id, status);
CREATE INDEX IF NOT EXISTS tc_risks_org_severity_idx ON trustcore_risks(org_id, severity);
CREATE INDEX IF NOT EXISTS tc_risks_org_category_idx ON trustcore_risks(org_id, category);

-- ── trustcore_risk_reviews ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trustcore_risk_reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES orgs(id),
  risk_id       UUID NOT NULL REFERENCES trustcore_risks(id) ON DELETE CASCADE,
  reviewer_name TEXT NOT NULL,
  decision      TEXT NOT NULL,
  notes         TEXT,
  reviewed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tc_risk_reviews_org_idx  ON trustcore_risk_reviews(org_id);
CREATE INDEX IF NOT EXISTS tc_risk_reviews_risk_idx ON trustcore_risk_reviews(risk_id);

-- ── trustcore_risk_mitigations ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trustcore_risk_mitigations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES orgs(id),
  risk_id      UUID NOT NULL REFERENCES trustcore_risks(id) ON DELETE CASCADE,
  action       TEXT NOT NULL,
  owner        TEXT,
  due_at       TIMESTAMPTZ,
  status       tc_risk_mitigation_status NOT NULL DEFAULT 'planned',
  completed_at TIMESTAMPTZ,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tc_risk_mitigations_org_idx        ON trustcore_risk_mitigations(org_id);
CREATE INDEX IF NOT EXISTS tc_risk_mitigations_risk_idx       ON trustcore_risk_mitigations(risk_id);
CREATE INDEX IF NOT EXISTS tc_risk_mitigations_org_status_idx ON trustcore_risk_mitigations(org_id, status);
