-- PLATFORM_SQL — canonical strike_fund_disbursements table.
--
-- Source: apps/union-eyes/db/schema/domains/finance/taxes.ts
-- strikeFundDisbursements. This file creates the table when it is absent.
-- It does not alter an existing table, invent rows, or replay frozen
-- db/migrations/20260909_strike_fund_disbursements_organization_id.sql.
--
-- organization_id uses ON DELETE CASCADE because taxes.ts and the frozen
-- historical statement already declare that action. UE_V2_FINANCIAL_SCOPE_AUTHORITY
-- still records strike_fund_disbursements as NOT_PROVEN, so this statement
-- is not a retention decision and does not change a constraint that already
-- exists.
--
-- The provenance statement runs later and owns payment-date attribution.

CREATE TABLE IF NOT EXISTS public.strike_fund_disbursements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(255) NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  strike_id uuid,
  strike_name text,
  strike_start_date timestamp,
  strike_end_date timestamp,
  payment_date timestamp NOT NULL,
  payment_amount numeric(10, 2) NOT NULL,
  payment_method varchar(50) NOT NULL,
  payment_reference varchar(100),
  tax_year varchar(4) NOT NULL,
  tax_month varchar(2) NOT NULL,
  week_number varchar(10) NOT NULL,
  weekly_total numeric(10, 2) NOT NULL,
  exceeds_threshold boolean NOT NULL DEFAULT false,
  requires_tax_slip boolean NOT NULL DEFAULT false,
  t4a_generated boolean NOT NULL DEFAULT false,
  t4a_generated_at timestamp,
  rl1_generated boolean NOT NULL DEFAULT false,
  rl1_generated_at timestamp,
  province varchar(2) NOT NULL,
  is_quebec_resident boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
