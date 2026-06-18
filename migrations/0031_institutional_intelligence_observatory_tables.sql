-- Migration 0031: Institutional Intelligence Observatory persistence tables
-- Purpose: persist pilot and cohort data for live market validation.

-- Enums
DO $$ BEGIN
  CREATE TYPE ii_observatory_sector AS ENUM (
    'labour',
    'healthcare',
    'municipal',
    'association',
    'smb',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ii_observatory_route AS ENUM (
    'iia_first',
    'ue_first',
    'hybrid_iia_ue',
    'trustcore_route',
    'defer'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ii_observatory_maturity AS ENUM (
    'level1',
    'level2',
    'level3',
    'level4',
    'level5'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ii_observatory_confidence AS ENUM (
    'low',
    'medium',
    'high'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ii_observatory_dimension AS ENUM (
    'memory_integrity',
    'continuity_capacity',
    'governance_maturity',
    'trust_operations',
    'accountability_architecture',
    'institutional_resilience'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ii_observatory_consent_class AS ENUM (
    'c0_operational_only',
    'c1_anonymous_benchmark',
    'c2_anonymized_case_study',
    'c3_attributed_publication'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ii_observatory_publication_class AS ENUM (
    'p0_no_publication',
    'p1_private_client_reporting',
    'p2_public_anonymized_benchmark',
    'p3_public_anonymized_case_study',
    'p4_public_attributed_case_study'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1) organizations profile for observatory analytics (de-identified layer)
CREATE TABLE IF NOT EXISTS ii_observatory_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  org_alias TEXT NOT NULL UNIQUE,
  sector ii_observatory_sector NOT NULL,
  sub_sector TEXT,
  size_band TEXT NOT NULL,
  federation_status TEXT,
  geography_region TEXT NOT NULL,
  country_code CHAR(2) NOT NULL,
  first_engagement_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ii_obs_org_sector ON ii_observatory_organizations(sector);
CREATE INDEX IF NOT EXISTS idx_ii_obs_org_size_band ON ii_observatory_organizations(size_band);

-- 2) engagements
CREATE TABLE IF NOT EXISTS ii_observatory_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observatory_organization_id UUID NOT NULL REFERENCES ii_observatory_organizations(id) ON DELETE CASCADE,
  route_entry_type ii_observatory_route NOT NULL,
  delivery_mode TEXT NOT NULL,
  engagement_start_date DATE NOT NULL,
  engagement_end_date DATE,
  category_resonance_score INTEGER CHECK (category_resonance_score BETWEEN 0 AND 5),
  executive_sponsor_present BOOLEAN NOT NULL DEFAULT false,
  participant_count INTEGER NOT NULL DEFAULT 0,
  evidence_confidence_overall ii_observatory_confidence NOT NULL,
  case_study_opt_in BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ii_obs_eng_org ON ii_observatory_engagements(observatory_organization_id);
CREATE INDEX IF NOT EXISTS idx_ii_obs_eng_route ON ii_observatory_engagements(route_entry_type);

-- 3) assessments
CREATE TABLE IF NOT EXISTS ii_observatory_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID NOT NULL REFERENCES ii_observatory_engagements(id) ON DELETE CASCADE,
  assessment_date DATE NOT NULL,
  iia_composite_score INTEGER NOT NULL CHECK (iia_composite_score BETWEEN 0 AND 24),
  maturity_level ii_observatory_maturity NOT NULL,
  primary_risk_dimensions JSONB NOT NULL DEFAULT '[]'::jsonb,
  top_priority_count INTEGER NOT NULL DEFAULT 0,
  reassessment_due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ii_obs_assessment_eng ON ii_observatory_assessments(engagement_id);
CREATE INDEX IF NOT EXISTS idx_ii_obs_assessment_maturity ON ii_observatory_assessments(maturity_level);

-- 4) dimension scores
CREATE TABLE IF NOT EXISTS ii_observatory_dimension_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES ii_observatory_assessments(id) ON DELETE CASCADE,
  dimension_name ii_observatory_dimension NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 4),
  consequence_level TEXT NOT NULL,
  urgency_level TEXT NOT NULL,
  evidence_confidence ii_observatory_confidence NOT NULL,
  evidence_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, dimension_name)
);

CREATE INDEX IF NOT EXISTS idx_ii_obs_dim_assessment ON ii_observatory_dimension_scores(assessment_id);

-- 5) route decisions
CREATE TABLE IF NOT EXISTS ii_observatory_route_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID NOT NULL UNIQUE REFERENCES ii_observatory_engagements(id) ON DELETE CASCADE,
  iia_route_score INTEGER NOT NULL DEFAULT 0,
  ue_route_score INTEGER NOT NULL DEFAULT 0,
  trustcore_route_score INTEGER NOT NULL DEFAULT 0,
  selected_route ii_observatory_route NOT NULL,
  route_confidence ii_observatory_confidence NOT NULL DEFAULT 'medium',
  route_rationale TEXT NOT NULL,
  override_used BOOLEAN NOT NULL DEFAULT false,
  override_approval TEXT,
  decision_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ii_obs_route_selected ON ii_observatory_route_decisions(selected_route);

-- 6) reassessments
CREATE TABLE IF NOT EXISTS ii_observatory_reassessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observatory_organization_id UUID NOT NULL REFERENCES ii_observatory_organizations(id) ON DELETE CASCADE,
  prior_assessment_id UUID NOT NULL REFERENCES ii_observatory_assessments(id) ON DELETE CASCADE,
  current_assessment_id UUID NOT NULL REFERENCES ii_observatory_assessments(id) ON DELETE CASCADE,
  delta_composite INTEGER NOT NULL,
  delta_level INTEGER NOT NULL,
  improved_dimensions JSONB NOT NULL DEFAULT '[]'::jsonb,
  regressed_dimensions JSONB NOT NULL DEFAULT '[]'::jsonb,
  reassessment_interval_days INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (prior_assessment_id, current_assessment_id)
);

CREATE INDEX IF NOT EXISTS idx_ii_obs_reassess_org ON ii_observatory_reassessments(observatory_organization_id);

-- 7) consent profiles
CREATE TABLE IF NOT EXISTS ii_observatory_consent_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observatory_organization_id UUID NOT NULL UNIQUE REFERENCES ii_observatory_organizations(id) ON DELETE CASCADE,
  consent_class ii_observatory_consent_class NOT NULL,
  publication_class ii_observatory_publication_class NOT NULL,
  benchmark_use_consent BOOLEAN NOT NULL DEFAULT false,
  quote_use_consent BOOLEAN NOT NULL DEFAULT false,
  attributed_quote_consent BOOLEAN NOT NULL DEFAULT false,
  case_study_publication_consent BOOLEAN NOT NULL DEFAULT false,
  consent_effective_date DATE NOT NULL,
  consent_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ii_obs_consent_class ON ii_observatory_consent_profiles(consent_class);

-- 8) benchmark cohorts / publication eligibility snapshots
CREATE TABLE IF NOT EXISTS ii_observatory_benchmark_cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_key TEXT NOT NULL,
  sector ii_observatory_sector,
  size_band TEXT,
  geography_region TEXT,
  publication_window TEXT NOT NULL,
  cohort_count INTEGER NOT NULL DEFAULT 0,
  k_anonymity_threshold INTEGER NOT NULL DEFAULT 25,
  eligible_for_public_reporting BOOLEAN NOT NULL DEFAULT false,
  exclusion_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cohort_key, publication_window)
);

CREATE INDEX IF NOT EXISTS idx_ii_obs_cohort_eligible ON ii_observatory_benchmark_cohorts(eligible_for_public_reporting);
CREATE INDEX IF NOT EXISTS idx_ii_obs_cohort_window ON ii_observatory_benchmark_cohorts(publication_window);
