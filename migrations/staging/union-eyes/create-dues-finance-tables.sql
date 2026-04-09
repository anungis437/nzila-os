-- ============================================================================
-- Dues & Finance Tables — Create + Seed
-- Tables defined in: apps/union-eyes/db/schema/dues-finance-schema.ts
-- ============================================================================

BEGIN;

-- ── member_dues_ledger ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS member_dues_ledger (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL,
  organization_id         uuid NOT NULL,
  transaction_type        text NOT NULL,         -- charge, payment, credit, adjustment, write_off
  transaction_date        timestamptz NOT NULL DEFAULT now(),
  effective_date          timestamptz NOT NULL,
  amount                  numeric(10,2) NOT NULL,
  balance_before          numeric(10,2) NOT NULL,
  balance_after           numeric(10,2) NOT NULL,
  period_start            timestamptz,
  period_end              timestamptz,
  fiscal_year             int,
  fiscal_month            int,
  reference_type          text,
  reference_id            uuid,
  invoice_number          text,
  receipt_number          text,
  payment_method          text,
  payment_reference       text,
  description             text NOT NULL,
  notes                   text,
  is_reversed             boolean DEFAULT false,
  reversal_id             uuid,
  reversed_transaction_id uuid,
  status                  text NOT NULL DEFAULT 'posted',
  metadata                jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  created_by              text
);

CREATE INDEX IF NOT EXISTS idx_mdl_org ON member_dues_ledger(organization_id);
CREATE INDEX IF NOT EXISTS idx_mdl_user ON member_dues_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_mdl_txdate ON member_dues_ledger(transaction_date);

-- ── member_arrears ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS member_arrears (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL UNIQUE,
  organization_id     uuid NOT NULL,
  total_owed          numeric(10,2) NOT NULL DEFAULT 0,
  over_30_days        numeric(10,2) DEFAULT 0,
  over_60_days        numeric(10,2) DEFAULT 0,
  over_90_days        numeric(10,2) DEFAULT 0,
  in_grace_period     boolean DEFAULT false,
  grace_period_ends   timestamptz,
  arrears_status      text NOT NULL DEFAULT 'current',
  first_arrears_date  timestamptz,
  last_payment_date   timestamptz,
  suspension_date     timestamptz,
  reinstatement_date  timestamptz,
  has_payment_plan    boolean DEFAULT false,
  payment_plan_id     uuid,
  metadata            jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  last_calculated_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ma_org ON member_arrears(organization_id);
CREATE INDEX IF NOT EXISTS idx_ma_status ON member_arrears(arrears_status);

-- ── employer_remittances ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employer_remittances (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id          uuid NOT NULL,
  organization_id      uuid NOT NULL,
  period_start         timestamptz NOT NULL,
  period_end           timestamptz NOT NULL,
  fiscal_year          int NOT NULL,
  fiscal_month         int NOT NULL,
  remittance_date      timestamptz NOT NULL,
  remittance_number    text,
  total_amount         numeric(12,2) NOT NULL,
  member_count         int NOT NULL,
  file_name            text,
  file_url             text,
  file_hash            text,
  processing_status    text NOT NULL DEFAULT 'pending',
  processed_at         timestamptz,
  processed_by         text,
  records_total        int,
  records_processed    int,
  records_matched      int,
  records_exception    int,
  expected_amount      numeric(12,2),
  variance             numeric(12,2),
  is_reconciled        boolean DEFAULT false,
  reconciled_at        timestamptz,
  reconciled_by        text,
  notes                text,
  metadata             jsonb,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  created_by           text,
  last_modified_by     text
);

CREATE INDEX IF NOT EXISTS idx_er_org ON employer_remittances(organization_id);

-- ── remittance_line_items ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS remittance_line_items (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  remittance_id           uuid NOT NULL,
  organization_id         uuid NOT NULL,
  employee_number         text,
  employee_name           text,
  employment_type         text,
  user_id                 uuid,
  match_confidence        int,
  match_method            text,
  amount                  numeric(10,2) NOT NULL,
  period_start            timestamptz,
  period_end              timestamptz,
  line_status             text NOT NULL DEFAULT 'pending',
  exception_reason        text,
  resolved_at             timestamptz,
  resolved_by             text,
  resolution_notes        text,
  ledger_transaction_id   uuid,
  metadata                jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rli_org ON remittance_line_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_rli_remittance ON remittance_line_items(remittance_id);

-- ── remittance_exceptions ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS remittance_exceptions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  remittance_id       uuid NOT NULL,
  line_item_id        uuid,
  organization_id     uuid NOT NULL,
  exception_type      text NOT NULL,
  severity            text NOT NULL DEFAULT 'medium',
  employee_number     text,
  employee_name       text,
  amount              numeric(10,2),
  expected_amount     numeric(10,2),
  description         text NOT NULL,
  details             jsonb,
  status              text NOT NULL DEFAULT 'open',
  assigned_to         text,
  priority            int DEFAULT 3,
  resolved_at         timestamptz,
  resolved_by         text,
  resolution_action   text,
  resolution_notes    text,
  metadata            jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ── payment_plans ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_plans (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL,
  organization_id         uuid NOT NULL,
  plan_name               text NOT NULL,
  total_owed              numeric(10,2) NOT NULL,
  installment_amount      numeric(10,2) NOT NULL,
  installment_count       int NOT NULL,
  frequency               text NOT NULL DEFAULT 'monthly',
  start_date              timestamptz NOT NULL,
  end_date                timestamptz,
  installments_paid       int DEFAULT 0,
  total_paid              numeric(10,2) DEFAULT 0,
  remaining_balance       numeric(10,2) NOT NULL,
  status                  text NOT NULL DEFAULT 'active',
  last_payment_date       timestamptz,
  next_payment_due        timestamptz NOT NULL,
  agreement_accepted_at   timestamptz,
  agreement_accepted_by   text,
  terms_url               text,
  metadata                jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  created_by              text,
  last_modified_by        text
);

-- ── financial_periods ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS financial_periods (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL,
  local_id         uuid,
  fiscal_year      int NOT NULL,
  fiscal_month     int NOT NULL,
  period_start     timestamptz NOT NULL,
  period_end       timestamptz NOT NULL,
  status           text NOT NULL DEFAULT 'open',
  closed_at        timestamptz,
  closed_by        text,
  locked_at        timestamptz,
  locked_by        text,
  total_revenue    numeric(12,2),
  total_arrears    numeric(12,2),
  member_count     int,
  metadata         jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ── payroll_deductions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_deductions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          uuid NOT NULL,
  user_id                  uuid NOT NULL,
  employer_id              uuid NOT NULL,
  pay_period_start         timestamptz NOT NULL,
  pay_period_end           timestamptz NOT NULL,
  gross_pay                numeric(12,2),
  net_pay                  numeric(12,2),
  union_dues_amount        numeric(10,2) NOT NULL,
  other_deductions         jsonb,
  source                   text NOT NULL DEFAULT 'remittance',
  remittance_line_item_id  uuid,
  verified                 boolean DEFAULT false,
  verified_at              timestamptz,
  verified_by              text,
  metadata                 jsonb,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- ── member_dues_issues ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS member_dues_issues (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL,
  user_id               uuid NOT NULL,
  issue_type            text NOT NULL,
  subject               text NOT NULL,
  description           text NOT NULL,
  payroll_deduction_id  uuid,
  pay_period_start      timestamptz,
  pay_period_end        timestamptz,
  expected_amount       numeric(10,2),
  actual_amount         numeric(10,2),
  status                text NOT NULL DEFAULT 'open',
  priority              int DEFAULT 3,
  assigned_to           text,
  resolved_at           timestamptz,
  resolved_by           text,
  resolution_type       text,
  resolution_notes      text,
  metadata              jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ── dues_policies ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dues_policies (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL,
  local_id            uuid,
  policy_name         text NOT NULL,
  policy_type         text NOT NULL,
  description         text,
  flat_amount         numeric(10,2),
  percentage_rate     numeric(5,4),
  tier_rules          jsonb,
  formula_expression  text,
  employment_types    text,
  classifications     text,
  effective_from      timestamptz NOT NULL,
  effective_to        timestamptz,
  status              text NOT NULL DEFAULT 'active',
  metadata            jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          text,
  last_modified_by    text
);

COMMIT;

-- ============================================================================
-- SEED DATA — Realistic 12-month financial history for CUPE Local 123
-- ============================================================================

BEGIN;

-- ── Variables ──
-- CUPE Local 123:  9210418f-6a4f-4dab-a7d2-4450d581dc81
-- City of Toronto employer (synthetic): e0000001-0000-0000-0000-000000000001
-- Monthly dues: $85.50/member
-- Per capita to CUPE National: $15.75/member/month

-- ── Dues Policy ─────────────────────────────────────────────────────────────
INSERT INTO dues_policies (id, organization_id, policy_name, policy_type, flat_amount, effective_from, description)
VALUES (
  'pol-00000-0001-0000-0000-000000000001',
  '9210418f-6a4f-4dab-a7d2-4450d581dc81',
  'Standard Monthly Dues',
  'flat_rate',
  85.50,
  '2025-01-01',
  'Regular monthly union dues for all full-time and part-time members — City of Toronto bargaining unit'
) ON CONFLICT DO NOTHING;

-- ── Helper: Generate 12 months of employer remittances (May 2025 → Apr 2026) ──
-- Employer: City of Toronto (synthetic UUID)
INSERT INTO employer_remittances (
  id, employer_id, organization_id,
  period_start, period_end, fiscal_year, fiscal_month,
  remittance_date, remittance_number, total_amount, member_count,
  expected_amount, variance,
  processing_status, is_reconciled, reconciled_at,
  records_total, records_processed, records_matched, records_exception,
  created_at
)
VALUES
  -- May 2025 — 18 members
  ('rem-00001-0000-0000-0000-000000000001','e0000001-0000-0000-0000-000000000001','9210418f-6a4f-4dab-a7d2-4450d581dc81',
   '2025-05-01','2025-05-31',2025,5,'2025-06-05','REM-2025-05-123',1539.00,18,1539.00,0.00,
   'completed',true,'2025-06-08',18,18,18,0,'2025-06-05'),
  -- Jun 2025
  ('rem-00002-0000-0000-0000-000000000001','e0000001-0000-0000-0000-000000000001','9210418f-6a4f-4dab-a7d2-4450d581dc81',
   '2025-06-01','2025-06-30',2025,6,'2025-07-04','REM-2025-06-123',1539.00,18,1539.00,0.00,
   'completed',true,'2025-07-07',18,18,18,0,'2025-07-04'),
  -- Jul 2025 — 19 members (new hire)
  ('rem-00003-0000-0000-0000-000000000001','e0000001-0000-0000-0000-000000000001','9210418f-6a4f-4dab-a7d2-4450d581dc81',
   '2025-07-01','2025-07-31',2025,7,'2025-08-05','REM-2025-07-123',1624.50,19,1624.50,0.00,
   'completed',true,'2025-08-08',19,19,19,0,'2025-08-05'),
  -- Aug 2025
  ('rem-00004-0000-0000-0000-000000000001','e0000001-0000-0000-0000-000000000001','9210418f-6a4f-4dab-a7d2-4450d581dc81',
   '2025-08-01','2025-08-31',2025,8,'2025-09-04','REM-2025-08-123',1624.50,19,1624.50,0.00,
   'completed',true,'2025-09-07',19,19,19,0,'2025-09-04'),
  -- Sep 2025 — 20 members
  ('rem-00005-0000-0000-0000-000000000001','e0000001-0000-0000-0000-000000000001','9210418f-6a4f-4dab-a7d2-4450d581dc81',
   '2025-09-01','2025-09-30',2025,9,'2025-10-03','REM-2025-09-123',1710.00,20,1710.00,0.00,
   'completed',true,'2025-10-06',20,20,20,0,'2025-10-03'),
  -- Oct 2025 — variance: employer short $85.50 (missed 1 member)
  ('rem-00006-0000-0000-0000-000000000001','e0000001-0000-0000-0000-000000000001','9210418f-6a4f-4dab-a7d2-4450d581dc81',
   '2025-10-01','2025-10-31',2025,10,'2025-11-05','REM-2025-10-123',1624.50,19,1710.00,85.50,
   'completed',true,'2025-11-10',19,19,18,1,'2025-11-05'),
  -- Nov 2025 — back to 20
  ('rem-00007-0000-0000-0000-000000000001','e0000001-0000-0000-0000-000000000001','9210418f-6a4f-4dab-a7d2-4450d581dc81',
   '2025-11-01','2025-11-30',2025,11,'2025-12-04','REM-2025-11-123',1710.00,20,1710.00,0.00,
   'completed',true,'2025-12-07',20,20,20,0,'2025-12-04'),
  -- Dec 2025
  ('rem-00008-0000-0000-0000-000000000001','e0000001-0000-0000-0000-000000000001','9210418f-6a4f-4dab-a7d2-4450d581dc81',
   '2025-12-01','2025-12-31',2025,12,'2026-01-06','REM-2025-12-123',1710.00,20,1710.00,0.00,
   'completed',true,'2026-01-09',20,20,20,0,'2026-01-06'),
  -- Jan 2026 — 21 members
  ('rem-00009-0000-0000-0000-000000000001','e0000001-0000-0000-0000-000000000001','9210418f-6a4f-4dab-a7d2-4450d581dc81',
   '2026-01-01','2026-01-31',2026,1,'2026-02-04','REM-2026-01-123',1795.50,21,1795.50,0.00,
   'completed',true,'2026-02-07',21,21,21,0,'2026-02-04'),
  -- Feb 2026
  ('rem-00010-0000-0000-0000-000000000001','e0000001-0000-0000-0000-000000000001','9210418f-6a4f-4dab-a7d2-4450d581dc81',
   '2026-02-01','2026-02-28',2026,2,'2026-03-05','REM-2026-02-123',1795.50,21,1795.50,0.00,
   'completed',true,'2026-03-08',21,21,21,0,'2026-03-05'),
  -- Mar 2026 — reconciled
  ('rem-00011-0000-0000-0000-000000000001','e0000001-0000-0000-0000-000000000001','9210418f-6a4f-4dab-a7d2-4450d581dc81',
   '2026-03-01','2026-03-31',2026,3,'2026-04-03','REM-2026-03-123',1795.50,21,1795.50,0.00,
   'completed',true,'2026-04-06',21,21,21,0,'2026-04-03'),
  -- Apr 2026 — pending reconciliation (current month)
  ('rem-00012-0000-0000-0000-000000000001','e0000001-0000-0000-0000-000000000001','9210418f-6a4f-4dab-a7d2-4450d581dc81',
   '2026-04-01','2026-04-30',2026,4,'2026-04-07','REM-2026-04-123',1795.50,21,1795.50,0.00,
   'pending',false,NULL,21,0,0,0,'2026-04-07')
ON CONFLICT DO NOTHING;

-- ── Member Dues Ledger: charges + payments per member per month ─────────────
-- We seed 3 months (Feb, Mar, Apr 2026) of ledger data for the 21 members
-- to demonstrate realistic volume. Using the org members we know about.

-- Generate charges for Feb 2026 (21 members × $85.50)
INSERT INTO member_dues_ledger (
  organization_id, user_id, transaction_type, transaction_date, effective_date,
  amount, balance_before, balance_after,
  period_start, period_end, fiscal_year, fiscal_month,
  description, status, payment_method
)
SELECT 
  '9210418f-6a4f-4dab-a7d2-4450d581dc81',
  om.user_id::uuid,
  'charge',
  '2026-02-01'::timestamptz,
  '2026-02-01'::timestamptz,
  85.50, 0.00, 85.50,
  '2026-02-01','2026-02-28', 2026, 2,
  'Monthly dues — February 2026',
  'posted', NULL
FROM organization_members om
WHERE om.organization_id = '9210418f-6a4f-4dab-a7d2-4450d581dc81'
ON CONFLICT DO NOTHING;

-- Payments for Feb 2026 (all paid via employer remittance)
INSERT INTO member_dues_ledger (
  organization_id, user_id, transaction_type, transaction_date, effective_date,
  amount, balance_before, balance_after,
  period_start, period_end, fiscal_year, fiscal_month,
  description, status, payment_method, payment_reference
)
SELECT 
  '9210418f-6a4f-4dab-a7d2-4450d581dc81',
  om.user_id::uuid,
  'payment',
  '2026-03-05'::timestamptz,
  '2026-02-01'::timestamptz,
  -85.50, 85.50, 0.00,
  '2026-02-01','2026-02-28', 2026, 2,
  'Payment received — employer remittance REM-2026-02-123',
  'posted', 'employer_remittance', 'REM-2026-02-123'
FROM organization_members om
WHERE om.organization_id = '9210418f-6a4f-4dab-a7d2-4450d581dc81'
ON CONFLICT DO NOTHING;

-- Charges for Mar 2026
INSERT INTO member_dues_ledger (
  organization_id, user_id, transaction_type, transaction_date, effective_date,
  amount, balance_before, balance_after,
  period_start, period_end, fiscal_year, fiscal_month,
  description, status, payment_method
)
SELECT 
  '9210418f-6a4f-4dab-a7d2-4450d581dc81',
  om.user_id::uuid,
  'charge',
  '2026-03-01'::timestamptz,
  '2026-03-01'::timestamptz,
  85.50, 0.00, 85.50,
  '2026-03-01','2026-03-31', 2026, 3,
  'Monthly dues — March 2026',
  'posted', NULL
FROM organization_members om
WHERE om.organization_id = '9210418f-6a4f-4dab-a7d2-4450d581dc81'
ON CONFLICT DO NOTHING;

-- Payments for Mar 2026
INSERT INTO member_dues_ledger (
  organization_id, user_id, transaction_type, transaction_date, effective_date,
  amount, balance_before, balance_after,
  period_start, period_end, fiscal_year, fiscal_month,
  description, status, payment_method, payment_reference
)
SELECT 
  '9210418f-6a4f-4dab-a7d2-4450d581dc81',
  om.user_id::uuid,
  'payment',
  '2026-04-03'::timestamptz,
  '2026-03-01'::timestamptz,
  -85.50, 85.50, 0.00,
  '2026-03-01','2026-03-31', 2026, 3,
  'Payment received — employer remittance REM-2026-03-123',
  'posted', 'employer_remittance', 'REM-2026-03-123'
FROM organization_members om
WHERE om.organization_id = '9210418f-6a4f-4dab-a7d2-4450d581dc81'
ON CONFLICT DO NOTHING;

-- Charges for Apr 2026 (current month — all pending)
INSERT INTO member_dues_ledger (
  organization_id, user_id, transaction_type, transaction_date, effective_date,
  amount, balance_before, balance_after,
  period_start, period_end, fiscal_year, fiscal_month,
  description, status, payment_method
)
SELECT 
  '9210418f-6a4f-4dab-a7d2-4450d581dc81',
  om.user_id::uuid,
  'charge',
  '2026-04-01'::timestamptz,
  '2026-04-01'::timestamptz,
  85.50, 0.00, 85.50,
  '2026-04-01','2026-04-30', 2026, 4,
  'Monthly dues — April 2026',
  'pending', NULL
FROM organization_members om
WHERE om.organization_id = '9210418f-6a4f-4dab-a7d2-4450d581dc81'
ON CONFLICT DO NOTHING;

-- ── Member Arrears: 3 members behind ────────────────────────────────────────
-- Fatima Al-Rashid: 2 months behind, on payment plan
INSERT INTO member_arrears (user_id, organization_id, total_owed, over_30_days, over_60_days, arrears_status, first_arrears_date, last_payment_date, has_payment_plan)
VALUES ('usr-l123-006'::uuid, '9210418f-6a4f-4dab-a7d2-4450d581dc81', 171.00, 85.50, 85.50, 'warning', '2026-02-15', '2026-01-05', true)
ON CONFLICT (user_id) DO NOTHING;

-- Carlos Vega: 3 months behind, no plan
INSERT INTO member_arrears (user_id, organization_id, total_owed, over_30_days, over_60_days, over_90_days, arrears_status, first_arrears_date, last_payment_date, has_payment_plan)
VALUES ('usr-l123-009'::uuid, '9210418f-6a4f-4dab-a7d2-4450d581dc81', 256.50, 85.50, 85.50, 85.50, 'suspended', '2026-01-10', '2025-12-20', false)
ON CONFLICT (user_id) DO NOTHING;

-- Liam Chen: 1 month behind, grace period
INSERT INTO member_arrears (user_id, organization_id, total_owed, over_30_days, arrears_status, first_arrears_date, last_payment_date, in_grace_period, grace_period_ends)
VALUES ('usr-l123-011'::uuid, '9210418f-6a4f-4dab-a7d2-4450d581dc81', 85.50, 85.50, 'warning', '2026-03-20', '2026-03-01', true, '2026-04-20')
ON CONFLICT (user_id) DO NOTHING;

-- All other members: current (no arrears record needed, but add a few for completeness)
INSERT INTO member_arrears (user_id, organization_id, total_owed, arrears_status, last_payment_date)
VALUES 
  ('user_3BP6Ienqg55Bk54Q8I3K5hh4Mk8'::uuid, '9210418f-6a4f-4dab-a7d2-4450d581dc81', 0, 'current', '2026-04-03'),
  ('user_3BP6IlC0zg9MwHJDDNn7KCcR0MV'::uuid, '9210418f-6a4f-4dab-a7d2-4450d581dc81', 0, 'current', '2026-04-03'),
  ('user_3BSzhdQTA7fsGN5kUPfXJpMTK1O'::uuid, '9210418f-6a4f-4dab-a7d2-4450d581dc81', 0, 'current', '2026-04-03'),
  ('user_3BSzhd4q6moCIlT3PhkWbdiAhtA'::uuid, '9210418f-6a4f-4dab-a7d2-4450d581dc81', 0, 'current', '2026-04-03'),
  ('user_3BSzhpCQGDtA22YfStHM5ksq6pI'::uuid, '9210418f-6a4f-4dab-a7d2-4450d581dc81', 0, 'current', '2026-04-03'),
  ('user_3BSzhk06aD2b1kK5jUuMlmy7vGu'::uuid, '9210418f-6a4f-4dab-a7d2-4450d581dc81', 0, 'current', '2026-04-03')
ON CONFLICT (user_id) DO NOTHING;

-- ── Remittance Line Items for the pending April remittance ──────────────────
INSERT INTO remittance_line_items (
  remittance_id, organization_id, employee_name, amount,
  period_start, period_end, line_status
)
SELECT
  'rem-00012-0000-0000-0000-000000000001',
  '9210418f-6a4f-4dab-a7d2-4450d581dc81',
  om.name,
  85.50,
  '2026-04-01','2026-04-30',
  'pending'
FROM organization_members om
WHERE om.organization_id = '9210418f-6a4f-4dab-a7d2-4450d581dc81'
ON CONFLICT DO NOTHING;

-- ── Financial Periods (closed months + current open) ────────────────────────
INSERT INTO financial_periods (organization_id, fiscal_year, fiscal_month, period_start, period_end, status, total_revenue, total_arrears, member_count, closed_at)
VALUES
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', 2026, 1, '2026-01-01', '2026-01-31', 'closed', 1795.50, 0, 21, '2026-02-10'),
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', 2026, 2, '2026-02-01', '2026-02-28', 'closed', 1795.50, 171.00, 21, '2026-03-10'),
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', 2026, 3, '2026-03-01', '2026-03-31', 'closed', 1795.50, 513.00, 21, '2026-04-05'),
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', 2026, 4, '2026-04-01', '2026-04-30', 'open', NULL, NULL, 21, NULL)
ON CONFLICT DO NOTHING;

-- ── Payment Plan for Fatima Al-Rashid ───────────────────────────────────────
INSERT INTO payment_plans (
  user_id, organization_id, plan_name, total_owed, installment_amount, installment_count,
  frequency, start_date, installments_paid, total_paid, remaining_balance,
  status, next_payment_due, agreement_accepted_at
)
VALUES (
  'usr-l123-006', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
  'Arrears Recovery Plan', 171.00, 42.75, 4,
  'monthly', '2026-03-15', 1, 42.75, 128.25,
  'active', '2026-04-15', '2026-03-10'
) ON CONFLICT DO NOTHING;

COMMIT;
