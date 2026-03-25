-- Migration: 0086_monetization_phase2
-- Monetization Infrastructure Layer — Phase 2
--
-- Adds:
--   14 enums + 13 tables for transaction fees, pricing templates,
--   contract amendments/rate-cards/covered-orgs, and reconciliation.
--
-- Safe: IF NOT EXISTS on all CREATE TYPE / CREATE TABLE statements.

BEGIN;

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Transaction Fees
DO $$ BEGIN
  CREATE TYPE fee_model AS ENUM ('percentage','flat','hybrid','waived','subsidized');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fee_rule_status AS ENUM ('active','inactive','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fee_event_status AS ENUM ('captured','reversed','settled','disputed','waived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE settlement_batch_status AS ENUM ('open','closed','reconciled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fee_adjustment_type AS ENUM ('reversal','waiver','correction','dispute_credit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Pricing Templates
DO $$ BEGIN
  CREATE TYPE pricing_template_status AS ENUM ('active','inactive','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE billing_cadence AS ENUM ('monthly','quarterly','annual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE template_tier AS ENUM ('pilot','shared_rollout','full_deployment','mid_sized_union','membership_association','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Contract Amendments
DO $$ BEGIN
  CREATE TYPE contract_amendment_status AS ENUM ('draft','pending_approval','approved','rejected','superseded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE covered_org_role AS ENUM ('local','division','region','employer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Reconciliation
DO $$ BEGIN
  CREATE TYPE reconciliation_run_status AS ENUM ('running','completed','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE reconciliation_match_type AS ENUM ('invoice_payment','fee_settlement','refund_reversal','adjustment_credit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE reconciliation_exception_type AS ENUM ('unmatched_payment','unmatched_invoice','amount_discrepancy','duplicate_payment','missing_fee_event','orphaned_refund');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE reconciliation_exception_status AS ENUM ('open','under_review','resolved','written_off');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- TRANSACTION FEE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS transaction_fee_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT,
  contract_id   UUID REFERENCES commercial_contracts(id) ON DELETE SET NULL,
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  fee_model     fee_model NOT NULL,
  percentage_rate DECIMAL(8,6),
  flat_fee_cad  DECIMAL(14,2),
  minimum_fee_cad DECIMAL(14,2),
  maximum_fee_cad DECIMAL(14,2),
  flow_type     VARCHAR(100) NOT NULL,
  module_key    VARCHAR(100),
  status        fee_rule_status NOT NULL DEFAULT 'active',
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to  TIMESTAMPTZ,
  priority      INTEGER NOT NULL DEFAULT 0,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS fee_settlement_batches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number  VARCHAR(50) NOT NULL UNIQUE,
  period_start  TIMESTAMPTZ NOT NULL,
  period_end    TIMESTAMPTZ NOT NULL,
  total_gross_cad DECIMAL(14,2) NOT NULL,
  total_fees_cad  DECIMAL(14,2) NOT NULL,
  total_net_cad   DECIMAL(14,2) NOT NULL,
  event_count   INTEGER NOT NULL DEFAULT 0,
  status        settlement_batch_status NOT NULL DEFAULT 'open',
  closed_at     TIMESTAMPTZ,
  closed_by     VARCHAR(255),
  reconciled_at TIMESTAMPTZ,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transaction_fee_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  rule_id       UUID NOT NULL REFERENCES transaction_fee_rules(id) ON DELETE RESTRICT,
  contract_id   UUID REFERENCES commercial_contracts(id) ON DELETE SET NULL,
  idempotency_key VARCHAR(255) NOT NULL UNIQUE,
  source_transaction_id VARCHAR(255) NOT NULL,
  source_transaction_type VARCHAR(100) NOT NULL,
  gross_amount_cad DECIMAL(14,2) NOT NULL,
  fee_amount_cad   DECIMAL(14,2) NOT NULL,
  net_amount_cad   DECIMAL(14,2) NOT NULL,
  fee_model_applied fee_model NOT NULL,
  percentage_rate_applied DECIMAL(8,6),
  flat_fee_applied DECIMAL(14,2),
  status        fee_event_status NOT NULL DEFAULT 'captured',
  billing_period_id UUID,
  settlement_batch_id UUID REFERENCES fee_settlement_batches(id) ON DELETE SET NULL,
  captured_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fee_settlement_lines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id      UUID NOT NULL REFERENCES fee_settlement_batches(id) ON DELETE RESTRICT,
  fee_event_id  UUID NOT NULL REFERENCES transaction_fee_events(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  gross_amount_cad DECIMAL(14,2) NOT NULL,
  fee_amount_cad   DECIMAL(14,2) NOT NULL,
  net_amount_cad   DECIMAL(14,2) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fee_adjustments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_event_id  UUID NOT NULL REFERENCES transaction_fee_events(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  adjustment_type fee_adjustment_type NOT NULL,
  amount_cad    DECIMAL(14,2) NOT NULL,
  reason        TEXT NOT NULL,
  source_refund_id VARCHAR(255),
  approved_by   VARCHAR(255),
  approved_at   TIMESTAMPTZ,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PRICING TEMPLATE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS pricing_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR(50) NOT NULL UNIQUE,
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  tier          template_tier NOT NULL,
  status        pricing_template_status NOT NULL DEFAULT 'active',
  base_platform_fee_cad DECIMAL(14,2) NOT NULL,
  per_local_fee_cad     DECIMAL(14,2) DEFAULT '0.00',
  per_division_fee_cad  DECIMAL(14,2) DEFAULT '0.00',
  per_admin_seat_fee_cad DECIMAL(14,2) DEFAULT '0.00',
  per_module_fee_cad    DECIMAL(14,2) DEFAULT '0.00',
  transaction_fee_rate  DECIMAL(8,6) DEFAULT '0.000000',
  transaction_flat_fee_cad DECIMAL(14,2) DEFAULT '0.00',
  onboarding_fee_cad    DECIMAL(14,2) DEFAULT '0.00',
  support_fee_cad       DECIMAL(14,2) DEFAULT '0.00',
  discount_percent      DECIMAL(5,2) DEFAULT '0.00',
  subsidy_cad           DECIMAL(14,2) DEFAULT '0.00',
  billing_cadence       billing_cadence NOT NULL DEFAULT 'monthly',
  max_covered_locals    INTEGER,
  max_covered_divisions INTEGER,
  included_modules      INTEGER DEFAULT 0,
  trial_days            INTEGER DEFAULT 0,
  contract_term_months  INTEGER DEFAULT 12,
  fee_waiver_active     BOOLEAN NOT NULL DEFAULT FALSE,
  allocation_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  pilot_mode            BOOLEAN NOT NULL DEFAULT FALSE,
  metadata              JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS pricing_template_modules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   UUID NOT NULL REFERENCES pricing_templates(id) ON DELETE CASCADE,
  module_key    VARCHAR(100) NOT NULL,
  module_name   VARCHAR(255) NOT NULL,
  included      BOOLEAN NOT NULL DEFAULT FALSE,
  additional_fee_cad DECIMAL(14,2) DEFAULT '0.00',
  usage_limit   INTEGER,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- CONTRACT AMENDMENT TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS contract_rate_cards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id   UUID NOT NULL REFERENCES commercial_contracts(id) ON DELETE CASCADE,
  module_key    VARCHAR(100) NOT NULL,
  module_name   VARCHAR(255) NOT NULL,
  base_price_cad DECIMAL(14,2) NOT NULL,
  negotiated_price_cad DECIMAL(14,2) NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT '0.00',
  transaction_fee_override DECIMAL(8,6),
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to  TIMESTAMPTZ,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contract_amendments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id   UUID NOT NULL REFERENCES commercial_contracts(id) ON DELETE CASCADE,
  amendment_number VARCHAR(50) NOT NULL,
  version       INTEGER NOT NULL DEFAULT 1,
  status        contract_amendment_status NOT NULL DEFAULT 'draft',
  summary       TEXT NOT NULL,
  changes       JSONB NOT NULL,
  previous_values JSONB,
  effective_date TIMESTAMPTZ NOT NULL,
  requested_by  VARCHAR(255) NOT NULL,
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by   VARCHAR(255),
  approved_at   TIMESTAMPTZ,
  rejected_by   VARCHAR(255),
  rejected_at   TIMESTAMPTZ,
  rejection_reason TEXT,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contract_covered_orgs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id   UUID NOT NULL REFERENCES commercial_contracts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  role          covered_org_role NOT NULL,
  activated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- RECONCILIATION TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT,
  billing_period_id UUID,
  period_start  TIMESTAMPTZ NOT NULL,
  period_end    TIMESTAMPTZ NOT NULL,
  status        reconciliation_run_status NOT NULL DEFAULT 'running',
  total_invoices  INTEGER NOT NULL DEFAULT 0,
  total_payments  INTEGER NOT NULL DEFAULT 0,
  total_matches   INTEGER NOT NULL DEFAULT 0,
  total_exceptions INTEGER NOT NULL DEFAULT 0,
  invoice_amount_cad DECIMAL(14,2) DEFAULT '0.00',
  payment_amount_cad DECIMAL(14,2) DEFAULT '0.00',
  variance_cad  DECIMAL(14,2) DEFAULT '0.00',
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  run_by        VARCHAR(255),
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reconciliation_matches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        UUID NOT NULL REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
  match_type    reconciliation_match_type NOT NULL,
  source_type   VARCHAR(50) NOT NULL,
  source_id     UUID NOT NULL,
  target_type   VARCHAR(50) NOT NULL,
  target_id     UUID NOT NULL,
  source_amount_cad DECIMAL(14,2) NOT NULL,
  target_amount_cad DECIMAL(14,2) NOT NULL,
  variance_cad  DECIMAL(14,2) NOT NULL DEFAULT '0.00',
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reconciliation_exceptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        UUID NOT NULL REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT,
  exception_type reconciliation_exception_type NOT NULL,
  exception_status reconciliation_exception_status NOT NULL DEFAULT 'open',
  source_type   VARCHAR(50) NOT NULL,
  source_id     UUID NOT NULL,
  expected_amount_cad DECIMAL(14,2),
  actual_amount_cad   DECIMAL(14,2),
  variance_cad  DECIMAL(14,2),
  description   TEXT NOT NULL,
  resolved_by   VARCHAR(255),
  resolved_at   TIMESTAMPTZ,
  resolution_notes TEXT,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Transaction Fee Rules
CREATE INDEX IF NOT EXISTS txn_fee_rules_org_idx ON transaction_fee_rules(organization_id);
CREATE INDEX IF NOT EXISTS txn_fee_rules_contract_idx ON transaction_fee_rules(contract_id);
CREATE INDEX IF NOT EXISTS txn_fee_rules_flow_idx ON transaction_fee_rules(flow_type);
CREATE INDEX IF NOT EXISTS txn_fee_rules_status_idx ON transaction_fee_rules(status);

-- Transaction Fee Events
CREATE INDEX IF NOT EXISTS txn_fee_events_org_idx ON transaction_fee_events(organization_id);
CREATE INDEX IF NOT EXISTS txn_fee_events_rule_idx ON transaction_fee_events(rule_id);
CREATE UNIQUE INDEX IF NOT EXISTS txn_fee_events_idempotency_idx ON transaction_fee_events(idempotency_key);
CREATE INDEX IF NOT EXISTS txn_fee_events_source_idx ON transaction_fee_events(source_transaction_id);
CREATE INDEX IF NOT EXISTS txn_fee_events_status_idx ON transaction_fee_events(status);
CREATE INDEX IF NOT EXISTS txn_fee_events_captured_idx ON transaction_fee_events(captured_at);

-- Fee Settlement Lines
CREATE INDEX IF NOT EXISTS fee_settlement_lines_batch_idx ON fee_settlement_lines(batch_id);
CREATE INDEX IF NOT EXISTS fee_settlement_lines_event_idx ON fee_settlement_lines(fee_event_id);
CREATE INDEX IF NOT EXISTS fee_settlement_lines_org_idx ON fee_settlement_lines(organization_id);

-- Fee Adjustments
CREATE INDEX IF NOT EXISTS fee_adjustments_event_idx ON fee_adjustments(fee_event_id);
CREATE INDEX IF NOT EXISTS fee_adjustments_org_idx ON fee_adjustments(organization_id);
CREATE INDEX IF NOT EXISTS fee_adjustments_type_idx ON fee_adjustments(adjustment_type);

-- Pricing Templates
CREATE INDEX IF NOT EXISTS pricing_templates_tier_idx ON pricing_templates(tier);
CREATE INDEX IF NOT EXISTS pricing_templates_status_idx ON pricing_templates(status);

-- Pricing Template Modules
CREATE INDEX IF NOT EXISTS pricing_template_modules_template_idx ON pricing_template_modules(template_id);
CREATE INDEX IF NOT EXISTS pricing_template_modules_module_idx ON pricing_template_modules(module_key);

-- Contract Rate Cards
CREATE INDEX IF NOT EXISTS contract_rate_cards_contract_idx ON contract_rate_cards(contract_id);
CREATE INDEX IF NOT EXISTS contract_rate_cards_module_idx ON contract_rate_cards(module_key);
CREATE UNIQUE INDEX IF NOT EXISTS contract_rate_cards_contract_module_idx ON contract_rate_cards(contract_id, module_key);

-- Contract Amendments
CREATE INDEX IF NOT EXISTS contract_amendments_contract_idx ON contract_amendments(contract_id);
CREATE INDEX IF NOT EXISTS contract_amendments_status_idx ON contract_amendments(status);
CREATE UNIQUE INDEX IF NOT EXISTS contract_amendments_number_idx ON contract_amendments(contract_id, amendment_number);

-- Contract Covered Orgs
CREATE INDEX IF NOT EXISTS contract_covered_orgs_contract_idx ON contract_covered_orgs(contract_id);
CREATE INDEX IF NOT EXISTS contract_covered_orgs_org_idx ON contract_covered_orgs(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS contract_covered_orgs_contract_org_idx ON contract_covered_orgs(contract_id, organization_id);

-- Reconciliation Runs
CREATE INDEX IF NOT EXISTS reconciliation_runs_org_idx ON reconciliation_runs(organization_id);
CREATE INDEX IF NOT EXISTS reconciliation_runs_status_idx ON reconciliation_runs(status);
CREATE INDEX IF NOT EXISTS reconciliation_runs_period_idx ON reconciliation_runs(period_start, period_end);

-- Reconciliation Matches
CREATE INDEX IF NOT EXISTS reconciliation_matches_run_idx ON reconciliation_matches(run_id);
CREATE INDEX IF NOT EXISTS reconciliation_matches_source_idx ON reconciliation_matches(source_type, source_id);
CREATE INDEX IF NOT EXISTS reconciliation_matches_target_idx ON reconciliation_matches(target_type, target_id);

-- Reconciliation Exceptions
CREATE INDEX IF NOT EXISTS reconciliation_exceptions_run_idx ON reconciliation_exceptions(run_id);
CREATE INDEX IF NOT EXISTS reconciliation_exceptions_org_idx ON reconciliation_exceptions(organization_id);
CREATE INDEX IF NOT EXISTS reconciliation_exceptions_status_idx ON reconciliation_exceptions(exception_status);
CREATE INDEX IF NOT EXISTS reconciliation_exceptions_type_idx ON reconciliation_exceptions(exception_type);

COMMIT;
