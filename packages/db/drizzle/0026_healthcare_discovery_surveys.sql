-- 0026_healthcare_discovery_surveys.sql
-- Healthcare Discovery Surveys core schema (first Nzila Healthcare discovery seed)

CREATE TYPE healthcare_survey_status AS ENUM ('draft', 'active', 'closed', 'archived');
CREATE TYPE healthcare_survey_review_status AS ENUM ('unreviewed', 'reviewed', 'flagged_for_redaction');
CREATE TYPE healthcare_survey_insight_type AS ENUM ('top_pain_point', 'top_workflow', 'adoption_concern', 'evidence_gap', 'pilot_recommendation', 'privacy_risk', 'other');
CREATE TYPE healthcare_survey_confidence AS ENUM ('low', 'medium', 'high');

CREATE TABLE healthcare_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES orgs(id),
  campaign_key text,
  campaign_name text,
  unit_name text NOT NULL,
  site_name text,
  local_name text NOT NULL,
  champion_label text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  audience text,
  status healthcare_survey_status NOT NULL DEFAULT 'draft',
  anonymous boolean NOT NULL DEFAULT true,
  allow_free_text boolean NOT NULL DEFAULT true,
  purpose_statement text NOT NULL,
  privacy_notice text NOT NULL,
  internal_notes text,
  distribution_message text,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  template_key text NOT NULL DEFAULT 'unit-scheduling',
  share_token varchar(128),
  launch_date timestamptz,
  close_date timestamptz,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX healthcare_surveys_campaign_key_uidx ON healthcare_surveys(campaign_key);
CREATE UNIQUE INDEX healthcare_surveys_share_token_uidx ON healthcare_surveys(share_token);
CREATE INDEX healthcare_surveys_org_idx ON healthcare_surveys(org_id);
CREATE INDEX healthcare_surveys_status_idx ON healthcare_surveys(status);

CREATE TABLE healthcare_survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES healthcare_surveys(id) ON DELETE CASCADE,
  anonymous_response_id uuid NOT NULL DEFAULT gen_random_uuid(),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  workflow_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  top_priority text,
  concern_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  contains_free_text boolean NOT NULL DEFAULT false,
  review_status healthcare_survey_review_status NOT NULL DEFAULT 'unreviewed',
  redaction_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX healthcare_survey_responses_survey_idx ON healthcare_survey_responses(survey_id);

CREATE TABLE healthcare_survey_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES healthcare_surveys(id) ON DELETE CASCADE,
  insight_type healthcare_survey_insight_type NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  supporting_metric numeric(10,2),
  supporting_count integer,
  confidence healthcare_survey_confidence NOT NULL DEFAULT 'low',
  recommended_action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX healthcare_survey_insights_survey_idx ON healthcare_survey_insights(survey_id);

CREATE TABLE healthcare_survey_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  intended_use text NOT NULL,
  estimated_minutes integer NOT NULL,
  category text NOT NULL,
  intro_text text NOT NULL,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX healthcare_survey_templates_key_uidx ON healthcare_survey_templates(template_key);
