-- Idempotent console table migration for local nzila_automation database.
-- Source of truth: packages/db/src/schema/*.ts

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Enum guards
-- ---------------------------------------------------------------------------
DO $$ BEGIN CREATE TYPE meeting_kind AS ENUM ('board','shareholders','committee'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE meeting_status AS ENUM ('scheduled','in_progress','adjourned','completed','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE resolution_kind AS ENUM ('ordinary','special','written'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE resolution_status AS ENUM ('draft','open','passed','failed','withdrawn'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE approval_type AS ENUM ('board','officer','shareholder','committee'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE approval_subject_type AS ENUM ('resolution','policy','contract','filing','payment'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE approval_status AS ENUM ('pending','approved','rejected','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE vote_choice AS ENUM ('for','against','abstain'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE governance_action_type AS ENUM ('resolution','filing','policy','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE governance_action_status AS ENUM ('draft','pending','done','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE document_category AS ENUM ('governance','finance','tax','legal','evidence','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE document_classification AS ENUM ('public','internal','confidential','restricted'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE filing_kind AS ENUM ('annual_return','minute_book','tax_return','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE filing_status AS ENUM ('pending','filed','late','waived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE compliance_task_kind AS ENUM ('control_test','policy_review','attestation','remediation','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE compliance_task_status AS ENUM ('open','in_progress','blocked','done','waived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE control_family AS ENUM ('access','change-mgmt','incident-response','dr-bcp','integrity','sdlc','retention'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE evidence_event_type AS ENUM ('incident','dr-test','access-review','period-close','release','restore-test','control-test','audit-request'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE retention_class AS ENUM ('PERMANENT','7_YEARS','3_YEARS','1_YEAR'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE chain_integrity AS ENUM ('VERIFIED','UNVERIFIED','BROKEN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE evidence_pack_status AS ENUM ('draft','sealed','verified','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE close_period_status AS ENUM ('open','in_progress','blocked','closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE close_task_status AS ENUM ('todo','in_progress','blocked','done','waived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE close_exception_severity AS ENUM ('low','medium','high','critical'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE close_exception_status AS ENUM ('open','accepted','remediated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE close_approval_status AS ENUM ('pending','approved','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE qbo_sync_status AS ENUM ('started','success','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE qbo_report_type AS ENUM ('balance_sheet','income_statement','cash_flow','trial_balance','journal'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE holder_type AS ENUM ('individual','entity'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE ledger_entry_type AS ENUM ('issuance','transfer','conversion','repurchase','cancellation','adjustment'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE tax_year_status AS ENUM ('open','in_progress','filed','closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE tax_filing_type AS ENUM ('T2','CO-17','Schedule50','T5','RL-3','Other','T1','T3','T4','T4A','T5013','PayrollRemittance'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE tax_installment_status AS ENUM ('scheduled','paid','missed','waived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE tax_notice_authority AS ENUM ('CRA','Revenu Quebec'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE tax_notice_type AS ENUM ('NOA','Reassessment','InstallmentReminder'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE indirect_tax_type AS ENUM ('GST','HST','QST'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE indirect_tax_filing_frequency AS ENUM ('monthly','quarterly','annual'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE indirect_tax_period_status AS ENUM ('open','filed','paid'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE stripe_connection_status AS ENUM ('active','revoked','error'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE stripe_event_processing_status AS ENUM ('pending','processed','ignored','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE stripe_payment_object_type AS ENUM ('payment_intent','charge','invoice'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE stripe_refund_status AS ENUM ('pending','succeeded','failed','canceled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE stripe_dispute_status AS ENUM ('warning_needs_response','warning_under_review','warning_closed','needs_response','under_review','won','lost'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE stripe_payout_status AS ENUM ('paid','pending','in_transit','canceled','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE stripe_report_type AS ENUM ('balance_summary','payout_reconciliation','charge_breakdown','refund_breakdown','dispute_summary'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE stripe_subscription_status AS ENUM ('incomplete','incomplete_expired','trialing','active','past_due','canceled','unpaid','paused'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE ml_model_status AS ENUM ('draft','active','retired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE ml_run_status AS ENUM ('started','success','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE commerce_quote_status AS ENUM ('draft','pricing','ready','sent','reviewing','accepted','declined','revised','expired','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE commerce_opportunity_status AS ENUM ('lead','qualified','proposal','negotiation','closed_won'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE commerce_pricing_tier AS ENUM ('budget','standard','premium'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Rename conflicting Django tables so Drizzle names can be created
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.documents') IS NOT NULL AND to_regclass('public.ue_documents') IS NULL THEN
    ALTER TABLE public.documents RENAME TO ue_documents;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.votes') IS NOT NULL AND to_regclass('public.ue_votes') IS NULL THEN
    ALTER TABLE public.votes RENAME TO ue_votes;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Governance
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  kind meeting_kind NOT NULL,
  title text NOT NULL,
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  status meeting_status NOT NULL DEFAULT 'scheduled',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  meeting_id uuid REFERENCES meetings(id),
  kind resolution_kind NOT NULL,
  title text NOT NULL,
  body text,
  status resolution_status NOT NULL DEFAULT 'draft',
  opened_at timestamptz,
  closed_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  resolution_id uuid REFERENCES resolutions(id),
  type approval_type NOT NULL,
  subject_type approval_subject_type NOT NULL,
  subject_id uuid,
  status approval_status NOT NULL DEFAULT 'pending',
  required_count integer NOT NULL DEFAULT 1,
  approved_count integer NOT NULL DEFAULT 0,
  due_at timestamptz,
  decided_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  approval_id uuid NOT NULL REFERENCES approvals(id),
  voter_person_id uuid NOT NULL REFERENCES people(id),
  weight numeric NOT NULL DEFAULT 1,
  choice vote_choice NOT NULL,
  cast_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Operations / Documents / Evidence
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS governance_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  type governance_action_type NOT NULL,
  status governance_action_status NOT NULL DEFAULT 'draft',
  title text NOT NULL,
  description text,
  owner_user_id text,
  due_date date,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  category document_category NOT NULL,
  title text NOT NULL,
  blob_container varchar(30) NOT NULL,
  blob_path text NOT NULL,
  content_type text NOT NULL,
  size_bytes bigint NOT NULL,
  sha256 text NOT NULL,
  uploaded_by text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  classification document_classification NOT NULL DEFAULT 'internal',
  linked_type text,
  linked_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS filings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  kind filing_kind NOT NULL,
  due_date date NOT NULL,
  status filing_status NOT NULL DEFAULT 'pending',
  document_id uuid REFERENCES documents(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compliance_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  kind compliance_task_kind NOT NULL,
  title text NOT NULL,
  due_date date NOT NULL,
  status compliance_task_status NOT NULL DEFAULT 'open',
  evidence_document_id uuid REFERENCES documents(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  actor_id text NOT NULL,
  entity_type text NOT NULL,
  org_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  actor_clerk_user_id text NOT NULL,
  actor_role text,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  before_json jsonb,
  after_json jsonb,
  hash text NOT NULL,
  previous_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidence_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id varchar(120) NOT NULL UNIQUE,
  org_id uuid NOT NULL REFERENCES orgs(id),
  control_family control_family NOT NULL,
  event_type evidence_event_type NOT NULL,
  event_id text NOT NULL,
  run_id uuid NOT NULL,
  blob_container varchar(30) NOT NULL,
  base_path text NOT NULL,
  summary text,
  controls_covered jsonb NOT NULL DEFAULT '[]'::jsonb,
  artifact_count integer NOT NULL DEFAULT 0,
  all_hashes_verified boolean NOT NULL DEFAULT false,
  chain_integrity chain_integrity NOT NULL DEFAULT 'UNVERIFIED',
  hash_chain_start uuid,
  hash_chain_end uuid,
  verified_at timestamptz,
  verified_by text,
  status evidence_pack_status NOT NULL DEFAULT 'draft',
  index_document_id uuid REFERENCES documents(id),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidence_pack_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES evidence_packs(id),
  document_id uuid NOT NULL REFERENCES documents(id),
  artifact_id text NOT NULL,
  artifact_type text NOT NULL,
  retention_class retention_class NOT NULL,
  audit_event_id uuid REFERENCES audit_events(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Finance
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS close_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  year integer NOT NULL,
  month integer NOT NULL,
  status close_period_status NOT NULL DEFAULT 'open',
  started_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS close_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  period_id uuid NOT NULL REFERENCES close_periods(id),
  title text NOT NULL,
  owner_user_id text,
  due_at timestamptz,
  status close_task_status NOT NULL DEFAULT 'todo',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS close_task_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  task_id uuid NOT NULL REFERENCES close_tasks(id),
  document_id uuid NOT NULL REFERENCES documents(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS close_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  period_id uuid NOT NULL REFERENCES close_periods(id),
  task_id uuid REFERENCES close_tasks(id),
  severity close_exception_severity NOT NULL,
  status close_exception_status NOT NULL DEFAULT 'open',
  title text NOT NULL,
  details text,
  raised_by text,
  raised_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS close_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  period_id uuid NOT NULL REFERENCES close_periods(id),
  approver_person_id uuid REFERENCES people(id),
  status close_approval_status NOT NULL DEFAULT 'pending',
  decided_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qbo_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  realm_id text NOT NULL,
  company_name text,
  connected_by text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  disconnected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qbo_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  connection_id uuid NOT NULL REFERENCES qbo_connections(id),
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qbo_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  connection_id uuid NOT NULL REFERENCES qbo_connections(id),
  status qbo_sync_status NOT NULL DEFAULT 'started',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qbo_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  sync_run_id uuid REFERENCES qbo_sync_runs(id),
  report_type qbo_report_type NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  document_id uuid REFERENCES documents(id),
  checksum text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS finance_governance_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  close_period_id uuid REFERENCES close_periods(id),
  approval_id uuid REFERENCES approvals(id),
  resolution_id uuid REFERENCES resolutions(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Equity
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS share_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  code varchar(30) NOT NULL,
  display_name text NOT NULL,
  votes_per_share numeric NOT NULL DEFAULT 1,
  dividend_rank integer NOT NULL DEFAULT 0,
  liquidation_rank integer NOT NULL DEFAULT 0,
  is_convertible boolean NOT NULL DEFAULT false,
  conversion_to_class_id uuid,
  conversion_ratio numeric,
  transfer_restricted boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shareholders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  holder_person_id uuid NOT NULL REFERENCES people(id),
  holder_type holder_type NOT NULL,
  contact_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS share_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  entry_type ledger_entry_type NOT NULL,
  class_id uuid NOT NULL REFERENCES share_classes(id),
  from_shareholder_id uuid REFERENCES shareholders(id),
  to_shareholder_id uuid REFERENCES shareholders(id),
  quantity bigint NOT NULL,
  price_per_share numeric,
  currency varchar(3) DEFAULT 'CAD',
  effective_date date NOT NULL,
  reference_resolution_id uuid,
  reference_document_id uuid,
  notes text,
  hash text NOT NULL,
  previous_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS share_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  shareholder_id uuid NOT NULL REFERENCES shareholders(id),
  class_id uuid NOT NULL REFERENCES share_classes(id),
  certificate_number text NOT NULL,
  issued_date date NOT NULL,
  quantity bigint NOT NULL,
  document_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cap_table_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  as_of_date date NOT NULL,
  snapshot_json jsonb NOT NULL,
  generated_by text NOT NULL,
  document_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Tax
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  business_number text,
  cra_program_accounts jsonb NOT NULL DEFAULT '{}'::jsonb,
  rq_numbers jsonb NOT NULL DEFAULT '{}'::jsonb,
  filing_contacts jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tax_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  year integer NOT NULL,
  status tax_year_status NOT NULL DEFAULT 'open',
  period_start date NOT NULL,
  period_end date NOT NULL,
  lock_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tax_filings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  tax_year_id uuid REFERENCES tax_years(id),
  filing_type tax_filing_type NOT NULL,
  authority tax_notice_authority,
  due_date date NOT NULL,
  filed_date date,
  status filing_status NOT NULL DEFAULT 'pending',
  confirmation_number text,
  document_id uuid REFERENCES documents(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tax_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  tax_year_id uuid REFERENCES tax_years(id),
  due_date date NOT NULL,
  amount numeric NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'CAD',
  status tax_installment_status NOT NULL DEFAULT 'scheduled',
  paid_at timestamptz,
  payment_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tax_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  tax_year_id uuid REFERENCES tax_years(id),
  authority tax_notice_authority NOT NULL,
  notice_type tax_notice_type NOT NULL,
  issued_date date NOT NULL,
  amount numeric,
  currency varchar(3) NOT NULL DEFAULT 'CAD',
  response_due_date date,
  status filing_status NOT NULL DEFAULT 'pending',
  document_id uuid REFERENCES documents(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS indirect_tax_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  tax_type indirect_tax_type NOT NULL,
  account_number text,
  filing_frequency indirect_tax_filing_frequency NOT NULL,
  filing_day integer,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS indirect_tax_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  account_id uuid NOT NULL REFERENCES indirect_tax_accounts(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  status indirect_tax_period_status NOT NULL DEFAULT 'open',
  due_date date,
  filed_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS indirect_tax_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  period_id uuid NOT NULL REFERENCES indirect_tax_periods(id),
  taxable_sales numeric NOT NULL DEFAULT 0,
  taxable_purchases numeric NOT NULL DEFAULT 0,
  tax_collected numeric NOT NULL DEFAULT 0,
  tax_paid numeric NOT NULL DEFAULT 0,
  net_tax numeric NOT NULL DEFAULT 0,
  currency varchar(3) NOT NULL DEFAULT 'CAD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Stripe payments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stripe_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  stripe_account_id text NOT NULL,
  status stripe_connection_status NOT NULL DEFAULT 'active',
  publishable_key text,
  connected_at timestamptz,
  disconnected_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  stripe_event_id text NOT NULL,
  event_type text NOT NULL,
  livemode boolean NOT NULL DEFAULT false,
  occurred_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processing_status stripe_event_processing_status NOT NULL DEFAULT 'pending',
  processing_error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS stripe_webhook_events_event_id_idx
  ON stripe_webhook_events (stripe_event_id);

CREATE TABLE IF NOT EXISTS stripe_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  raw_event_id uuid REFERENCES stripe_webhook_events(id),
  object_type stripe_payment_object_type NOT NULL,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  stripe_invoice_id text,
  customer_id text,
  amount numeric,
  currency varchar(3) NOT NULL DEFAULT 'CAD',
  payment_status text,
  payment_method text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stripe_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  payment_id uuid REFERENCES stripe_payments(id),
  stripe_refund_id text NOT NULL,
  amount numeric NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'CAD',
  status stripe_refund_status NOT NULL,
  reason text,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stripe_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  payment_id uuid REFERENCES stripe_payments(id),
  stripe_dispute_id text NOT NULL,
  amount numeric NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'CAD',
  reason text,
  status stripe_dispute_status NOT NULL,
  due_by timestamptz,
  evidence_due_by timestamptz,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stripe_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  stripe_payout_id text NOT NULL,
  amount numeric NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'CAD',
  status stripe_payout_status NOT NULL,
  arrival_date date,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stripe_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  period_id text,
  report_type stripe_report_type NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  document_id uuid REFERENCES documents(id),
  sha256 text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stripe_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text NOT NULL,
  stripe_price_id text NOT NULL,
  stripe_product_id text,
  plan_name text,
  plan_interval text,
  amount_cents bigint,
  currency varchar(3) NOT NULL DEFAULT 'CAD',
  status stripe_subscription_status NOT NULL DEFAULT 'incomplete',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  trial_start timestamptz,
  trial_end timestamptz,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS stripe_subscriptions_stripe_id_idx
  ON stripe_subscriptions (stripe_subscription_id);

-- ---------------------------------------------------------------------------
-- ML
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ml_datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  dataset_key text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  row_count integer NOT NULL DEFAULT 0,
  snapshot_document_id uuid REFERENCES documents(id),
  schema_json jsonb,
  build_config_json jsonb,
  sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ml_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  model_key text NOT NULL,
  algorithm text NOT NULL DEFAULT 'isolation_forest',
  version integer NOT NULL DEFAULT 1,
  status ml_model_status NOT NULL DEFAULT 'draft',
  training_dataset_id uuid REFERENCES ml_datasets(id),
  artifact_document_id uuid REFERENCES documents(id),
  metrics_document_id uuid REFERENCES documents(id),
  hyperparams_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  feature_spec_json jsonb,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, model_key, version)
);

CREATE TABLE IF NOT EXISTS ml_training_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  model_key text NOT NULL,
  dataset_id uuid REFERENCES ml_datasets(id),
  status ml_run_status NOT NULL DEFAULT 'started',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  logs_document_id uuid REFERENCES documents(id),
  metrics_document_id uuid REFERENCES documents(id),
  artifact_document_id uuid REFERENCES documents(id),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ml_inference_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  model_id uuid NOT NULL REFERENCES ml_models(id),
  status ml_run_status NOT NULL DEFAULT 'started',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  input_period_start date NOT NULL,
  input_period_end date NOT NULL,
  output_document_id uuid REFERENCES documents(id),
  summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ml_scores_stripe_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  date date NOT NULL,
  features_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  score numeric(12,6) NOT NULL,
  is_anomaly boolean NOT NULL DEFAULT false,
  threshold numeric(12,6) NOT NULL,
  model_id uuid NOT NULL REFERENCES ml_models(id),
  inference_run_id uuid REFERENCES ml_inference_runs(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, date, model_id)
);

CREATE TABLE IF NOT EXISTS ml_scores_stripe_txn (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  stripe_event_id text,
  stripe_charge_id text,
  stripe_payment_intent_id text,
  stripe_balance_txn_id text,
  occurred_at timestamptz NOT NULL,
  currency text NOT NULL DEFAULT 'cad',
  amount numeric(18,6) NOT NULL,
  features_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  score numeric(12,6) NOT NULL,
  is_anomaly boolean NOT NULL DEFAULT false,
  threshold numeric(12,6) NOT NULL,
  model_id uuid NOT NULL REFERENCES ml_models(id),
  inference_run_id uuid REFERENCES ml_inference_runs(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ml_scores_ue_cases_priority (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  case_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL,
  score numeric(12,6) NOT NULL,
  predicted_priority text NOT NULL,
  actual_priority text,
  features_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  model_id uuid NOT NULL REFERENCES ml_models(id),
  inference_run_id uuid REFERENCES ml_inference_runs(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, case_id, model_id)
);

CREATE TABLE IF NOT EXISTS ml_scores_ue_sla_risk (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  case_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL,
  probability numeric(12,6) NOT NULL,
  predicted_breach boolean NOT NULL DEFAULT false,
  actual_breach boolean,
  features_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  model_id uuid NOT NULL REFERENCES ml_models(id),
  inference_run_id uuid REFERENCES ml_inference_runs(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, case_id, model_id)
);

-- ---------------------------------------------------------------------------
-- App outbox / commerce / platform
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS zonga_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  event_type varchar(255) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  dispatched_at timestamptz
);

CREATE TABLE IF NOT EXISTS nacp_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  event_type varchar(255) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  dispatched_at timestamptz
);

CREATE TABLE IF NOT EXISTS commerce_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  name text NOT NULL,
  email text,
  phone text,
  company text,
  address jsonb,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commerce_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  customer_id uuid NOT NULL REFERENCES commerce_customers(id),
  title text NOT NULL,
  description text,
  estimated_value numeric(18,2),
  status commerce_opportunity_status NOT NULL DEFAULT 'lead',
  closed_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commerce_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  customer_id uuid NOT NULL REFERENCES commerce_customers(id),
  opportunity_id uuid REFERENCES commerce_opportunities(id),
  ref varchar(30) NOT NULL,
  current_version integer NOT NULL DEFAULT 1,
  status commerce_quote_status NOT NULL DEFAULT 'draft',
  pricing_tier commerce_pricing_tier NOT NULL DEFAULT 'standard',
  currency varchar(3) NOT NULL DEFAULT 'CAD',
  subtotal numeric(18,2) NOT NULL DEFAULT 0,
  tax_total numeric(18,2) NOT NULL DEFAULT 0,
  total numeric(18,2) NOT NULL DEFAULT 0,
  valid_until timestamptz,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_isolation_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  isolation_score real NOT NULL,
  total_checks integer NOT NULL,
  passed_checks integer NOT NULL,
  violations jsonb NOT NULL DEFAULT '[]'::jsonb,
  audited_at timestamptz NOT NULL DEFAULT now()
);
