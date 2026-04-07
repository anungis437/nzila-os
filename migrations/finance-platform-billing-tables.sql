all-- ============================================================================
-- Finance Platform Billing Migration
-- Creates all missing Layer 1-3 finance tables for DAPL
-- Tables: billing_accounts, subscription_plans, org_subscriptions,
--         billing_periods, platform_invoices, platform_invoice_line_items,
--         platform_payments, payment_allocations, billing_adjustments,
--         billing_terms, platform_cost_ledger_entries,
--         allocation_rules, allocation_rule_versions, allocation_runs,
--         allocation_run_lines, allocation_basis_snapshots,
--         chargeback_statements
-- ============================================================================

BEGIN;

-- ============================================================================
-- ENUMS (Layer 1 — Platform Billing)
-- ============================================================================

CREATE TYPE billing_account_status AS ENUM (
  'active', 'suspended', 'closed', 'pending'
);

CREATE TYPE subscription_status AS ENUM (
  'active', 'trialing', 'past_due', 'cancelled', 'paused'
);

CREATE TYPE platform_invoice_status AS ENUM (
  'draft', 'issued', 'paid', 'partially_paid', 'overdue', 'void', 'written_off'
);

CREATE TYPE platform_payment_status AS ENUM (
  'pending', 'processing', 'completed', 'failed', 'refunded'
);

CREATE TYPE billing_adjustment_type AS ENUM (
  'credit', 'debit', 'write_off', 'subsidy', 'discount', 'refund'
);

CREATE TYPE pricing_model AS ENUM (
  'flat', 'per_local', 'per_seat', 'per_module', 'tiered', 'hybrid'
);

-- ============================================================================
-- ENUMS (Layer 2 — Platform Ledger)
-- ============================================================================

CREATE TYPE platform_cost_type AS ENUM (
  'base_subscription', 'local_fee', 'seat_fee', 'module_fee',
  'usage_fee', 'onboarding_fee', 'support_fee', 'transaction_fee',
  'settlement', 'adjustment', 'credit', 'subsidy', 'writeoff'
);

CREATE TYPE ledger_event_type AS ENUM (
  'invoice_generated', 'payment_received', 'allocation_run',
  'adjustment_posted', 'credit_applied', 'subsidy_applied',
  'writeoff_posted', 'period_closed', 'reversal', 'fee_captured',
  'settlement_closed'
);

CREATE TYPE ledger_source_type AS ENUM (
  'subscription', 'invoice', 'payment', 'adjustment',
  'allocation', 'manual', 'system', 'transaction_fee',
  'settlement_batch'
);

CREATE TYPE allocation_status AS ENUM (
  'unallocated', 'pending', 'allocated', 'partially_allocated', 'reversed'
);

-- ============================================================================
-- ENUMS (Layer 3 — Allocation Engine)
-- ============================================================================

CREATE TYPE allocation_method AS ENUM (
  'per_member_count', 'per_active_user', 'per_case_volume',
  'per_local_flat', 'weighted_hybrid', 'manual_override', 'subsidized'
);

CREATE TYPE allocation_run_status AS ENUM (
  'draft', 'simulated', 'pending_approval', 'approved',
  'posted', 'reversed', 'failed'
);

CREATE TYPE chargeback_status AS ENUM (
  'draft', 'issued', 'acknowledged', 'disputed', 'resolved'
);

-- ============================================================================
-- LAYER 1: PLATFORM BILLING TABLES
-- ============================================================================

CREATE TABLE billing_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE RESTRICT,
  display_name VARCHAR(255) NOT NULL,
  billing_email VARCHAR(320) NOT NULL,
  billing_contact_name VARCHAR(255),
  billing_phone VARCHAR(30),
  billing_address JSONB,
  tax_id VARCHAR(50),
  currency VARCHAR(3) NOT NULL DEFAULT 'CAD',
  status billing_account_status NOT NULL DEFAULT 'active',
  net_terms_days INTEGER NOT NULL DEFAULT 30,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by VARCHAR(255)
);
CREATE UNIQUE INDEX billing_accounts_org_idx ON billing_accounts(organization_id);
CREATE INDEX billing_accounts_status_idx ON billing_accounts(status);

CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  pricing_model pricing_model NOT NULL,
  base_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  per_local_fee DECIMAL(10,2) DEFAULT 0,
  per_seat_fee DECIMAL(10,2) DEFAULT 0,
  per_module_fee DECIMAL(10,2) DEFAULT 0,
  onboarding_fee DECIMAL(10,2) DEFAULT 0,
  support_fee DECIMAL(10,2) DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'CAD',
  billing_interval VARCHAR(20) NOT NULL DEFAULT 'monthly',
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE org_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id UUID NOT NULL REFERENCES billing_accounts(id) ON DELETE RESTRICT,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  status subscription_status NOT NULL DEFAULT 'active',
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  trial_end_date TIMESTAMPTZ,
  local_count INTEGER DEFAULT 0,
  seat_count INTEGER DEFAULT 0,
  module_list JSONB DEFAULT '[]',
  discount_percent DECIMAL(5,2) DEFAULT 0,
  subsidy_amount DECIMAL(12,2) DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by VARCHAR(255)
);
CREATE INDEX org_subscriptions_billing_idx ON org_subscriptions(billing_account_id);
CREATE INDEX org_subscriptions_org_idx ON org_subscriptions(organization_id);
CREATE INDEX org_subscriptions_status_idx ON org_subscriptions(status);

CREATE TABLE billing_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  label VARCHAR(50) NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  closed_at TIMESTAMPTZ,
  closed_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX billing_periods_org_label_idx ON billing_periods(organization_id, label);

CREATE TABLE platform_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id UUID NOT NULL REFERENCES billing_accounts(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  billing_period_id UUID REFERENCES billing_periods(id) ON DELETE RESTRICT,
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  issue_date TIMESTAMPTZ NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  subtotal DECIMAL(14,2) NOT NULL,
  tax_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(14,2) NOT NULL,
  amount_paid DECIMAL(14,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'CAD',
  status platform_invoice_status NOT NULL DEFAULT 'draft',
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by VARCHAR(255)
);
CREATE INDEX platform_invoices_org_idx ON platform_invoices(organization_id);
CREATE INDEX platform_invoices_billing_acct_idx ON platform_invoices(billing_account_id);
CREATE INDEX platform_invoices_status_idx ON platform_invoices(status);
CREATE INDEX platform_invoices_period_idx ON platform_invoices(billing_period_id);

CREATE TABLE platform_invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES platform_invoices(id) ON DELETE CASCADE,
  description VARCHAR(500) NOT NULL,
  cost_type VARCHAR(50) NOT NULL,
  quantity DECIMAL(12,4) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'CAD',
  ledger_entry_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX platform_line_items_invoice_idx ON platform_invoice_line_items(invoice_id);

CREATE TABLE platform_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id UUID NOT NULL REFERENCES billing_accounts(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  amount DECIMAL(14,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'CAD',
  status platform_payment_status NOT NULL DEFAULT 'pending',
  method VARCHAR(50) NOT NULL,
  external_reference VARCHAR(255),
  paid_at TIMESTAMPTZ,
  failure_reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by VARCHAR(255)
);
CREATE INDEX platform_payments_org_idx ON platform_payments(organization_id);
CREATE INDEX platform_payments_billing_acct_idx ON platform_payments(billing_account_id);
CREATE INDEX platform_payments_status_idx ON platform_payments(status);

CREATE TABLE payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES platform_payments(id) ON DELETE RESTRICT,
  invoice_id UUID NOT NULL REFERENCES platform_invoices(id) ON DELETE RESTRICT,
  amount DECIMAL(14,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by VARCHAR(255)
);
CREATE INDEX payment_allocations_payment_idx ON payment_allocations(payment_id);
CREATE INDEX payment_allocations_invoice_idx ON payment_allocations(invoice_id);

CREATE TABLE billing_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id UUID NOT NULL REFERENCES billing_accounts(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  invoice_id UUID REFERENCES platform_invoices(id) ON DELETE RESTRICT,
  type billing_adjustment_type NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'CAD',
  reason TEXT NOT NULL,
  effective_date TIMESTAMPTZ NOT NULL,
  approved_by VARCHAR(255),
  ledger_entry_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by VARCHAR(255)
);
CREATE INDEX billing_adjustments_org_idx ON billing_adjustments(organization_id);
CREATE INDEX billing_adjustments_billing_acct_idx ON billing_adjustments(billing_account_id);

CREATE TABLE billing_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  due_days INTEGER NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_days INTEGER DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- LAYER 2: PLATFORM COST LEDGER
-- ============================================================================

CREATE TABLE platform_cost_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  parent_organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT,
  local_id UUID,
  employer_id UUID,
  region_id UUID,
  bargaining_unit_id UUID,
  billing_period_id UUID REFERENCES billing_periods(id) ON DELETE RESTRICT,
  cost_type platform_cost_type NOT NULL,
  event_type ledger_event_type NOT NULL,
  source_type ledger_source_type NOT NULL,
  source_id UUID,
  quantity DECIMAL(12,4) NOT NULL DEFAULT 1,
  unit_price_cad DECIMAL(12,2) NOT NULL,
  amount_cad DECIMAL(14,2) NOT NULL,
  cost_center_id UUID REFERENCES cost_centers(id) ON DELETE RESTRICT,
  allocation_status allocation_status NOT NULL DEFAULT 'unallocated',
  allocation_run_id UUID,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by VARCHAR(255),
  audit_reference VARCHAR(255)
);
CREATE INDEX pcle_org_idx ON platform_cost_ledger_entries(organization_id);
CREATE INDEX pcle_period_idx ON platform_cost_ledger_entries(billing_period_id);
CREATE INDEX pcle_cost_type_idx ON platform_cost_ledger_entries(cost_type);
CREATE INDEX pcle_event_type_idx ON platform_cost_ledger_entries(event_type);
CREATE INDEX pcle_source_idx ON platform_cost_ledger_entries(source_type, source_id);
CREATE INDEX pcle_allocation_idx ON platform_cost_ledger_entries(allocation_status);
CREATE INDEX pcle_created_idx ON platform_cost_ledger_entries(created_at);
CREATE INDEX pcle_local_idx ON platform_cost_ledger_entries(local_id);

-- ============================================================================
-- LAYER 3: ALLOCATION ENGINE
-- ============================================================================

CREATE TABLE allocation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by VARCHAR(255)
);
CREATE INDEX allocation_rules_org_idx ON allocation_rules(organization_id);

CREATE TABLE allocation_rule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES allocation_rules(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  method allocation_method NOT NULL,
  weights JSONB,
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,
  approved_by VARCHAR(255),
  approved_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by VARCHAR(255)
);
CREATE INDEX arv_rule_idx ON allocation_rule_versions(rule_id);
CREATE INDEX arv_effective_idx ON allocation_rule_versions(effective_from, effective_to);

CREATE TABLE allocation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  billing_period_id UUID NOT NULL REFERENCES billing_periods(id) ON DELETE RESTRICT,
  rule_version_id UUID NOT NULL REFERENCES allocation_rule_versions(id) ON DELETE RESTRICT,
  status allocation_run_status NOT NULL DEFAULT 'draft',
  is_simulation BOOLEAN NOT NULL DEFAULT false,
  total_amount DECIMAL(14,2) NOT NULL,
  line_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  approved_by VARCHAR(255),
  approved_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by VARCHAR(255)
);
CREATE INDEX allocation_runs_org_idx ON allocation_runs(organization_id);
CREATE INDEX allocation_runs_period_idx ON allocation_runs(billing_period_id);
CREATE INDEX allocation_runs_status_idx ON allocation_runs(status);

CREATE TABLE allocation_run_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES allocation_runs(id) ON DELETE CASCADE,
  local_id UUID NOT NULL,
  local_name VARCHAR(255),
  method allocation_method NOT NULL,
  basis_value DECIMAL(14,4) NOT NULL,
  weight DECIMAL(5,2) NOT NULL,
  allocated_amount DECIMAL(14,2) NOT NULL,
  cost_type VARCHAR(50) NOT NULL,
  ledger_entry_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX arl_run_idx ON allocation_run_lines(run_id);
CREATE INDEX arl_local_idx ON allocation_run_lines(local_id);

CREATE TABLE allocation_basis_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES allocation_runs(id) ON DELETE CASCADE,
  local_id UUID NOT NULL,
  member_count INTEGER NOT NULL DEFAULT 0,
  active_user_count INTEGER NOT NULL DEFAULT 0,
  case_volume INTEGER NOT NULL DEFAULT 0,
  remittance_summary DECIMAL(14,2) DEFAULT 0,
  metadata JSONB,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX abs_run_idx ON allocation_basis_snapshots(run_id);
CREATE INDEX abs_local_idx ON allocation_basis_snapshots(local_id);

CREATE TABLE chargeback_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  local_id UUID NOT NULL,
  billing_period_id UUID NOT NULL REFERENCES billing_periods(id) ON DELETE RESTRICT,
  allocation_run_id UUID NOT NULL REFERENCES allocation_runs(id) ON DELETE RESTRICT,
  total_amount DECIMAL(14,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'CAD',
  status chargeback_status NOT NULL DEFAULT 'draft',
  issued_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by VARCHAR(255),
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by VARCHAR(255)
);
CREATE INDEX chargeback_org_idx ON chargeback_statements(organization_id);
CREATE INDEX chargeback_local_idx ON chargeback_statements(local_id);
CREATE INDEX chargeback_period_idx ON chargeback_statements(billing_period_id);

COMMIT;
