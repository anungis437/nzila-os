-- ICRA tables (manual bootstrap — icra-schema is not in the drizzle-kit cache barrel)
-- Safe to re-run.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS icra_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name varchar(255),
  sector varchar(64),
  jurisdiction varchar(64),
  workforce_band varchar(32),
  governance_model varchar(32),
  federation_affiliation varchar(255),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS icra_orgs_sector_idx ON icra_organizations (sector);

CREATE TABLE IF NOT EXISTS icra_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES icra_organizations(id) ON DELETE SET NULL,
  status varchar(16) NOT NULL DEFAULT 'in_progress',
  question_bank_version integer NOT NULL DEFAULT 1,
  doctrine_version varchar(16) NOT NULL DEFAULT '1.0.0',
  consent jsonb,
  organization_context jsonb,
  locale varchar(16) NOT NULL DEFAULT 'en-CA',
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  report_tier_id varchar(64) NOT NULL DEFAULT 'continuity_reflection',
  utm_source varchar(128),
  utm_medium varchar(128),
  utm_campaign varchar(128)
);
CREATE INDEX IF NOT EXISTS icra_assessments_status_idx ON icra_assessments (status);
CREATE INDEX IF NOT EXISTS icra_assessments_created_idx ON icra_assessments (created_at);

CREATE TABLE IF NOT EXISTS icra_assessment_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES icra_assessments(id) ON DELETE CASCADE,
  question_id varchar(64) NOT NULL,
  question_version integer NOT NULL DEFAULT 1,
  raw_value text NOT NULL,
  normalized_score numeric(6,4) NOT NULL,
  weights_snapshot jsonb NOT NULL,
  risk_inverted boolean NOT NULL DEFAULT false,
  note text,
  answered_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS icra_answers_assessment_idx ON icra_assessment_answers (assessment_id);
CREATE INDEX IF NOT EXISTS icra_answers_question_idx ON icra_assessment_answers (question_id);

CREATE TABLE IF NOT EXISTS icra_maturity_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES icra_assessments(id) ON DELETE CASCADE,
  maturity_band_id varchar(64) NOT NULL,
  composite numeric(5,2) NOT NULL,
  profile_payload jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS icra_profiles_assessment_idx ON icra_maturity_profiles (assessment_id);
CREATE INDEX IF NOT EXISTS icra_profiles_band_idx ON icra_maturity_profiles (maturity_band_id);

CREATE TABLE IF NOT EXISTS icra_continuity_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES icra_assessments(id) ON DELETE CASCADE,
  dimension_id varchar(64) NOT NULL,
  score numeric(5,2) NOT NULL,
  contributing_questions integer NOT NULL,
  weight_total numeric(6,3) NOT NULL
);
CREATE INDEX IF NOT EXISTS icra_scores_assessment_idx ON icra_continuity_scores (assessment_id);
CREATE INDEX IF NOT EXISTS icra_scores_dimension_idx ON icra_continuity_scores (dimension_id);

CREATE TABLE IF NOT EXISTS icra_governance_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES icra_assessments(id) ON DELETE CASCADE,
  flag_id varchar(64) NOT NULL,
  severity varchar(16) NOT NULL,
  category varchar(32) NOT NULL,
  statement text NOT NULL,
  evidence jsonb
);
CREATE INDEX IF NOT EXISTS icra_flags_assessment_idx ON icra_governance_flags (assessment_id);
CREATE INDEX IF NOT EXISTS icra_flags_severity_idx ON icra_governance_flags (severity);

CREATE TABLE IF NOT EXISTS icra_operational_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES icra_assessments(id) ON DELETE CASCADE,
  indicator_id varchar(64) NOT NULL,
  value numeric(8,3),
  payload jsonb,
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS icra_indicators_assessment_idx ON icra_operational_indicators (assessment_id);

CREATE TABLE IF NOT EXISTS icra_followup_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES icra_assessments(id) ON DELETE CASCADE,
  recommendation_id varchar(64) NOT NULL,
  kind varchar(64) NOT NULL,
  title varchar(256) NOT NULL,
  description text NOT NULL,
  cta_label varchar(128) NOT NULL,
  cta_href varchar(512) NOT NULL
);
CREATE INDEX IF NOT EXISTS icra_recos_assessment_idx ON icra_followup_recommendations (assessment_id);

CREATE TABLE IF NOT EXISTS icra_benchmark_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(64) NOT NULL UNIQUE,
  name varchar(255) NOT NULL,
  description text,
  sector varchar(64),
  jurisdiction varchar(64),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS icra_anonymized_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  benchmark_group_id uuid REFERENCES icra_benchmark_groups(id) ON DELETE SET NULL,
  dimension_id varchar(64) NOT NULL,
  metric_key varchar(64) NOT NULL,
  value numeric(8,3) NOT NULL,
  sample_size integer NOT NULL DEFAULT 0,
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS icra_metrics_group_idx ON icra_anonymized_metrics (benchmark_group_id);
CREATE INDEX IF NOT EXISTS icra_metrics_dimension_idx ON icra_anonymized_metrics (dimension_id);
