--+ ============================================================================
-- Post-freeze PLATFORM_SQL SCHEMA_CREATION
-- Root: apps/union-eyes/db/migrations-platform/
-- File: 0002_employer_execution_and_related_a.sql
-- Owner: PLATFORM_SQL_OWNED
-- Tables: employer-execution cluster + break_policies + member_breaks + satisfaction_surveys
-- Derived from Drizzle domain schemas. Forward-only. Does not modify frozen lineage.
-- External parent FKs omitted (UUID columns retained) so apply succeeds before snapshot parents exist.
--+ ============================================================================

DO $$ BEGIN CREATE TYPE employer_execution_profile_status AS ENUM ('draft','active','suspended','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE cba_rule_version_status AS ENUM ('draft','active','retired','superseded'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE cba_rule_set_item_type AS ENUM ('base_rate','overtime','doubletime','premium','travel','dues','benefit','pension','compliance'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE employer_timesheet_batch_status AS ENUM ('uploaded','normalizing','validated','rejected','processed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE employer_timesheet_entry_status AS ENUM ('pending','valid','invalid','duplicate'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE employer_payroll_run_type AS ENUM ('preview','official'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE employer_payroll_run_status AS ENUM ('draft','calculated','approved','posted','replayed','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE employer_remittance_run_status AS ENUM ('draft','generated','sealed','submitted','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE employer_execution_artifact_type AS ENUM ('payroll_snapshot','payroll_trace','remittance_csv','remittance_json','summary','evidence_manifest','evidence_seal','replay_diff'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE employer_execution_replay_mode AS ENUM ('exact','simulated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE employer_execution_evidence_entity_type AS ENUM ('payroll_run','remittance_run','replay','approval','adjustment_run'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE employer_execution_compliance_severity AS ENUM ('info','warning','error','critical'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE employer_execution_compliance_status AS ENUM ('open','acknowledged','resolved','waived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE employer_execution_compliance_blocking AS ENUM ('yes','no'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE break_type AS ENUM ('meal','rest','union','nursing','prayer','health','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE break_compensation AS ENUM ('paid','unpaid'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE break_status AS ENUM ('scheduled','taken','shortened','missed','denied','deferred'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS employer_execution_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  profile_code varchar(100) NOT NULL,
  status employer_execution_profile_status NOT NULL DEFAULT 'draft',
  jurisdiction varchar(50) NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'CAD',
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS employer_execution_profiles_org_idx ON employer_execution_profiles (organization_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS employer_execution_profiles_org_profile_idx ON employer_execution_profiles (organization_id, profile_code);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS cba_rule_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  collective_agreement_id uuid,
  employer_id uuid,
  worksite_id uuid,
  bargaining_unit_id uuid,
  rule_version_code varchar(120) NOT NULL,
  status cba_rule_version_status NOT NULL DEFAULT 'draft',
  effective_from date NOT NULL,
  effective_to date,
  source_hash varchar(64) NOT NULL,
  source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  rules_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS cba_rule_versions_org_idx ON cba_rule_versions (organization_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS cba_rule_versions_org_code_idx ON cba_rule_versions (organization_id, rule_version_code);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS cba_rule_set_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  cba_rule_version_id uuid NOT NULL,
  item_type cba_rule_set_item_type NOT NULL,
  rule_code varchar(120) NOT NULL,
  precedence integer NOT NULL DEFAULT 0,
  classification_code varchar(120),
  worksite_code varchar(120),
  region_code varchar(50),
  condition_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  action_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  rule_hash varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS cba_rule_set_items_org_idx ON cba_rule_set_items (organization_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS cba_rule_set_items_version_idx ON cba_rule_set_items (cba_rule_version_id);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS employer_timesheet_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  employer_id uuid NOT NULL,
  worksite_id uuid,
  bargaining_unit_id uuid,
  batch_code varchar(120) NOT NULL,
  source_file_name varchar(255) NOT NULL,
  source_file_hash varchar(64) NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status employer_timesheet_batch_status NOT NULL DEFAULT 'uploaded',
  validation_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  uploaded_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS employer_timesheet_batches_org_idx ON employer_timesheet_batches (organization_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS employer_timesheet_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  member_employment_id uuid,
  employer_id uuid,
  worksite_id uuid,
  bargaining_unit_id uuid,
  job_classification_id uuid,
  employee_external_id varchar(120) NOT NULL,
  shift_date date NOT NULL,
  regular_hours numeric(8,2) NOT NULL DEFAULT 0,
  overtime_hours numeric(8,2) NOT NULL DEFAULT 0,
  doubletime_hours numeric(8,2) NOT NULL DEFAULT 0,
  premium_code varchar(120),
  travel_hours numeric(8,2) NOT NULL DEFAULT 0,
  row_number integer NOT NULL,
  source_row_hash varchar(64) NOT NULL,
  validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  status employer_timesheet_entry_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS employer_timesheet_entries_org_idx ON employer_timesheet_entries (organization_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS employer_timesheet_entries_batch_idx ON employer_timesheet_entries (batch_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS employer_payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  run_code varchar(120) NOT NULL,
  run_type employer_payroll_run_type NOT NULL DEFAULT 'preview',
  status employer_payroll_run_status NOT NULL DEFAULT 'draft',
  period_start date NOT NULL,
  period_end date NOT NULL,
  source_batch_id uuid,
  cba_rule_version_id uuid,
  engine_version varchar(100) NOT NULL,
  input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  calc_trace jsonb NOT NULL DEFAULT '{}'::jsonb,
  calc_trace_hash varchar(64) NOT NULL,
  total_gross numeric(14,2) NOT NULL DEFAULT 0,
  total_net numeric(14,2) NOT NULL DEFAULT 0,
  total_dues numeric(14,2) NOT NULL DEFAULT 0,
  total_benefits numeric(14,2) NOT NULL DEFAULT 0,
  total_pension numeric(14,2) NOT NULL DEFAULT 0,
  immutable_snapshot_locked boolean NOT NULL DEFAULT false,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS employer_payroll_runs_org_idx ON employer_payroll_runs (organization_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS employer_payroll_run_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  payroll_run_id uuid NOT NULL,
  member_employment_id uuid,
  timesheet_entry_id uuid,
  employee_external_id varchar(120) NOT NULL,
  gross_pay numeric(14,2) NOT NULL DEFAULT 0,
  net_pay numeric(14,2) NOT NULL DEFAULT 0,
  dues_amount numeric(14,2) NOT NULL DEFAULT 0,
  benefit_amount numeric(14,2) NOT NULL DEFAULT 0,
  pension_amount numeric(14,2) NOT NULL DEFAULT 0,
  remittance_group_key varchar(120) NOT NULL,
  trace_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  trace_hash varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS employer_payroll_run_items_org_idx ON employer_payroll_run_items (organization_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS employer_payroll_run_items_run_idx ON employer_payroll_run_items (payroll_run_id);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS employer_remittance_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  payroll_run_id uuid NOT NULL,
  run_code varchar(120) NOT NULL,
  status employer_remittance_run_status NOT NULL DEFAULT 'draft',
  period_start date NOT NULL,
  period_end date NOT NULL,
  due_date date NOT NULL,
  total_due numeric(14,2) NOT NULL DEFAULT 0,
  package_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_formats jsonb NOT NULL DEFAULT '["csv","json"]'::jsonb,
  immutable_snapshot_locked boolean NOT NULL DEFAULT false,
  generated_by text,
  generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS employer_remittance_runs_org_idx ON employer_remittance_runs (organization_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS employer_remittance_run_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  remittance_run_id uuid NOT NULL,
  group_key varchar(120) NOT NULL,
  contribution_type varchar(100) NOT NULL,
  amount numeric(14,2) NOT NULL,
  member_count numeric(14,2) NOT NULL DEFAULT 0,
  trace_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS employer_remittance_run_items_org_idx ON employer_remittance_run_items (organization_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS employer_execution_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  payroll_run_id uuid,
  remittance_run_id uuid,
  artifact_type employer_execution_artifact_type NOT NULL,
  artifact_name varchar(255) NOT NULL,
  storage_ref text NOT NULL,
  artifact_hash varchar(64) NOT NULL,
  manifest_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS employer_execution_artifacts_org_idx ON employer_execution_artifacts (organization_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS employer_execution_replays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  source_payroll_run_id uuid NOT NULL,
  replay_payroll_run_id uuid,
  mode employer_execution_replay_mode NOT NULL DEFAULT 'exact',
  source_engine_version varchar(100) NOT NULL,
  replay_engine_version varchar(100) NOT NULL,
  diff_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  diff_summary text,
  diff_hash varchar(64) NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS employer_execution_replays_org_idx ON employer_execution_replays (organization_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS employer_execution_evidence_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  entity_type employer_execution_evidence_entity_type NOT NULL,
  entity_id uuid NOT NULL,
  parent_link_id uuid,
  parent_seal_hash varchar(64),
  manifest_hash varchar(64) NOT NULL,
  seal_hash varchar(64) NOT NULL,
  chain_depth numeric(8,0) NOT NULL DEFAULT 1,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS employer_execution_evidence_links_org_idx ON employer_execution_evidence_links (organization_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS employer_execution_compliance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  payroll_run_id uuid,
  remittance_run_id uuid,
  event_code varchar(120) NOT NULL,
  severity employer_execution_compliance_severity NOT NULL DEFAULT 'warning',
  status employer_execution_compliance_status NOT NULL DEFAULT 'open',
  summary text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  blocking employer_execution_compliance_blocking NOT NULL DEFAULT 'no',
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS employer_execution_compliance_events_org_idx ON employer_execution_compliance_events (organization_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS break_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  name varchar(255) NOT NULL,
  break_type break_type NOT NULL,
  compensation break_compensation NOT NULL,
  duration_minutes integer NOT NULL,
  frequency_per_shift integer NOT NULL DEFAULT 1,
  min_hours_for_eligibility integer,
  max_hours_between integer,
  applicable_shift_type varchar(50),
  cba_clause_ref varchar(255),
  metadata jsonb,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by varchar(255)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_break_policies_org ON break_policies (organization_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS member_breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  member_id uuid NOT NULL,
  member_employment_id uuid,
  break_policy_id uuid,
  break_type break_type NOT NULL,
  break_status break_status NOT NULL DEFAULT 'scheduled',
  compensation break_compensation,
  work_date date NOT NULL,
  scheduled_start time,
  scheduled_end time,
  scheduled_duration_minutes integer,
  actual_start time,
  actual_end time,
  actual_duration_minutes integer,
  denied_by varchar(255),
  denial_reason text,
  notes text,
  compliance_flag boolean DEFAULT false,
  compliance_flag_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by varchar(255)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_member_breaks_org ON member_breaks (organization_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS satisfaction_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  claim_id uuid NOT NULL,
  member_id varchar(255) NOT NULL,
  lro_id varchar(255) NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'pending',
  communication_rating integer,
  responsiveness_rating integer,
  knowledge_rating integer,
  advocacy_rating integer,
  professionalism_rating integer,
  outcome_rating integer,
  overall_score numeric(3,2),
  feedback text,
  would_recommend boolean,
  is_anonymous boolean NOT NULL DEFAULT false,
  sent_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_satisfaction_org ON satisfaction_surveys (organization_id);
