-- Forward canonical relations required before the 0014 RLS closure.
-- Generated from current Drizzle pgTable exports through drizzle-kit generateMigration.
-- Django models marked "Migrated from drizzle" are not a second DDL source.
-- Existing relations are verified. They are not altered, dropped, or rewritten.
CREATE TEMP TABLE IF NOT EXISTS ue_bootstrap_created_relations (relname text PRIMARY KEY) ON COMMIT DROP;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."delivery_status" AS ENUM('pending', 'sent', 'delivered', 'failed', 'bounced');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'delivery_status'
  ) IS DISTINCT FROM ARRAY['pending', 'sent', 'delivered', 'failed', 'bounced']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.delivery_status';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."case_access_role" AS ENUM('secondary_lro', 'reviewer', 'read_only');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'case_access_role'
  ) IS DISTINCT FROM ARRAY['secondary_lro', 'reviewer', 'read_only']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.case_access_role';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."case_access_status" AS ENUM('active', 'revoked', 'expired');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'case_access_status'
  ) IS DISTINCT FROM ARRAY['active', 'revoked', 'expired']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.case_access_status';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."cba_language" AS ENUM('en', 'fr', 'bilingual');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'cba_language'
  ) IS DISTINCT FROM ARRAY['en', 'fr', 'bilingual']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.cba_language';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."cba_status" AS ENUM('active', 'expired', 'under_negotiation', 'ratified_pending', 'archived');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'cba_status'
  ) IS DISTINCT FROM ARRAY['active', 'expired', 'under_negotiation', 'ratified_pending', 'archived']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.cba_status';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."cba_jurisdiction" AS ENUM('federal', 'ontario', 'bc', 'alberta', 'quebec', 'manitoba', 'saskatchewan', 'nova_scotia', 'new_brunswick', 'pei', 'newfoundland', 'northwest_territories', 'yukon', 'nunavut');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'cba_jurisdiction'
  ) IS DISTINCT FROM ARRAY['federal', 'ontario', 'bc', 'alberta', 'quebec', 'manitoba', 'saskatchewan', 'nova_scotia', 'new_brunswick', 'pei', 'newfoundland', 'northwest_territories', 'yukon', 'nunavut']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.cba_jurisdiction';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."clause_type" AS ENUM('wages_compensation', 'benefits_insurance', 'working_conditions', 'grievance_arbitration', 'seniority_promotion', 'health_safety', 'union_rights', 'management_rights', 'duration_renewal', 'vacation_leave', 'hours_scheduling', 'disciplinary_procedures', 'training_development', 'pension_retirement', 'overtime', 'job_security', 'technological_change', 'workplace_rights', 'other');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'clause_type'
  ) IS DISTINCT FROM ARRAY['wages_compensation', 'benefits_insurance', 'working_conditions', 'grievance_arbitration', 'seniority_promotion', 'health_safety', 'union_rights', 'management_rights', 'duration_renewal', 'vacation_leave', 'hours_scheduling', 'disciplinary_procedures', 'training_development', 'pension_retirement', 'overtime', 'job_security', 'technological_change', 'workplace_rights', 'other']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.clause_type';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."outcome" AS ENUM('grievance_upheld', 'grievance_denied', 'partial_success', 'dismissed', 'withdrawn', 'settled');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'outcome'
  ) IS DISTINCT FROM ARRAY['grievance_upheld', 'grievance_denied', 'partial_success', 'dismissed', 'withdrawn', 'settled']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.outcome';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."cost_center_type" AS ENUM('department', 'project', 'location', 'program', 'fund', 'grant', 'other');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'cost_center_type'
  ) IS DISTINCT FROM ARRAY['department', 'project', 'location', 'program', 'fund', 'grant', 'other']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.cost_center_type';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."contract_line_type" AS ENUM('module_license', 'feature_access', 'usage_quota', 'seat_allocation', 'support_level', 'sla_commitment', 'custom');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'contract_line_type'
  ) IS DISTINCT FROM ARRAY['module_license', 'feature_access', 'usage_quota', 'seat_allocation', 'support_level', 'sla_commitment', 'custom']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.contract_line_type';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."commercial_contract_status" AS ENUM('draft', 'pending_approval', 'active', 'expired', 'terminated', 'superseded');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'commercial_contract_status'
  ) IS DISTINCT FROM ARRAY['draft', 'pending_approval', 'active', 'expired', 'terminated', 'superseded']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.commercial_contract_status';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."org_entitlement_status" AS ENUM('active', 'suspended', 'expired', 'revoked');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'org_entitlement_status'
  ) IS DISTINCT FROM ARRAY['active', 'suspended', 'expired', 'revoked']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.org_entitlement_status';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."subscription_lifecycle_event" AS ENUM('created', 'activated', 'trial_started', 'trial_ending_soon', 'trial_expired', 'trial_converted', 'upgraded', 'downgraded', 'paused', 'resumed', 'payment_failed', 'payment_retried', 'payment_recovered', 'dunning_started', 'dunning_escalated', 'dunning_resolved', 'cancelled', 'expired', 'reactivated', 'renewed');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'subscription_lifecycle_event'
  ) IS DISTINCT FROM ARRAY['created', 'activated', 'trial_started', 'trial_ending_soon', 'trial_expired', 'trial_converted', 'upgraded', 'downgraded', 'paused', 'resumed', 'payment_failed', 'payment_retried', 'payment_recovered', 'dunning_started', 'dunning_escalated', 'dunning_resolved', 'cancelled', 'expired', 'reactivated', 'renewed']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.subscription_lifecycle_event';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."billing_account_status" AS ENUM('active', 'suspended', 'closed', 'pending');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'billing_account_status'
  ) IS DISTINCT FROM ARRAY['active', 'suspended', 'closed', 'pending']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.billing_account_status';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."allocation_status" AS ENUM('unallocated', 'pending', 'allocated', 'partially_allocated', 'reversed');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'allocation_status'
  ) IS DISTINCT FROM ARRAY['unallocated', 'pending', 'allocated', 'partially_allocated', 'reversed']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.allocation_status';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."platform_cost_type" AS ENUM('base_subscription', 'local_fee', 'seat_fee', 'module_fee', 'usage_fee', 'onboarding_fee', 'support_fee', 'transaction_fee', 'settlement', 'adjustment', 'credit', 'subsidy', 'writeoff');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'platform_cost_type'
  ) IS DISTINCT FROM ARRAY['base_subscription', 'local_fee', 'seat_fee', 'module_fee', 'usage_fee', 'onboarding_fee', 'support_fee', 'transaction_fee', 'settlement', 'adjustment', 'credit', 'subsidy', 'writeoff']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.platform_cost_type';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."ledger_event_type" AS ENUM('invoice_generated', 'payment_received', 'allocation_run', 'adjustment_posted', 'credit_applied', 'subsidy_applied', 'writeoff_posted', 'period_closed', 'reversal', 'fee_captured', 'settlement_closed');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'ledger_event_type'
  ) IS DISTINCT FROM ARRAY['invoice_generated', 'payment_received', 'allocation_run', 'adjustment_posted', 'credit_applied', 'subsidy_applied', 'writeoff_posted', 'period_closed', 'reversal', 'fee_captured', 'settlement_closed']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.ledger_event_type';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."ledger_source_type" AS ENUM('subscription', 'invoice', 'payment', 'adjustment', 'allocation', 'manual', 'system', 'transaction_fee', 'settlement_batch');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'ledger_source_type'
  ) IS DISTINCT FROM ARRAY['subscription', 'invoice', 'payment', 'adjustment', 'allocation', 'manual', 'system', 'transaction_fee', 'settlement_batch']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.ledger_source_type';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."allocation_method" AS ENUM('per_member_count', 'per_active_user', 'per_case_volume', 'per_local_flat', 'weighted_hybrid', 'manual_override', 'subsidized');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'allocation_method'
  ) IS DISTINCT FROM ARRAY['per_member_count', 'per_active_user', 'per_case_volume', 'per_local_flat', 'weighted_hybrid', 'manual_override', 'subsidized']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.allocation_method';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."allocation_run_status" AS ENUM('draft', 'simulated', 'pending_approval', 'approved', 'posted', 'reversed', 'failed');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'allocation_run_status'
  ) IS DISTINCT FROM ARRAY['draft', 'simulated', 'pending_approval', 'approved', 'posted', 'reversed', 'failed']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.allocation_run_status';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."chargeback_status" AS ENUM('draft', 'issued', 'acknowledged', 'disputed', 'resolved');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'chargeback_status'
  ) IS DISTINCT FROM ARRAY['draft', 'issued', 'acknowledged', 'disputed', 'resolved']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.chargeback_status';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."fee_adjustment_type" AS ENUM('reversal', 'partial_reversal', 'waiver', 'correction', 'dispute_credit');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'fee_adjustment_type'
  ) IS DISTINCT FROM ARRAY['reversal', 'partial_reversal', 'waiver', 'correction', 'dispute_credit']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.fee_adjustment_type';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."fee_event_status" AS ENUM('captured', 'reversed', 'settled', 'disputed', 'waived');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'fee_event_status'
  ) IS DISTINCT FROM ARRAY['captured', 'reversed', 'settled', 'disputed', 'waived']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.fee_event_status';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."fee_model" AS ENUM('percentage', 'flat', 'hybrid', 'waived', 'subsidized');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'fee_model'
  ) IS DISTINCT FROM ARRAY['percentage', 'flat', 'hybrid', 'waived', 'subsidized']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.fee_model';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."fee_rule_status" AS ENUM('active', 'inactive', 'expired');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'fee_rule_status'
  ) IS DISTINCT FROM ARRAY['active', 'inactive', 'expired']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.fee_rule_status';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."settlement_batch_status" AS ENUM('open', 'closed', 'reconciled');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'settlement_batch_status'
  ) IS DISTINCT FROM ARRAY['open', 'closed', 'reconciled']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.settlement_batch_status';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."covered_org_role" AS ENUM('local', 'division', 'region', 'employer');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'covered_org_role'
  ) IS DISTINCT FROM ARRAY['local', 'division', 'region', 'employer']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.covered_org_role';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."reconciliation_exception_status" AS ENUM('open', 'under_review', 'resolved', 'written_off');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'reconciliation_exception_status'
  ) IS DISTINCT FROM ARRAY['open', 'under_review', 'resolved', 'written_off']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.reconciliation_exception_status';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."reconciliation_exception_type" AS ENUM('unmatched_payment', 'unmatched_invoice', 'amount_discrepancy', 'duplicate_payment', 'missing_fee_event', 'orphaned_refund');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'reconciliation_exception_type'
  ) IS DISTINCT FROM ARRAY['unmatched_payment', 'unmatched_invoice', 'amount_discrepancy', 'duplicate_payment', 'missing_fee_event', 'orphaned_refund']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.reconciliation_exception_type';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."reconciliation_match_type" AS ENUM('invoice_payment', 'fee_settlement', 'refund_reversal', 'adjustment_credit');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'reconciliation_match_type'
  ) IS DISTINCT FROM ARRAY['invoice_payment', 'fee_settlement', 'refund_reversal', 'adjustment_credit']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.reconciliation_match_type';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."reconciliation_run_status" AS ENUM('running', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'reconciliation_run_status'
  ) IS DISTINCT FROM ARRAY['running', 'completed', 'failed']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.reconciliation_run_status';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."document_grant_status" AS ENUM('active', 'revoked', 'expired');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'document_grant_status'
  ) IS DISTINCT FROM ARRAY['active', 'revoked', 'expired']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.document_grant_status';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."document_linked_entity_type" AS ENUM('case', 'grievance', 'member', 'policy_library', 'template_library', 'collective_agreement', 'other');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'document_linked_entity_type'
  ) IS DISTINCT FROM ARRAY['case', 'grievance', 'member', 'policy_library', 'template_library', 'collective_agreement', 'other']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.document_linked_entity_type';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."correspondence_audit_event" AS ENUM('created', 'edited', 'submitted_for_review', 'review_requested', 'approved', 'revision_requested', 'signed', 'signature_affixed', 'dispatched', 'delivered', 'returned', 'cancelled', 'recipient_added', 'recipient_removed', 'attachment_added', 'attachment_removed', 'template_applied', 'reassigned', 'viewed');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'correspondence_audit_event'
  ) IS DISTINCT FROM ARRAY['created', 'edited', 'submitted_for_review', 'review_requested', 'approved', 'revision_requested', 'signed', 'signature_affixed', 'dispatched', 'delivered', 'returned', 'cancelled', 'recipient_added', 'recipient_removed', 'attachment_added', 'attachment_removed', 'template_applied', 'reassigned', 'viewed']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.correspondence_audit_event';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."correspondence_priority" AS ENUM('low', 'normal', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'correspondence_priority'
  ) IS DISTINCT FROM ARRAY['low', 'normal', 'high', 'urgent']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.correspondence_priority';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."correspondence_status" AS ENUM('draft', 'pending_review', 'approved', 'signed', 'dispatched', 'delivered', 'returned', 'cancelled');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'correspondence_status'
  ) IS DISTINCT FROM ARRAY['draft', 'pending_review', 'approved', 'signed', 'dispatched', 'delivered', 'returned', 'cancelled']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.correspondence_status';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."correspondence_type" AS ENUM('letter', 'notice', 'memo', 'demand', 'response', 'proposal', 'agreement', 'report', 'other');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'correspondence_type'
  ) IS DISTINCT FROM ARRAY['letter', 'notice', 'memo', 'demand', 'response', 'proposal', 'agreement', 'report', 'other']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.correspondence_type';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."signature_source" AS ENUM('drawn', 'uploaded', 'typed');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'signature_source'
  ) IS DISTINCT FROM ARRAY['drawn', 'uploaded', 'typed']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.signature_source';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."event_type" AS ENUM('meeting', 'appointment', 'deadline', 'reminder', 'task', 'hearing', 'mediation', 'negotiation', 'training', 'other');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'event_type'
  ) IS DISTINCT FROM ARRAY['meeting', 'appointment', 'deadline', 'reminder', 'task', 'hearing', 'mediation', 'negotiation', 'training', 'other']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.event_type';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."budget_period" AS ENUM('monthly', 'quarterly', 'annual');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'budget_period'
  ) IS DISTINCT FROM ARRAY['monthly', 'quarterly', 'annual']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.budget_period';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."committee_type" AS ENUM('bargaining', 'grievance', 'health_safety', 'political_action', 'equity', 'education', 'organizing', 'steward', 'executive', 'finance', 'communications', 'social', 'pension_benefits', 'other');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'committee_type'
  ) IS DISTINCT FROM ARRAY['bargaining', 'grievance', 'health_safety', 'political_action', 'equity', 'education', 'organizing', 'steward', 'executive', 'finance', 'communications', 'social', 'pension_benefits', 'other']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.committee_type';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."employer_status" AS ENUM('active', 'inactive', 'contract_expired', 'in_bargaining', 'dispute', 'archived');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'employer_status'
  ) IS DISTINCT FROM ARRAY['active', 'inactive', 'contract_expired', 'in_bargaining', 'dispute', 'archived']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.employer_status';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."employer_type" AS ENUM('private', 'public', 'non_profit', 'crown_corporation', 'municipal', 'provincial', 'federal', 'educational', 'healthcare');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'employer_type'
  ) IS DISTINCT FROM ARRAY['private', 'public', 'non_profit', 'crown_corporation', 'municipal', 'provincial', 'federal', 'educational', 'healthcare']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.employer_type';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."unit_status" AS ENUM('active', 'under_certification', 'decertified', 'merged', 'inactive', 'archived');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'unit_status'
  ) IS DISTINCT FROM ARRAY['active', 'under_certification', 'decertified', 'merged', 'inactive', 'archived']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.unit_status';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."unit_type" AS ENUM('full_time', 'part_time', 'casual', 'mixed', 'craft', 'industrial', 'professional');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'unit_type'
  ) IS DISTINCT FROM ARRAY['full_time', 'part_time', 'casual', 'mixed', 'craft', 'industrial', 'professional']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.unit_type';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."worksite_status" AS ENUM('active', 'temporarily_closed', 'permanently_closed', 'seasonal', 'archived');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'worksite_status'
  ) IS DISTINCT FROM ARRAY['active', 'temporarily_closed', 'permanently_closed', 'seasonal', 'archived']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.worksite_status';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."committee_action_item_priority" AS ENUM('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'committee_action_item_priority'
  ) IS DISTINCT FROM ARRAY['low', 'medium', 'high', 'urgent']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.committee_action_item_priority';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."committee_action_item_status" AS ENUM('pending', 'in_progress', 'completed', 'deferred', 'cancelled');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'committee_action_item_status'
  ) IS DISTINCT FROM ARRAY['pending', 'in_progress', 'completed', 'deferred', 'cancelled']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.committee_action_item_status';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE "public"."committee_meeting_status" AS ENUM('scheduled', 'in_progress', 'completed', 'cancelled', 'postponed');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'committee_meeting_status'
  ) IS DISTINCT FROM ARRAY['scheduled', 'in_progress', 'completed', 'cancelled', 'postponed']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.committee_meeting_status';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.employers') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "employers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"legal_name" varchar(255),
	"dba_name" varchar(255),
	"employer_type" "employer_type" NOT NULL,
	"status" "employer_status" DEFAULT 'active' NOT NULL,
	"business_number" varchar(50),
	"federal_corporation_number" varchar(50),
	"provincial_corporation_number" varchar(50),
	"industry_code" varchar(20),
	"email" varchar(255),
	"phone" varchar(50),
	"website" varchar(500),
	"main_address" jsonb,
	"total_employees" integer,
	"unionized_employees" integer,
	"established_date" date,
	"primary_contact_name" varchar(255),
	"primary_contact_title" varchar(255),
	"primary_contact_email" varchar(255),
	"primary_contact_phone" varchar(50),
	"labour_relations_contact_name" varchar(255),
	"labour_relations_contact_email" varchar(255),
	"labour_relations_contact_phone" varchar(50),
	"parent_company_id" uuid,
	"notes" text,
	"custom_fields" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" text,
	"updated_by" text,
	"archived_at" timestamp with time zone
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('employers');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employers'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 255)
        OR (column_name = 'legal_name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'dba_name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'employer_type' AND data_type = 'USER-DEFINED' AND udt_name = 'employer_type' AND is_nullable = 'NO')
        OR (column_name = 'status' AND data_type = 'USER-DEFINED' AND udt_name = 'employer_status' AND is_nullable = 'NO')
        OR (column_name = 'business_number' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 50)
        OR (column_name = 'federal_corporation_number' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 50)
        OR (column_name = 'provincial_corporation_number' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 50)
        OR (column_name = 'industry_code' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 20)
        OR (column_name = 'email' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'phone' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 50)
        OR (column_name = 'website' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 500)
        OR (column_name = 'main_address' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'total_employees' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'unionized_employees' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'established_date' AND data_type = 'date' AND udt_name = 'date' AND is_nullable = 'YES')
        OR (column_name = 'primary_contact_name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'primary_contact_title' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'primary_contact_email' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'primary_contact_phone' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 50)
        OR (column_name = 'labour_relations_contact_name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'labour_relations_contact_email' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'labour_relations_contact_phone' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 50)
        OR (column_name = 'parent_company_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'notes' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'custom_fields' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'created_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'updated_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'archived_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
      );
    IF found IS DISTINCT FROM 33 THEN
      RAISE EXCEPTION 'incompatible existing relation public.employers: expected 33 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.member_jurisdiction_preferences') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "member_jurisdiction_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"preferred_jurisdictions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preferred_levels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"include_national" boolean DEFAULT true NOT NULL,
	"auto_apply" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('member_jurisdiction_preferences');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'member_jurisdiction_preferences'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'user_id' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'preferred_jurisdictions' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'NO')
        OR (column_name = 'preferred_levels' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'NO')
        OR (column_name = 'include_national' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'NO')
        OR (column_name = 'auto_apply' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'NO')
        OR (column_name = 'created_at' AND data_type = 'timestamp without time zone' AND udt_name = 'timestamp' AND is_nullable = 'NO')
        OR (column_name = 'updated_at' AND data_type = 'timestamp without time zone' AND udt_name = 'timestamp' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 9 THEN
      RAISE EXCEPTION 'incompatible existing relation public.member_jurisdiction_preferences: expected 9 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.grievance_case_access_assignments') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "grievance_case_access_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"grievance_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"access_role" "case_access_role" DEFAULT 'secondary_lro' NOT NULL,
	"granted_by" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"can_comment" boolean DEFAULT true NOT NULL,
	"can_upload_documents" boolean DEFAULT false NOT NULL,
	"can_edit_case_notes" boolean DEFAULT false NOT NULL,
	"can_draft_actions" boolean DEFAULT false NOT NULL,
	"can_view_private_documents" boolean DEFAULT false NOT NULL,
	"status" "case_access_status" DEFAULT 'active' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('grievance_case_access_assignments');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'grievance_case_access_assignments'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'grievance_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'user_id' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'access_role' AND data_type = 'USER-DEFINED' AND udt_name = 'case_access_role' AND is_nullable = 'NO')
        OR (column_name = 'granted_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'granted_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'expires_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'can_comment' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'NO')
        OR (column_name = 'can_upload_documents' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'NO')
        OR (column_name = 'can_edit_case_notes' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'NO')
        OR (column_name = 'can_draft_actions' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'NO')
        OR (column_name = 'can_view_private_documents' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'NO')
        OR (column_name = 'status' AND data_type = 'USER-DEFINED' AND udt_name = 'case_access_status' AND is_nullable = 'NO')
        OR (column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 15 THEN
      RAISE EXCEPTION 'incompatible existing relation public.grievance_case_access_assignments: expected 15 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.collective_agreements') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "collective_agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"cba_number" varchar(100) NOT NULL,
	"title" varchar(500) NOT NULL,
	"jurisdiction" "cba_jurisdiction" NOT NULL,
	"language" "cba_language" DEFAULT 'en' NOT NULL,
	"employer_name" varchar(300) NOT NULL,
	"employer_id" varchar(100),
	"union_name" varchar(300) NOT NULL,
	"union_local" varchar(100),
	"union_id" varchar(100),
	"effective_date" timestamp with time zone NOT NULL,
	"expiry_date" timestamp with time zone NOT NULL,
	"signed_date" timestamp with time zone,
	"ratification_date" timestamp with time zone,
	"industry_sector" varchar(200) NOT NULL,
	"sector" varchar(200),
	"employee_coverage" integer,
	"bargaining_unit_description" text,
	"document_url" text,
	"document_hash" varchar(64),
	"raw_text" text,
	"structured_data" jsonb,
	"embedding" text,
	"summary_generated" text,
	"key_terms" jsonb,
	"ai_processed" boolean DEFAULT false,
	"status" "cba_status" DEFAULT 'active' NOT NULL,
	"is_public" boolean DEFAULT false,
	"view_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	"last_modified_by" varchar(255),
	"version" integer DEFAULT 1 NOT NULL,
	"superseded_by" uuid,
	"precedes_id" uuid,
	CONSTRAINT "collective_agreements_cba_number_unique" UNIQUE("cba_number")
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('collective_agreements');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'collective_agreements'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'cba_number' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 100)
        OR (column_name = 'title' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 500)
        OR (column_name = 'jurisdiction' AND data_type = 'USER-DEFINED' AND udt_name = 'cba_jurisdiction' AND is_nullable = 'NO')
        OR (column_name = 'language' AND data_type = 'USER-DEFINED' AND udt_name = 'cba_language' AND is_nullable = 'NO')
        OR (column_name = 'employer_name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 300)
        OR (column_name = 'employer_id' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 100)
        OR (column_name = 'union_name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 300)
        OR (column_name = 'union_local' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 100)
        OR (column_name = 'union_id' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 100)
        OR (column_name = 'effective_date' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'expiry_date' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'signed_date' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'ratification_date' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'industry_sector' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 200)
        OR (column_name = 'sector' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 200)
        OR (column_name = 'employee_coverage' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'bargaining_unit_description' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'document_url' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'document_hash' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 64)
        OR (column_name = 'raw_text' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'structured_data' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'embedding' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'summary_generated' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'key_terms' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'ai_processed' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'YES')
        OR (column_name = 'status' AND data_type = 'USER-DEFINED' AND udt_name = 'cba_status' AND is_nullable = 'NO')
        OR (column_name = 'is_public' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'YES')
        OR (column_name = 'view_count' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'created_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'last_modified_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'version' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'superseded_by' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'precedes_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
      );
    IF found IS DISTINCT FROM 37 THEN
      RAISE EXCEPTION 'incompatible existing relation public.collective_agreements: expected 37 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.cba_clauses') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "cba_clauses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"cba_id" uuid NOT NULL,
	"clause_number" varchar(50) NOT NULL,
	"clause_type" "clause_type" NOT NULL,
	"title" varchar(500) NOT NULL,
	"content" text NOT NULL,
	"content_plain_text" text,
	"content_hash" varchar(64),
	"page_number" integer,
	"article_number" varchar(50),
	"section_hierarchy" jsonb,
	"parent_clause_id" uuid,
	"order_index" integer DEFAULT 0 NOT NULL,
	"embedding" text,
	"confidence_score" numeric(5, 4),
	"orgs" jsonb,
	"key_terms" jsonb,
	"related_clause_ids" jsonb,
	"interpretation_notes" text,
	"view_count" integer DEFAULT 0,
	"citation_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('cba_clauses');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cba_clauses'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'cba_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'clause_number' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 50)
        OR (column_name = 'clause_type' AND data_type = 'USER-DEFINED' AND udt_name = 'clause_type' AND is_nullable = 'NO')
        OR (column_name = 'title' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 500)
        OR (column_name = 'content' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'content_plain_text' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'content_hash' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 64)
        OR (column_name = 'page_number' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'article_number' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 50)
        OR (column_name = 'section_hierarchy' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'parent_clause_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'order_index' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'embedding' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'confidence_score' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'YES' AND numeric_precision = 5 AND numeric_scale = 4)
        OR (column_name = 'orgs' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'key_terms' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'related_clause_ids' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'interpretation_notes' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'view_count' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'citation_count' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 24 THEN
      RAISE EXCEPTION 'incompatible existing relation public.cba_clauses: expected 24 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.dues_assignments') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "dues_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"frequency" varchar(50) DEFAULT 'monthly' NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"effective_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('dues_assignments');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dues_assignments'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'member_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'amount' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'NO' AND numeric_precision = 10 AND numeric_scale = 2)
        OR (column_name = 'frequency' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 50)
        OR (column_name = 'status' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 50)
        OR (column_name = 'effective_date' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'end_date' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
      );
    IF found IS DISTINCT FROM 10 THEN
      RAISE EXCEPTION 'incompatible existing relation public.dues_assignments: expected 10 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.cost_centers') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "cost_centers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"type" "cost_center_type" NOT NULL,
	"parent_cost_center_id" uuid,
	"manager" varchar(255),
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"budget_amount" numeric(19, 2),
	"budget_period" varchar(50),
	"budget_start_date" timestamp,
	"budget_end_date" timestamp,
	"warning_threshold" integer DEFAULT 80,
	"external_code" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255)
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('cost_centers');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cost_centers'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'code' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 50)
        OR (column_name = 'name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 255)
        OR (column_name = 'description' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'type' AND data_type = 'USER-DEFINED' AND udt_name = 'cost_center_type' AND is_nullable = 'NO')
        OR (column_name = 'parent_cost_center_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'manager' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'status' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 50)
        OR (column_name = 'budget_amount' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'YES' AND numeric_precision = 19 AND numeric_scale = 2)
        OR (column_name = 'budget_period' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 50)
        OR (column_name = 'budget_start_date' AND data_type = 'timestamp without time zone' AND udt_name = 'timestamp' AND is_nullable = 'YES')
        OR (column_name = 'budget_end_date' AND data_type = 'timestamp without time zone' AND udt_name = 'timestamp' AND is_nullable = 'YES')
        OR (column_name = 'warning_threshold' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'external_code' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 100)
        OR (column_name = 'created_at' AND data_type = 'timestamp without time zone' AND udt_name = 'timestamp' AND is_nullable = 'NO')
        OR (column_name = 'updated_at' AND data_type = 'timestamp without time zone' AND udt_name = 'timestamp' AND is_nullable = 'NO')
        OR (column_name = 'created_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'updated_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
      );
    IF found IS DISTINCT FROM 19 THEN
      RAISE EXCEPTION 'incompatible existing relation public.cost_centers: expected 19 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.commercial_contracts') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "commercial_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"billing_account_id" uuid NOT NULL,
	"subscription_id" uuid,
	"contract_number" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" "commercial_contract_status" DEFAULT 'draft' NOT NULL,
	"effective_date" timestamp with time zone NOT NULL,
	"expiration_date" timestamp with time zone NOT NULL,
	"auto_renew" boolean DEFAULT false NOT NULL,
	"renewal_term_months" integer DEFAULT 12,
	"termination_notice_days" integer DEFAULT 30,
	"total_contract_value" numeric(14, 2),
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"signed_by" varchar(255),
	"signed_at" timestamp with time zone,
	"approved_by" varchar(255),
	"approved_at" timestamp with time zone,
	"superseded_by_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	CONSTRAINT "commercial_contracts_contract_number_unique" UNIQUE("contract_number")
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('commercial_contracts');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'commercial_contracts'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'billing_account_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'subscription_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'contract_number' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 50)
        OR (column_name = 'name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 255)
        OR (column_name = 'description' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'status' AND data_type = 'USER-DEFINED' AND udt_name = 'commercial_contract_status' AND is_nullable = 'NO')
        OR (column_name = 'effective_date' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'expiration_date' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'auto_renew' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'NO')
        OR (column_name = 'renewal_term_months' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'termination_notice_days' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'total_contract_value' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'YES' AND numeric_precision = 14 AND numeric_scale = 2)
        OR (column_name = 'currency' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 3)
        OR (column_name = 'signed_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'signed_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'approved_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'approved_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'superseded_by_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'metadata' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'created_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
      );
    IF found IS DISTINCT FROM 24 THEN
      RAISE EXCEPTION 'incompatible existing relation public.commercial_contracts: expected 24 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.contract_line_items') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "contract_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"line_type" "contract_line_type" NOT NULL,
	"feature_key" varchar(100) NOT NULL,
	"description" varchar(500) NOT NULL,
	"quantity" integer DEFAULT 1,
	"unit_price" numeric(12, 2),
	"total_price" numeric(14, 2),
	"usage_limit" integer,
	"usage_period" varchar(20),
	"sla_target" varchar(100),
	"effective_date" timestamp with time zone NOT NULL,
	"expiration_date" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('contract_line_items');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contract_line_items'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'contract_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'line_type' AND data_type = 'USER-DEFINED' AND udt_name = 'contract_line_type' AND is_nullable = 'NO')
        OR (column_name = 'feature_key' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 100)
        OR (column_name = 'description' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 500)
        OR (column_name = 'quantity' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'unit_price' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'YES' AND numeric_precision = 12 AND numeric_scale = 2)
        OR (column_name = 'total_price' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'YES' AND numeric_precision = 14 AND numeric_scale = 2)
        OR (column_name = 'usage_limit' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'usage_period' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 20)
        OR (column_name = 'sla_target' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 100)
        OR (column_name = 'effective_date' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'expiration_date' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'metadata' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 15 THEN
      RAISE EXCEPTION 'incompatible existing relation public.contract_line_items: expected 15 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.entitlement_usage_log') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "entitlement_usage_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entitlement_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"feature_key" varchar(100) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('entitlement_usage_log');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'entitlement_usage_log'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'entitlement_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'user_id' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 255)
        OR (column_name = 'feature_key' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 100)
        OR (column_name = 'quantity' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'metadata' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 8 THEN
      RAISE EXCEPTION 'incompatible existing relation public.entitlement_usage_log: expected 8 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.org_entitlements') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "org_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"contract_line_item_id" uuid,
	"feature_key" varchar(100) NOT NULL,
	"status" "org_entitlement_status" DEFAULT 'active' NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"usage_limit" integer,
	"usage_period" varchar(20),
	"current_usage" integer DEFAULT 0 NOT NULL,
	"usage_period_start" timestamp with time zone,
	"last_reset_at" timestamp with time zone,
	"granted_by" varchar(255),
	"revoked_by" varchar(255),
	"revoked_at" timestamp with time zone,
	"revoke_reason" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('org_entitlements');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'org_entitlements'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'contract_line_item_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'feature_key' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 100)
        OR (column_name = 'status' AND data_type = 'USER-DEFINED' AND udt_name = 'org_entitlement_status' AND is_nullable = 'NO')
        OR (column_name = 'granted_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'expires_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'usage_limit' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'usage_period' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 20)
        OR (column_name = 'current_usage' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'usage_period_start' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'last_reset_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'granted_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'revoked_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'revoked_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'revoke_reason' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'metadata' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 19 THEN
      RAISE EXCEPTION 'incompatible existing relation public.org_entitlements: expected 19 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.subscription_events_log') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "subscription_events_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"event_type" "subscription_lifecycle_event" NOT NULL,
	"previous_state" jsonb,
	"new_state" jsonb,
	"triggered_by" varchar(255),
	"reason" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('subscription_events_log');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscription_events_log'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'subscription_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'event_type' AND data_type = 'USER-DEFINED' AND udt_name = 'subscription_lifecycle_event' AND is_nullable = 'NO')
        OR (column_name = 'previous_state' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'new_state' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'triggered_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'reason' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'metadata' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 10 THEN
      RAISE EXCEPTION 'incompatible existing relation public.subscription_events_log: expected 10 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.billing_accounts') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "billing_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"billing_email" varchar(320) NOT NULL,
	"billing_contact_name" varchar(255),
	"billing_phone" varchar(30),
	"billing_address" jsonb,
	"tax_id" varchar(50),
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"status" "billing_account_status" DEFAULT 'active' NOT NULL,
	"net_terms_days" integer DEFAULT 30 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	CONSTRAINT "billing_accounts_organization_id_unique" UNIQUE("organization_id")
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('billing_accounts');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_accounts'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'display_name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 255)
        OR (column_name = 'billing_email' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 320)
        OR (column_name = 'billing_contact_name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'billing_phone' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 30)
        OR (column_name = 'billing_address' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'tax_id' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 50)
        OR (column_name = 'currency' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 3)
        OR (column_name = 'status' AND data_type = 'USER-DEFINED' AND udt_name = 'billing_account_status' AND is_nullable = 'NO')
        OR (column_name = 'net_terms_days' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'metadata' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'created_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
      );
    IF found IS DISTINCT FROM 15 THEN
      RAISE EXCEPTION 'incompatible existing relation public.billing_accounts: expected 15 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.billing_periods') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "billing_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"label" varchar(50) NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('billing_periods');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_periods'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'period_start' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'period_end' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'label' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 50)
        OR (column_name = 'is_closed' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'NO')
        OR (column_name = 'closed_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'closed_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 9 THEN
      RAISE EXCEPTION 'incompatible existing relation public.billing_periods: expected 9 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.payment_allocations') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('payment_allocations');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_allocations'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'payment_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'invoice_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'amount' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'NO' AND numeric_precision = 14 AND numeric_scale = 2)
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'created_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
      );
    IF found IS DISTINCT FROM 6 THEN
      RAISE EXCEPTION 'incompatible existing relation public.payment_allocations: expected 6 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.platform_invoice_line_items') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "platform_invoice_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"description" varchar(500) NOT NULL,
	"cost_type" varchar(50) NOT NULL,
	"quantity" numeric(12, 4) DEFAULT '1' NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"ledger_entry_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('platform_invoice_line_items');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'platform_invoice_line_items'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'invoice_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'description' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 500)
        OR (column_name = 'cost_type' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 50)
        OR (column_name = 'quantity' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'NO' AND numeric_precision = 12 AND numeric_scale = 4)
        OR (column_name = 'unit_price' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'NO' AND numeric_precision = 12 AND numeric_scale = 2)
        OR (column_name = 'amount' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'NO' AND numeric_precision = 14 AND numeric_scale = 2)
        OR (column_name = 'currency' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 3)
        OR (column_name = 'ledger_entry_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'metadata' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 11 THEN
      RAISE EXCEPTION 'incompatible existing relation public.platform_invoice_line_items: expected 11 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.platform_cost_ledger_entries') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "platform_cost_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"parent_organization_id" uuid,
	"local_id" uuid,
	"employer_id" uuid,
	"region_id" uuid,
	"bargaining_unit_id" uuid,
	"billing_period_id" uuid,
	"cost_type" "platform_cost_type" NOT NULL,
	"event_type" "ledger_event_type" NOT NULL,
	"source_type" "ledger_source_type" NOT NULL,
	"source_id" uuid,
	"quantity" numeric(12, 4) DEFAULT '1' NOT NULL,
	"unit_price_cad" numeric(12, 2) NOT NULL,
	"amount_cad" numeric(14, 2) NOT NULL,
	"cost_center_id" uuid,
	"allocation_status" "allocation_status" DEFAULT 'unallocated' NOT NULL,
	"allocation_run_id" uuid,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	"audit_reference" varchar(255)
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('platform_cost_ledger_entries');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'platform_cost_ledger_entries'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'parent_organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'local_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'employer_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'region_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'bargaining_unit_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'billing_period_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'cost_type' AND data_type = 'USER-DEFINED' AND udt_name = 'platform_cost_type' AND is_nullable = 'NO')
        OR (column_name = 'event_type' AND data_type = 'USER-DEFINED' AND udt_name = 'ledger_event_type' AND is_nullable = 'NO')
        OR (column_name = 'source_type' AND data_type = 'USER-DEFINED' AND udt_name = 'ledger_source_type' AND is_nullable = 'NO')
        OR (column_name = 'source_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'quantity' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'NO' AND numeric_precision = 12 AND numeric_scale = 4)
        OR (column_name = 'unit_price_cad' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'NO' AND numeric_precision = 12 AND numeric_scale = 2)
        OR (column_name = 'amount_cad' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'NO' AND numeric_precision = 14 AND numeric_scale = 2)
        OR (column_name = 'cost_center_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'allocation_status' AND data_type = 'USER-DEFINED' AND udt_name = 'allocation_status' AND is_nullable = 'NO')
        OR (column_name = 'allocation_run_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'description' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'metadata' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'created_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'audit_reference' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
      );
    IF found IS DISTINCT FROM 23 THEN
      RAISE EXCEPTION 'incompatible existing relation public.platform_cost_ledger_entries: expected 23 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.allocation_basis_snapshots') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "allocation_basis_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"local_id" uuid NOT NULL,
	"member_count" integer DEFAULT 0 NOT NULL,
	"active_user_count" integer DEFAULT 0 NOT NULL,
	"case_volume" integer DEFAULT 0 NOT NULL,
	"remittance_summary" numeric(14, 2) DEFAULT '0',
	"metadata" jsonb,
	"snapshot_at" timestamp with time zone DEFAULT now() NOT NULL
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('allocation_basis_snapshots');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'allocation_basis_snapshots'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'run_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'local_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'member_count' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'active_user_count' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'case_volume' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'remittance_summary' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'YES' AND numeric_precision = 14 AND numeric_scale = 2)
        OR (column_name = 'metadata' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'snapshot_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 9 THEN
      RAISE EXCEPTION 'incompatible existing relation public.allocation_basis_snapshots: expected 9 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.allocation_rule_versions') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "allocation_rule_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"method" "allocation_method" NOT NULL,
	"weights" jsonb,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"approved_by" varchar(255),
	"approved_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('allocation_rule_versions');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'allocation_rule_versions'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'rule_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'version' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'method' AND data_type = 'USER-DEFINED' AND udt_name = 'allocation_method' AND is_nullable = 'NO')
        OR (column_name = 'weights' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'effective_from' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'effective_to' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'approved_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'approved_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'metadata' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'created_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
      );
    IF found IS DISTINCT FROM 12 THEN
      RAISE EXCEPTION 'incompatible existing relation public.allocation_rule_versions: expected 12 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.allocation_rules') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "allocation_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('allocation_rules');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'allocation_rules'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 255)
        OR (column_name = 'description' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'is_active' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'NO')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'created_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
      );
    IF found IS DISTINCT FROM 8 THEN
      RAISE EXCEPTION 'incompatible existing relation public.allocation_rules: expected 8 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.allocation_run_lines') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "allocation_run_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"local_id" uuid NOT NULL,
	"local_name" varchar(255),
	"method" "allocation_method" NOT NULL,
	"basis_value" numeric(14, 4) NOT NULL,
	"weight" numeric(5, 2) NOT NULL,
	"allocated_amount" numeric(14, 2) NOT NULL,
	"cost_type" varchar(50) NOT NULL,
	"ledger_entry_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('allocation_run_lines');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'allocation_run_lines'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'run_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'local_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'local_name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'method' AND data_type = 'USER-DEFINED' AND udt_name = 'allocation_method' AND is_nullable = 'NO')
        OR (column_name = 'basis_value' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'NO' AND numeric_precision = 14 AND numeric_scale = 4)
        OR (column_name = 'weight' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'NO' AND numeric_precision = 5 AND numeric_scale = 2)
        OR (column_name = 'allocated_amount' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'NO' AND numeric_precision = 14 AND numeric_scale = 2)
        OR (column_name = 'cost_type' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 50)
        OR (column_name = 'ledger_entry_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'metadata' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 12 THEN
      RAISE EXCEPTION 'incompatible existing relation public.allocation_run_lines: expected 12 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.allocation_runs') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "allocation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"billing_period_id" uuid NOT NULL,
	"rule_version_id" uuid NOT NULL,
	"status" "allocation_run_status" DEFAULT 'draft' NOT NULL,
	"is_simulation" boolean DEFAULT false NOT NULL,
	"total_amount" numeric(14, 2) NOT NULL,
	"line_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"approved_by" varchar(255),
	"approved_at" timestamp with time zone,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('allocation_runs');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'allocation_runs'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'billing_period_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'rule_version_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'status' AND data_type = 'USER-DEFINED' AND udt_name = 'allocation_run_status' AND is_nullable = 'NO')
        OR (column_name = 'is_simulation' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'NO')
        OR (column_name = 'total_amount' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'NO' AND numeric_precision = 14 AND numeric_scale = 2)
        OR (column_name = 'line_count' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'started_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'completed_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'approved_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'approved_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'error_message' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'metadata' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'created_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
      );
    IF found IS DISTINCT FROM 16 THEN
      RAISE EXCEPTION 'incompatible existing relation public.allocation_runs: expected 16 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.chargeback_statements') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "chargeback_statements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"local_id" uuid NOT NULL,
	"billing_period_id" uuid NOT NULL,
	"allocation_run_id" uuid NOT NULL,
	"total_amount" numeric(14, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"status" chargeback_status DEFAULT 'draft' NOT NULL,
	"issued_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by" varchar(255),
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('chargeback_statements');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chargeback_statements'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'local_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'billing_period_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'allocation_run_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'total_amount' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'NO' AND numeric_precision = 14 AND numeric_scale = 2)
        OR (column_name = 'currency' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 3)
        OR (column_name = 'status' AND data_type = 'USER-DEFINED' AND udt_name = 'chargeback_status' AND is_nullable = 'NO')
        OR (column_name = 'issued_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'acknowledged_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'acknowledged_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'notes' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'metadata' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'created_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
      );
    IF found IS DISTINCT FROM 15 THEN
      RAISE EXCEPTION 'incompatible existing relation public.chargeback_statements: expected 15 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.fee_adjustments') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "fee_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fee_event_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"adjustment_type" "fee_adjustment_type" NOT NULL,
	"amount_cad" numeric(14, 2) NOT NULL,
	"reason" text NOT NULL,
	"source_refund_id" varchar(255),
	"approved_by" varchar(255),
	"approved_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('fee_adjustments');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fee_adjustments'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'fee_event_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'adjustment_type' AND data_type = 'USER-DEFINED' AND udt_name = 'fee_adjustment_type' AND is_nullable = 'NO')
        OR (column_name = 'amount_cad' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'NO' AND numeric_precision = 14 AND numeric_scale = 2)
        OR (column_name = 'reason' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'source_refund_id' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'approved_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'approved_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'metadata' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 11 THEN
      RAISE EXCEPTION 'incompatible existing relation public.fee_adjustments: expected 11 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.fee_settlement_batches') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "fee_settlement_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_number" varchar(50) NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"total_gross_cad" numeric(14, 2) NOT NULL,
	"total_fees_cad" numeric(14, 2) NOT NULL,
	"total_net_cad" numeric(14, 2) NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL,
	"status" "settlement_batch_status" DEFAULT 'open' NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by" varchar(255),
	"reconciled_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fee_settlement_batches_batch_number_unique" UNIQUE("batch_number")
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('fee_settlement_batches');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fee_settlement_batches'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'batch_number' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 50)
        OR (column_name = 'period_start' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'period_end' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'total_gross_cad' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'NO' AND numeric_precision = 14 AND numeric_scale = 2)
        OR (column_name = 'total_fees_cad' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'NO' AND numeric_precision = 14 AND numeric_scale = 2)
        OR (column_name = 'total_net_cad' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'NO' AND numeric_precision = 14 AND numeric_scale = 2)
        OR (column_name = 'event_count' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'status' AND data_type = 'USER-DEFINED' AND udt_name = 'settlement_batch_status' AND is_nullable = 'NO')
        OR (column_name = 'closed_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'closed_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'reconciled_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'metadata' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 15 THEN
      RAISE EXCEPTION 'incompatible existing relation public.fee_settlement_batches: expected 15 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.transaction_fee_events') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "transaction_fee_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"rule_id" uuid NOT NULL,
	"contract_id" uuid,
	"idempotency_key" varchar(255) NOT NULL,
	"source_transaction_id" varchar(255) NOT NULL,
	"source_transaction_type" varchar(100) NOT NULL,
	"gross_amount_cad" numeric(14, 2) NOT NULL,
	"fee_amount_cad" numeric(14, 2) NOT NULL,
	"net_amount_cad" numeric(14, 2) NOT NULL,
	"fee_model_applied" "fee_model" NOT NULL,
	"percentage_rate_applied" numeric(8, 6),
	"flat_fee_applied" numeric(14, 2),
	"status" "fee_event_status" DEFAULT 'captured' NOT NULL,
	"billing_period_id" uuid,
	"settlement_batch_id" uuid,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transaction_fee_events_idempotency_key_unique" UNIQUE("idempotency_key")
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('transaction_fee_events');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transaction_fee_events'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'rule_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'contract_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'idempotency_key' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 255)
        OR (column_name = 'source_transaction_id' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 255)
        OR (column_name = 'source_transaction_type' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 100)
        OR (column_name = 'gross_amount_cad' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'NO' AND numeric_precision = 14 AND numeric_scale = 2)
        OR (column_name = 'fee_amount_cad' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'NO' AND numeric_precision = 14 AND numeric_scale = 2)
        OR (column_name = 'net_amount_cad' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'NO' AND numeric_precision = 14 AND numeric_scale = 2)
        OR (column_name = 'fee_model_applied' AND data_type = 'USER-DEFINED' AND udt_name = 'fee_model' AND is_nullable = 'NO')
        OR (column_name = 'percentage_rate_applied' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'YES' AND numeric_precision = 8 AND numeric_scale = 6)
        OR (column_name = 'flat_fee_applied' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'YES' AND numeric_precision = 14 AND numeric_scale = 2)
        OR (column_name = 'status' AND data_type = 'USER-DEFINED' AND udt_name = 'fee_event_status' AND is_nullable = 'NO')
        OR (column_name = 'billing_period_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'settlement_batch_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'captured_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'metadata' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 19 THEN
      RAISE EXCEPTION 'incompatible existing relation public.transaction_fee_events: expected 19 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.transaction_fee_rules') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "transaction_fee_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"contract_id" uuid,
	"name" varchar(255) NOT NULL,
	"description" text,
	"fee_model" "fee_model" NOT NULL,
	"percentage_rate" numeric(8, 6),
	"flat_fee_cad" numeric(14, 2),
	"minimum_fee_cad" numeric(14, 2),
	"maximum_fee_cad" numeric(14, 2),
	"flow_type" varchar(100) NOT NULL,
	"module_key" varchar(100),
	"status" "fee_rule_status" DEFAULT 'active' NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"priority" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('transaction_fee_rules');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transaction_fee_rules'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'contract_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 255)
        OR (column_name = 'description' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'fee_model' AND data_type = 'USER-DEFINED' AND udt_name = 'fee_model' AND is_nullable = 'NO')
        OR (column_name = 'percentage_rate' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'YES' AND numeric_precision = 8 AND numeric_scale = 6)
        OR (column_name = 'flat_fee_cad' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'YES' AND numeric_precision = 14 AND numeric_scale = 2)
        OR (column_name = 'minimum_fee_cad' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'YES' AND numeric_precision = 14 AND numeric_scale = 2)
        OR (column_name = 'maximum_fee_cad' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'YES' AND numeric_precision = 14 AND numeric_scale = 2)
        OR (column_name = 'flow_type' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 100)
        OR (column_name = 'module_key' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 100)
        OR (column_name = 'status' AND data_type = 'USER-DEFINED' AND udt_name = 'fee_rule_status' AND is_nullable = 'NO')
        OR (column_name = 'effective_from' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'effective_to' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'priority' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'metadata' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'created_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
      );
    IF found IS DISTINCT FROM 20 THEN
      RAISE EXCEPTION 'incompatible existing relation public.transaction_fee_rules: expected 20 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.contract_covered_orgs') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "contract_covered_orgs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"role" "covered_org_role" NOT NULL,
	"activated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deactivated_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('contract_covered_orgs');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contract_covered_orgs'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'contract_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'role' AND data_type = 'USER-DEFINED' AND udt_name = 'covered_org_role' AND is_nullable = 'NO')
        OR (column_name = 'activated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'deactivated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'metadata' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 8 THEN
      RAISE EXCEPTION 'incompatible existing relation public.contract_covered_orgs: expected 8 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.reconciliation_exceptions') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "reconciliation_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"organization_id" uuid,
	"exception_type" "reconciliation_exception_type" NOT NULL,
	"exception_status" "reconciliation_exception_status" DEFAULT 'open' NOT NULL,
	"source_type" varchar(50) NOT NULL,
	"source_id" uuid NOT NULL,
	"expected_amount_cad" numeric(14, 2),
	"actual_amount_cad" numeric(14, 2),
	"variance_cad" numeric(14, 2),
	"description" text NOT NULL,
	"resolved_by" varchar(255),
	"resolved_at" timestamp with time zone,
	"resolution_notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('reconciliation_exceptions');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reconciliation_exceptions'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'run_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'exception_type' AND data_type = 'USER-DEFINED' AND udt_name = 'reconciliation_exception_type' AND is_nullable = 'NO')
        OR (column_name = 'exception_status' AND data_type = 'USER-DEFINED' AND udt_name = 'reconciliation_exception_status' AND is_nullable = 'NO')
        OR (column_name = 'source_type' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 50)
        OR (column_name = 'source_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'expected_amount_cad' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'YES' AND numeric_precision = 14 AND numeric_scale = 2)
        OR (column_name = 'actual_amount_cad' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'YES' AND numeric_precision = 14 AND numeric_scale = 2)
        OR (column_name = 'variance_cad' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'YES' AND numeric_precision = 14 AND numeric_scale = 2)
        OR (column_name = 'description' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'resolved_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'resolved_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'resolution_notes' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'metadata' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 17 THEN
      RAISE EXCEPTION 'incompatible existing relation public.reconciliation_exceptions: expected 17 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.reconciliation_matches') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "reconciliation_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"match_type" "reconciliation_match_type" NOT NULL,
	"source_type" varchar(50) NOT NULL,
	"source_id" uuid NOT NULL,
	"target_type" varchar(50) NOT NULL,
	"target_id" uuid NOT NULL,
	"source_amount_cad" numeric(14, 2) NOT NULL,
	"target_amount_cad" numeric(14, 2) NOT NULL,
	"variance_cad" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('reconciliation_matches');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reconciliation_matches'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'run_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'match_type' AND data_type = 'USER-DEFINED' AND udt_name = 'reconciliation_match_type' AND is_nullable = 'NO')
        OR (column_name = 'source_type' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 50)
        OR (column_name = 'source_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'target_type' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 50)
        OR (column_name = 'target_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'source_amount_cad' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'NO' AND numeric_precision = 14 AND numeric_scale = 2)
        OR (column_name = 'target_amount_cad' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'NO' AND numeric_precision = 14 AND numeric_scale = 2)
        OR (column_name = 'variance_cad' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'NO' AND numeric_precision = 14 AND numeric_scale = 2)
        OR (column_name = 'metadata' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 12 THEN
      RAISE EXCEPTION 'incompatible existing relation public.reconciliation_matches: expected 12 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.reconciliation_runs') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "reconciliation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"billing_period_id" uuid,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"status" "reconciliation_run_status" DEFAULT 'running' NOT NULL,
	"total_invoices" integer DEFAULT 0 NOT NULL,
	"total_payments" integer DEFAULT 0 NOT NULL,
	"total_matches" integer DEFAULT 0 NOT NULL,
	"total_exceptions" integer DEFAULT 0 NOT NULL,
	"invoice_amount_cad" numeric(14, 2) DEFAULT '0.00',
	"payment_amount_cad" numeric(14, 2) DEFAULT '0.00',
	"variance_cad" numeric(14, 2) DEFAULT '0.00',
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"run_by" varchar(255),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('reconciliation_runs');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reconciliation_runs'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'billing_period_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'period_start' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'period_end' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'status' AND data_type = 'USER-DEFINED' AND udt_name = 'reconciliation_run_status' AND is_nullable = 'NO')
        OR (column_name = 'total_invoices' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'total_payments' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'total_matches' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'total_exceptions' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'invoice_amount_cad' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'YES' AND numeric_precision = 14 AND numeric_scale = 2)
        OR (column_name = 'payment_amount_cad' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'YES' AND numeric_precision = 14 AND numeric_scale = 2)
        OR (column_name = 'variance_cad' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'YES' AND numeric_precision = 14 AND numeric_scale = 2)
        OR (column_name = 'started_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'completed_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'run_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'metadata' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 18 THEN
      RAISE EXCEPTION 'incompatible existing relation public.reconciliation_runs: expected 18 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.case_documents') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "case_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"linked_by" text NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"link_type" text DEFAULT 'attachment',
	"notes" text,
	"is_immutable" boolean DEFAULT false
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('case_documents');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'case_documents'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'claim_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'document_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'linked_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'linked_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'link_type' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'notes' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'is_immutable' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'YES')
      );
    IF found IS DISTINCT FROM 9 THEN
      RAISE EXCEPTION 'incompatible existing relation public.case_documents: expected 9 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.document_access_grants') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "document_access_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"granted_by" text NOT NULL,
	"status" "document_grant_status" DEFAULT 'active' NOT NULL,
	"can_view" boolean DEFAULT true NOT NULL,
	"can_download" boolean DEFAULT false NOT NULL,
	"can_share" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('document_access_grants');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'document_access_grants'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'document_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'user_id' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'granted_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'status' AND data_type = 'USER-DEFINED' AND udt_name = 'document_grant_status' AND is_nullable = 'NO')
        OR (column_name = 'can_view' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'NO')
        OR (column_name = 'can_download' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'NO')
        OR (column_name = 'can_share' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'NO')
        OR (column_name = 'expires_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'revoked_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 12 THEN
      RAISE EXCEPTION 'incompatible existing relation public.document_access_grants: expected 12 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.document_links') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "document_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"linked_entity_type" "document_linked_entity_type" NOT NULL,
	"linked_entity_id" uuid NOT NULL,
	"linked_by" text NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('document_links');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'document_links'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'document_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'linked_entity_type' AND data_type = 'USER-DEFINED' AND udt_name = 'document_linked_entity_type' AND is_nullable = 'NO')
        OR (column_name = 'linked_entity_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'linked_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'linked_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'metadata' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
      );
    IF found IS DISTINCT FROM 8 THEN
      RAISE EXCEPTION 'incompatible existing relation public.document_links: expected 8 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.document_versions') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"version_no" integer NOT NULL,
	"storage_key" text NOT NULL,
	"content_hash" text NOT NULL,
	"uploaded_by" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('document_versions');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'document_versions'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'document_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'version_no' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'storage_key' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'content_hash' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'uploaded_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'uploaded_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'metadata' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
      );
    IF found IS DISTINCT FROM 9 THEN
      RAISE EXCEPTION 'incompatible existing relation public.document_versions: expected 9 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.correspondence') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "correspondence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"reference_number" varchar(50),
	"subject" varchar(500) NOT NULL,
	"body" text NOT NULL,
	"type" "correspondence_type" DEFAULT 'letter' NOT NULL,
	"priority" "correspondence_priority" DEFAULT 'normal' NOT NULL,
	"template_id" uuid,
	"template_variables" jsonb,
	"status" "correspondence_status" DEFAULT 'draft' NOT NULL,
	"drafted_by" text NOT NULL,
	"assigned_signer_id" text,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"signature_id" uuid,
	"signed_at" timestamp with time zone,
	"signed_by" text,
	"dispatched_at" timestamp with time zone,
	"dispatched_by" text,
	"dispatch_method" varchar(50),
	"signed_pdf_url" text,
	"signed_pdf_hash" varchar(64),
	"attachments" jsonb,
	"grievance_id" uuid,
	"internal_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('correspondence');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'correspondence'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'reference_number' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 50)
        OR (column_name = 'subject' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 500)
        OR (column_name = 'body' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'type' AND data_type = 'USER-DEFINED' AND udt_name = 'correspondence_type' AND is_nullable = 'NO')
        OR (column_name = 'priority' AND data_type = 'USER-DEFINED' AND udt_name = 'correspondence_priority' AND is_nullable = 'NO')
        OR (column_name = 'template_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'template_variables' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'status' AND data_type = 'USER-DEFINED' AND udt_name = 'correspondence_status' AND is_nullable = 'NO')
        OR (column_name = 'drafted_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'assigned_signer_id' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'approved_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'approved_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'signature_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'signed_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'signed_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'dispatched_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'dispatched_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'dispatch_method' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 50)
        OR (column_name = 'signed_pdf_url' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'signed_pdf_hash' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 64)
        OR (column_name = 'attachments' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'grievance_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'internal_notes' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 27 THEN
      RAISE EXCEPTION 'incompatible existing relation public.correspondence: expected 27 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.correspondence_audit_trail') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "correspondence_audit_trail" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"correspondence_id" uuid NOT NULL,
	"event_type" "correspondence_audit_event" NOT NULL,
	"event_description" text,
	"actor_user_id" text NOT NULL,
	"actor_name" varchar(255),
	"actor_role" varchar(100),
	"ip_address" varchar(45),
	"user_agent" text,
	"metadata" jsonb,
	"hash_chain" varchar(64),
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('correspondence_audit_trail');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'correspondence_audit_trail'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'correspondence_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'event_type' AND data_type = 'USER-DEFINED' AND udt_name = 'correspondence_audit_event' AND is_nullable = 'NO')
        OR (column_name = 'event_description' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'actor_user_id' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'actor_name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'actor_role' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 100)
        OR (column_name = 'ip_address' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 45)
        OR (column_name = 'user_agent' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'metadata' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'hash_chain' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 64)
        OR (column_name = 'timestamp' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 12 THEN
      RAISE EXCEPTION 'incompatible existing relation public.correspondence_audit_trail: expected 12 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.correspondence_recipients') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "correspondence_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"correspondence_id" uuid NOT NULL,
	"recipient_type" varchar(10) DEFAULT 'to' NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(320),
	"mailing_address" text,
	"organization" varchar(255),
	"title" varchar(255),
	"delivery_status" varchar(50) DEFAULT 'pending',
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('correspondence_recipients');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'correspondence_recipients'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'correspondence_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'recipient_type' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 10)
        OR (column_name = 'name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 255)
        OR (column_name = 'email' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 320)
        OR (column_name = 'mailing_address' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'organization' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'title' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'delivery_status' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 50)
        OR (column_name = 'delivered_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 11 THEN
      RAISE EXCEPTION 'incompatible existing relation public.correspondence_recipients: expected 11 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.user_signatures') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "user_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"display_title" varchar(255),
	"source" "signature_source" DEFAULT 'drawn' NOT NULL,
	"image_url" text NOT NULL,
	"image_hash" varchar(64) NOT NULL,
	"is_default" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('user_signatures');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_signatures'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'user_id' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'display_name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 255)
        OR (column_name = 'display_title' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'source' AND data_type = 'USER-DEFINED' AND udt_name = 'signature_source' AND is_nullable = 'NO')
        OR (column_name = 'image_url' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'image_hash' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 64)
        OR (column_name = 'is_default' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'NO')
        OR (column_name = 'is_active' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'NO')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 12 THEN
      RAISE EXCEPTION 'incompatible existing relation public.user_signatures: expected 12 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.pilot_checklist_items') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "pilot_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"item_id" varchar(100) NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"completed_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('pilot_checklist_items');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pilot_checklist_items'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'item_id' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 100)
        OR (column_name = 'completed' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'NO')
        OR (column_name = 'completed_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'completed_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 8 THEN
      RAISE EXCEPTION 'incompatible existing relation public.pilot_checklist_items: expected 8 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.pilot_demo_seeds') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "pilot_demo_seeds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"seeded_by" varchar(255),
	"seeded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"purged_at" timestamp with time zone,
	"member_count" integer DEFAULT 0 NOT NULL,
	"employer_count" integer DEFAULT 0 NOT NULL,
	"grievance_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('pilot_demo_seeds');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pilot_demo_seeds'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'seeded_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'seeded_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'purged_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'member_count' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'employer_count' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'grievance_count' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 10 THEN
      RAISE EXCEPTION 'incompatible existing relation public.pilot_demo_seeds: expected 10 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.pilot_enrollments') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "pilot_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"pilot_id" varchar(100) NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"enrolled_by" varchar(255),
	"organizer_adoption_rate" real DEFAULT 0 NOT NULL,
	"member_engagement_rate" real DEFAULT 0 NOT NULL,
	"cases_managed" integer DEFAULT 0 NOT NULL,
	"avg_time_to_resolution" real DEFAULT 0 NOT NULL,
	"health_score" real DEFAULT 0 NOT NULL,
	"last_calculated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('pilot_enrollments');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pilot_enrollments'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'pilot_id' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 100)
        OR (column_name = 'status' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 50)
        OR (column_name = 'enrolled_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'enrolled_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'organizer_adoption_rate' AND data_type = 'real' AND udt_name = 'float4' AND is_nullable = 'NO')
        OR (column_name = 'member_engagement_rate' AND data_type = 'real' AND udt_name = 'float4' AND is_nullable = 'NO')
        OR (column_name = 'cases_managed' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'avg_time_to_resolution' AND data_type = 'real' AND udt_name = 'float4' AND is_nullable = 'NO')
        OR (column_name = 'health_score' AND data_type = 'real' AND udt_name = 'float4' AND is_nullable = 'NO')
        OR (column_name = 'last_calculated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 14 THEN
      RAISE EXCEPTION 'incompatible existing relation public.pilot_enrollments: expected 14 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.pilot_milestones') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "pilot_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"target_date" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('pilot_milestones');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pilot_milestones'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 255)
        OR (column_name = 'description' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'status' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 50)
        OR (column_name = 'target_date' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'completed_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 9 THEN
      RAISE EXCEPTION 'incompatible existing relation public.pilot_milestones: expected 9 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.pilot_events') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "pilot_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"session_id" varchar(100) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('pilot_events');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pilot_events'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'user_id' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 255)
        OR (column_name = 'session_id' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 100)
        OR (column_name = 'event_type' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 100)
        OR (column_name = 'metadata' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 7 THEN
      RAISE EXCEPTION 'incompatible existing relation public.pilot_events: expected 7 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.pilot_feedback') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "pilot_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"ease_rating" integer NOT NULL,
	"category" varchar(50),
	"comment" text,
	"trigger" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('pilot_feedback');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pilot_feedback'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'user_id' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 255)
        OR (column_name = 'ease_rating' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'category' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 50)
        OR (column_name = 'comment' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'trigger' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 50)
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 8 THEN
      RAISE EXCEPTION 'incompatible existing relation public.pilot_feedback: expected 8 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.deadline_audit_events') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "deadline_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source_table" text NOT NULL,
	"source_deadline_id" uuid NOT NULL,
	"reminder_id" uuid,
	"event_type" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" varchar(255),
	"correlation_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('deadline_audit_events');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deadline_audit_events'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'source_table' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'source_deadline_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'reminder_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'event_type' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'actor_type' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'actor_id' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'correlation_id' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'metadata' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'NO')
        OR (column_name = 'occurred_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 11 THEN
      RAISE EXCEPTION 'incompatible existing relation public.deadline_audit_events: expected 11 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.deadline_reminder_executions') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "deadline_reminder_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reminder_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"outcome" text NOT NULL,
	"provider" text,
	"provider_message_id" text,
	"provider_status_code" integer,
	"error_code" text,
	"error_message" text,
	"duration_ms" integer,
	"worker_instance" text NOT NULL,
	"correlation_id" text NOT NULL
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('deadline_reminder_executions');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deadline_reminder_executions'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'reminder_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'attempt_number' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'attempted_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'outcome' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'provider' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'provider_message_id' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'provider_status_code' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'error_code' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'error_message' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'duration_ms' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'worker_instance' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'correlation_id' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 13 THEN
      RAISE EXCEPTION 'incompatible existing relation public.deadline_reminder_executions: expected 13 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.deadline_reminders') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "deadline_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_table" text NOT NULL,
	"source_deadline_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"offset_days" integer NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"reminder_kind" text DEFAULT 'upcoming' NOT NULL,
	"recipient_user_id" varchar(255),
	"recipient_role" text NOT NULL,
	"recipient_email" text NOT NULL,
	"recipient_email_hash" text NOT NULL,
	"recipient_locale" text DEFAULT 'en' NOT NULL,
	"message_template" text DEFAULT 'deadline_reminder_v1' NOT NULL,
	"message_subject" text DEFAULT 'Union Eyes deadline reminder' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"lease_owner" text,
	"lease_expires_at" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"provider" text,
	"provider_message_id" text,
	"last_error_code" text,
	"last_error_message" text,
	"cancelled_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"dead_lettered_at" timestamp with time zone
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('deadline_reminders');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deadline_reminders'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'source_table' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'source_deadline_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'offset_days' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'scheduled_for' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'timezone' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'reminder_kind' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'recipient_user_id' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'recipient_role' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'recipient_email' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'recipient_email_hash' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'recipient_locale' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'message_template' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'message_subject' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'status' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'lease_owner' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'lease_expires_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'attempt_count' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'max_attempts' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'provider' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'provider_message_id' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'last_error_code' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'last_error_message' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'cancelled_reason' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'sent_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'dead_lettered_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
      );
    IF found IS DISTINCT FROM 29 THEN
      RAISE EXCEPTION 'incompatible existing relation public.deadline_reminders: expected 29 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.org_configurations') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "org_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"category" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"updated_by" text
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('org_configurations');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'org_configurations'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'category' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'key' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'value' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'description' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'updated_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
      );
    IF found IS DISTINCT FROM 9 THEN
      RAISE EXCEPTION 'incompatible existing relation public.org_configurations: expected 9 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.bargaining_units') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "bargaining_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employer_id" uuid NOT NULL,
	"worksite_id" uuid,
	"name" varchar(255) NOT NULL,
	"unit_number" varchar(50),
	"unit_type" "unit_type" NOT NULL,
	"status" "unit_status" DEFAULT 'active' NOT NULL,
	"certification_number" varchar(100),
	"certification_date" date,
	"certification_body" varchar(100),
	"certification_expiry_date" date,
	"current_collective_agreement_id" uuid,
	"contract_expiry_date" date,
	"next_bargaining_date" date,
	"member_count" integer DEFAULT 0,
	"classifications" jsonb,
	"chief_steward_id" text,
	"bargaining_chair_id" text,
	"description" text,
	"notes" text,
	"custom_fields" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" text,
	"updated_by" text,
	"archived_at" timestamp with time zone
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('bargaining_units');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bargaining_units'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'employer_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'worksite_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 255)
        OR (column_name = 'unit_number' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 50)
        OR (column_name = 'unit_type' AND data_type = 'USER-DEFINED' AND udt_name = 'unit_type' AND is_nullable = 'NO')
        OR (column_name = 'status' AND data_type = 'USER-DEFINED' AND udt_name = 'unit_status' AND is_nullable = 'NO')
        OR (column_name = 'certification_number' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 100)
        OR (column_name = 'certification_date' AND data_type = 'date' AND udt_name = 'date' AND is_nullable = 'YES')
        OR (column_name = 'certification_body' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 100)
        OR (column_name = 'certification_expiry_date' AND data_type = 'date' AND udt_name = 'date' AND is_nullable = 'YES')
        OR (column_name = 'current_collective_agreement_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'contract_expiry_date' AND data_type = 'date' AND udt_name = 'date' AND is_nullable = 'YES')
        OR (column_name = 'next_bargaining_date' AND data_type = 'date' AND udt_name = 'date' AND is_nullable = 'YES')
        OR (column_name = 'member_count' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'classifications' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'chief_steward_id' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'bargaining_chair_id' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'description' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'notes' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'custom_fields' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'created_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'updated_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'archived_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
      );
    IF found IS DISTINCT FROM 27 THEN
      RAISE EXCEPTION 'incompatible existing relation public.bargaining_units: expected 27 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.committees') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "committees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"committee_type" "committee_type" NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"unit_id" uuid,
	"worksite_id" uuid,
	"is_organization_wide" boolean DEFAULT false,
	"mandate" text,
	"meeting_frequency" varchar(100),
	"meeting_day" varchar(50),
	"meeting_time" varchar(50),
	"meeting_location" text,
	"max_members" integer,
	"current_member_count" integer DEFAULT 0,
	"requires_appointment" boolean DEFAULT false,
	"requires_election" boolean DEFAULT false,
	"term_length" integer,
	"chair_id" text,
	"secretary_id" text,
	"contact_email" varchar(255),
	"description" text,
	"notes" text,
	"custom_fields" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" text,
	"updated_by" text,
	"archived_at" timestamp with time zone
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('committees');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'committees'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 255)
        OR (column_name = 'committee_type' AND data_type = 'USER-DEFINED' AND udt_name = 'committee_type' AND is_nullable = 'NO')
        OR (column_name = 'status' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 50)
        OR (column_name = 'unit_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'worksite_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'is_organization_wide' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'YES')
        OR (column_name = 'mandate' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'meeting_frequency' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 100)
        OR (column_name = 'meeting_day' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 50)
        OR (column_name = 'meeting_time' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 50)
        OR (column_name = 'meeting_location' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'max_members' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'current_member_count' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'requires_appointment' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'YES')
        OR (column_name = 'requires_election' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'YES')
        OR (column_name = 'term_length' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'chair_id' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'secretary_id' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'contact_email' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'description' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'notes' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'custom_fields' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'created_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'updated_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'archived_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
      );
    IF found IS DISTINCT FROM 29 THEN
      RAISE EXCEPTION 'incompatible existing relation public.committees: expected 29 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.worksites') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "worksites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employer_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(50),
	"status" "worksite_status" DEFAULT 'active' NOT NULL,
	"address" jsonb,
	"employee_count" integer,
	"shift_count" integer,
	"operates_weekends" boolean DEFAULT false,
	"operates_24_hours" boolean DEFAULT false,
	"site_manager_name" varchar(255),
	"site_manager_email" varchar(255),
	"site_manager_phone" varchar(50),
	"description" text,
	"notes" text,
	"custom_fields" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" text,
	"updated_by" text,
	"archived_at" timestamp with time zone
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('worksites');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'worksites'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'employer_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 255)
        OR (column_name = 'code' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 50)
        OR (column_name = 'status' AND data_type = 'USER-DEFINED' AND udt_name = 'worksite_status' AND is_nullable = 'NO')
        OR (column_name = 'address' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'employee_count' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'shift_count' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'operates_weekends' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'YES')
        OR (column_name = 'operates_24_hours' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'YES')
        OR (column_name = 'site_manager_name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'site_manager_email' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'site_manager_phone' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 50)
        OR (column_name = 'description' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'notes' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'custom_fields' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'created_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'updated_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'archived_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
      );
    IF found IS DISTINCT FROM 22 THEN
      RAISE EXCEPTION 'incompatible existing relation public.worksites: expected 22 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.committee_action_items') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "committee_action_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"committee_id" uuid NOT NULL,
	"meeting_id" uuid,
	"organization_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"status" "committee_action_item_status" DEFAULT 'pending' NOT NULL,
	"priority" "committee_action_item_priority" DEFAULT 'medium' NOT NULL,
	"assigned_to" text,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"completed_by" text,
	"resolution" text,
	"carried_from_meeting_id" uuid,
	"carry_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" text,
	"updated_by" text
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('committee_action_items');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'committee_action_items'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'committee_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'meeting_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'title' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 500)
        OR (column_name = 'description' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'status' AND data_type = 'USER-DEFINED' AND udt_name = 'committee_action_item_status' AND is_nullable = 'NO')
        OR (column_name = 'priority' AND data_type = 'USER-DEFINED' AND udt_name = 'committee_action_item_priority' AND is_nullable = 'NO')
        OR (column_name = 'assigned_to' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'due_date' AND data_type = 'date' AND udt_name = 'date' AND is_nullable = 'YES')
        OR (column_name = 'completed_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'completed_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'resolution' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'carried_from_meeting_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'carry_count' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'created_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'updated_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
      );
    IF found IS DISTINCT FROM 19 THEN
      RAISE EXCEPTION 'incompatible existing relation public.committee_action_items: expected 19 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.committee_documents') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "committee_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"committee_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_id" uuid,
	"meeting_id" uuid,
	"title" varchar(500) NOT NULL,
	"file_url" text,
	"file_type" text,
	"file_size" integer,
	"category" varchar(100),
	"created_at" timestamp with time zone DEFAULT now(),
	"uploaded_by" text
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('committee_documents');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'committee_documents'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'committee_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'document_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'meeting_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'title' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 500)
        OR (column_name = 'file_url' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'file_type' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'file_size' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'category' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 100)
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'uploaded_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
      );
    IF found IS DISTINCT FROM 12 THEN
      RAISE EXCEPTION 'incompatible existing relation public.committee_documents: expected 12 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.committee_intelligence_snapshots') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "committee_intelligence_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"committee_id" uuid,
	"title" varchar(500) NOT NULL,
	"summary" text NOT NULL,
	"key_themes" jsonb,
	"positions" jsonb,
	"recommendations" jsonb,
	"source_meeting_ids" jsonb,
	"source_committee_ids" jsonb,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"generated_at" timestamp with time zone DEFAULT now(),
	"generated_by" text,
	"model" varchar(100)
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('committee_intelligence_snapshots');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'committee_intelligence_snapshots'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'committee_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'title' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 500)
        OR (column_name = 'summary' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'key_themes' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'positions' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'recommendations' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'source_meeting_ids' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'source_committee_ids' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'period_start' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'period_end' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'generated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'generated_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'model' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 100)
      );
    IF found IS DISTINCT FROM 15 THEN
      RAISE EXCEPTION 'incompatible existing relation public.committee_intelligence_snapshots: expected 15 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.committee_meeting_attendees') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "committee_meeting_attendees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"member_id" text NOT NULL,
	"attended" boolean DEFAULT false NOT NULL,
	"arrived_late" boolean DEFAULT false,
	"left_early" boolean DEFAULT false,
	"proxy" text,
	"regrets" boolean DEFAULT false,
	"notes" text
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('committee_meeting_attendees');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'committee_meeting_attendees'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'meeting_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'member_id' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'attended' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'NO')
        OR (column_name = 'arrived_late' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'YES')
        OR (column_name = 'left_early' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'YES')
        OR (column_name = 'proxy' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'regrets' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'YES')
        OR (column_name = 'notes' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
      );
    IF found IS DISTINCT FROM 9 THEN
      RAISE EXCEPTION 'incompatible existing relation public.committee_meeting_attendees: expected 9 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.committee_meetings') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "committee_meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"committee_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"meeting_date" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone,
	"location" text,
	"virtual_link" text,
	"status" "committee_meeting_status" DEFAULT 'scheduled' NOT NULL,
	"agenda" text,
	"agenda_items" jsonb,
	"minutes" text,
	"minutes_approved_by" text,
	"minutes_approved_at" timestamp with time zone,
	"quorum_met" boolean,
	"attendee_count" integer DEFAULT 0,
	"external_attendees" jsonb,
	"decisions" jsonb,
	"next_meeting_date" timestamp with time zone,
	"attachment_ids" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" text,
	"updated_by" text
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('committee_meetings');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'committee_meetings'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'committee_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'title' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 500)
        OR (column_name = 'meeting_date' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'end_time' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'location' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'virtual_link' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'status' AND data_type = 'USER-DEFINED' AND udt_name = 'committee_meeting_status' AND is_nullable = 'NO')
        OR (column_name = 'agenda' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'agenda_items' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'minutes' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'minutes_approved_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'minutes_approved_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'quorum_met' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'YES')
        OR (column_name = 'attendee_count' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'external_attendees' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'decisions' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'next_meeting_date' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'attachment_ids' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'created_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'updated_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
      );
    IF found IS DISTINCT FROM 24 THEN
      RAISE EXCEPTION 'incompatible existing relation public.committee_meetings: expected 24 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.data_quality_warnings') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "data_quality_warnings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"record_type" varchar(30) NOT NULL,
	"record_id" uuid NOT NULL,
	"batch_id" uuid,
	"severity" varchar(10) DEFAULT 'warning' NOT NULL,
	"category" varchar(50) NOT NULL,
	"field_name" varchar(100),
	"message" text NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_by" varchar(255),
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('data_quality_warnings');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'data_quality_warnings'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'record_type' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 30)
        OR (column_name = 'record_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'batch_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'severity' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 10)
        OR (column_name = 'category' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 50)
        OR (column_name = 'field_name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 100)
        OR (column_name = 'message' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'resolved' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'NO')
        OR (column_name = 'resolved_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'resolved_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 13 THEN
      RAISE EXCEPTION 'incompatible existing relation public.data_quality_warnings: expected 13 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.duplicate_group_members') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "duplicate_group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"record_type" varchar(30) NOT NULL,
	"record_id" uuid NOT NULL,
	"similarity_score" real,
	"is_anchor" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('duplicate_group_members');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'duplicate_group_members'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'group_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'record_type' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 30)
        OR (column_name = 'record_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'similarity_score' AND data_type = 'real' AND udt_name = 'float4' AND is_nullable = 'YES')
        OR (column_name = 'is_anchor' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'NO')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 7 THEN
      RAISE EXCEPTION 'incompatible existing relation public.duplicate_group_members: expected 7 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.duplicate_groups') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "duplicate_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"group_type" varchar(30) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"auto_score" real,
	"match_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reviewed_by" varchar(255),
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('duplicate_groups');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'duplicate_groups'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'group_type' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 30)
        OR (column_name = 'status' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 20)
        OR (column_name = 'auto_score' AND data_type = 'real' AND udt_name = 'float4' AND is_nullable = 'YES')
        OR (column_name = 'match_reasons' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'NO')
        OR (column_name = 'reviewed_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'reviewed_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'metadata' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
      );
    IF found IS DISTINCT FROM 10 THEN
      RAISE EXCEPTION 'incompatible existing relation public.duplicate_groups: expected 10 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.grievance_timeline_events') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "grievance_timeline_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grievance_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"event_date" timestamp with time zone NOT NULL,
	"actor" varchar(255),
	"description" text,
	"content_hash" varchar(64) NOT NULL,
	"source_system" varchar(100),
	"import_batch_id" uuid,
	"sequence_number" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('grievance_timeline_events');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'grievance_timeline_events'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'grievance_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'event_type' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 100)
        OR (column_name = 'event_date' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'actor' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'description' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'content_hash' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 64)
        OR (column_name = 'source_system' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 100)
        OR (column_name = 'import_batch_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'sequence_number' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'metadata' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF found IS DISTINCT FROM 13 THEN
      RAISE EXCEPTION 'incompatible existing relation public.grievance_timeline_events: expected 13 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.ingestion_batches') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "ingestion_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source_system" varchar(100) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"total_records" integer DEFAULT 0 NOT NULL,
	"processed" integer DEFAULT 0 NOT NULL,
	"succeeded" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"error_summary" jsonb DEFAULT '[]'::jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('ingestion_batches');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ingestion_batches'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'source_system' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 100)
        OR (column_name = 'status' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 20)
        OR (column_name = 'total_records' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'processed' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'succeeded' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'failed' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'skipped' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'error_summary' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'started_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'completed_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'created_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'metadata' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
      );
    IF found IS DISTINCT FROM 15 THEN
      RAISE EXCEPTION 'incompatible existing relation public.ingestion_batches: expected 15 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  found integer;
BEGIN
  IF to_regclass('public.ingestion_records') IS NULL THEN
    EXECUTE $ddl$CREATE TABLE "ingestion_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"record_index" integer NOT NULL,
	"record_type" varchar(50) NOT NULL,
	"external_id" varchar(255),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"entity_id" uuid,
	"error_message" text,
	"error_details" jsonb,
	"fingerprint" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);$ddl$;
    INSERT INTO ue_bootstrap_created_relations(relname) VALUES ('ingestion_records');
  ELSE
    SELECT count(*) INTO found FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ingestion_records'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'batch_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'record_index' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'record_type' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 50)
        OR (column_name = 'external_id' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'status' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 20)
        OR (column_name = 'entity_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'error_message' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'error_details' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'fingerprint' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 64)
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'processed_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
      );
    IF found IS DISTINCT FROM 12 THEN
      RAISE EXCEPTION 'incompatible existing relation public.ingestion_records: expected 12 matching columns, found %', found;
    END IF;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for employers_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'employers') THEN
    EXECUTE $ddl$ALTER TABLE "employers" ADD CONSTRAINT "employers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('employers_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.employers')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.employers: constraint employers_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.employers') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.employers for employers_parent_company_id_employers_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'employers') THEN
    EXECUTE $ddl$ALTER TABLE "employers" ADD CONSTRAINT "employers_parent_company_id_employers_id_fk" FOREIGN KEY ("parent_company_id") REFERENCES "public"."employers"("id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('employers_parent_company_id_employers_id_fk', 63) AND conrelid = to_regclass('public.employers')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.employers: constraint employers_parent_company_id_employers_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.profiles for employers_created_by_profiles_user_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'employers') THEN
    EXECUTE $ddl$ALTER TABLE "employers" ADD CONSTRAINT "employers_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('employers_created_by_profiles_user_id_fk', 63) AND conrelid = to_regclass('public.employers')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.employers: constraint employers_created_by_profiles_user_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.profiles for employers_updated_by_profiles_user_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'employers') THEN
    EXECUTE $ddl$ALTER TABLE "employers" ADD CONSTRAINT "employers_updated_by_profiles_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('employers_updated_by_profiles_user_id_fk', 63) AND conrelid = to_regclass('public.employers')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.employers: constraint employers_updated_by_profiles_user_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for member_jurisdiction_preferences_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'member_jurisdiction_preferences') THEN
    EXECUTE $ddl$ALTER TABLE "member_jurisdiction_preferences" ADD CONSTRAINT "member_jurisdiction_preferences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('member_jurisdiction_preferences_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.member_jurisdiction_preferences')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.member_jurisdiction_preferences: constraint member_jurisdiction_preferences_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.grievances') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.grievances for grievance_case_access_assignments_grievance_id_grievances_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'grievance_case_access_assignments') THEN
    EXECUTE $ddl$ALTER TABLE "grievance_case_access_assignments" ADD CONSTRAINT "grievance_case_access_assignments_grievance_id_grievances_id_fk" FOREIGN KEY ("grievance_id") REFERENCES "public"."grievances"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('grievance_case_access_assignments_grievance_id_grievances_id_fk', 63) AND conrelid = to_regclass('public.grievance_case_access_assignments')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.grievance_case_access_assignments: constraint grievance_case_access_assignments_grievance_id_grievances_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.collective_agreements') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.collective_agreements for cba_clauses_cba_id_collective_agreements_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'cba_clauses') THEN
    EXECUTE $ddl$ALTER TABLE "cba_clauses" ADD CONSTRAINT "cba_clauses_cba_id_collective_agreements_id_fk" FOREIGN KEY ("cba_id") REFERENCES "public"."collective_agreements"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('cba_clauses_cba_id_collective_agreements_id_fk', 63) AND conrelid = to_regclass('public.cba_clauses')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.cba_clauses: constraint cba_clauses_cba_id_collective_agreements_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for cost_centers_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'cost_centers') THEN
    EXECUTE $ddl$ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('cost_centers_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.cost_centers')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.cost_centers: constraint cost_centers_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.cost_centers') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.cost_centers for cost_centers_parent_cost_center_id_cost_centers_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'cost_centers') THEN
    EXECUTE $ddl$ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_parent_cost_center_id_cost_centers_id_fk" FOREIGN KEY ("parent_cost_center_id") REFERENCES "public"."cost_centers"("id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('cost_centers_parent_cost_center_id_cost_centers_id_fk', 63) AND conrelid = to_regclass('public.cost_centers')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.cost_centers: constraint cost_centers_parent_cost_center_id_cost_centers_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for commercial_contracts_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'commercial_contracts') THEN
    EXECUTE $ddl$ALTER TABLE "commercial_contracts" ADD CONSTRAINT "commercial_contracts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('commercial_contracts_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.commercial_contracts')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.commercial_contracts: constraint commercial_contracts_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.billing_accounts') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.billing_accounts for commercial_contracts_billing_account_id_billing_accounts_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'commercial_contracts') THEN
    EXECUTE $ddl$ALTER TABLE "commercial_contracts" ADD CONSTRAINT "commercial_contracts_billing_account_id_billing_accounts_id_fk" FOREIGN KEY ("billing_account_id") REFERENCES "public"."billing_accounts"("id") ON DELETE restrict ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('commercial_contracts_billing_account_id_billing_accounts_id_fk', 63) AND conrelid = to_regclass('public.commercial_contracts')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.commercial_contracts: constraint commercial_contracts_billing_account_id_billing_accounts_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.org_subscriptions') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.org_subscriptions for commercial_contracts_subscription_id_org_subscriptions_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'commercial_contracts') THEN
    EXECUTE $ddl$ALTER TABLE "commercial_contracts" ADD CONSTRAINT "commercial_contracts_subscription_id_org_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."org_subscriptions"("id") ON DELETE restrict ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('commercial_contracts_subscription_id_org_subscriptions_id_fk', 63) AND conrelid = to_regclass('public.commercial_contracts')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.commercial_contracts: constraint commercial_contracts_subscription_id_org_subscriptions_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.commercial_contracts') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.commercial_contracts for contract_line_items_contract_id_commercial_contracts_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'contract_line_items') THEN
    EXECUTE $ddl$ALTER TABLE "contract_line_items" ADD CONSTRAINT "contract_line_items_contract_id_commercial_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."commercial_contracts"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('contract_line_items_contract_id_commercial_contracts_id_fk', 63) AND conrelid = to_regclass('public.contract_line_items')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.contract_line_items: constraint contract_line_items_contract_id_commercial_contracts_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.org_entitlements') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.org_entitlements for entitlement_usage_log_entitlement_id_org_entitlements_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'entitlement_usage_log') THEN
    EXECUTE $ddl$ALTER TABLE "entitlement_usage_log" ADD CONSTRAINT "entitlement_usage_log_entitlement_id_org_entitlements_id_fk" FOREIGN KEY ("entitlement_id") REFERENCES "public"."org_entitlements"("id") ON DELETE restrict ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('entitlement_usage_log_entitlement_id_org_entitlements_id_fk', 63) AND conrelid = to_regclass('public.entitlement_usage_log')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.entitlement_usage_log: constraint entitlement_usage_log_entitlement_id_org_entitlements_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for entitlement_usage_log_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'entitlement_usage_log') THEN
    EXECUTE $ddl$ALTER TABLE "entitlement_usage_log" ADD CONSTRAINT "entitlement_usage_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('entitlement_usage_log_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.entitlement_usage_log')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.entitlement_usage_log: constraint entitlement_usage_log_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for org_entitlements_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'org_entitlements') THEN
    EXECUTE $ddl$ALTER TABLE "org_entitlements" ADD CONSTRAINT "org_entitlements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('org_entitlements_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.org_entitlements')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.org_entitlements: constraint org_entitlements_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.contract_line_items') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.contract_line_items for org_entitlements_contract_line_item_id_contract_line_items_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'org_entitlements') THEN
    EXECUTE $ddl$ALTER TABLE "org_entitlements" ADD CONSTRAINT "org_entitlements_contract_line_item_id_contract_line_items_id_fk" FOREIGN KEY ("contract_line_item_id") REFERENCES "public"."contract_line_items"("id") ON DELETE set null ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('org_entitlements_contract_line_item_id_contract_line_items_id_fk', 63) AND conrelid = to_regclass('public.org_entitlements')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.org_entitlements: constraint org_entitlements_contract_line_item_id_contract_line_items_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for subscription_events_log_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'subscription_events_log') THEN
    EXECUTE $ddl$ALTER TABLE "subscription_events_log" ADD CONSTRAINT "subscription_events_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('subscription_events_log_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.subscription_events_log')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.subscription_events_log: constraint subscription_events_log_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.org_subscriptions') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.org_subscriptions for subscription_events_log_subscription_id_org_subscriptions_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'subscription_events_log') THEN
    EXECUTE $ddl$ALTER TABLE "subscription_events_log" ADD CONSTRAINT "subscription_events_log_subscription_id_org_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."org_subscriptions"("id") ON DELETE restrict ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('subscription_events_log_subscription_id_org_subscriptions_id_fk', 63) AND conrelid = to_regclass('public.subscription_events_log')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.subscription_events_log: constraint subscription_events_log_subscription_id_org_subscriptions_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for billing_accounts_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'billing_accounts') THEN
    EXECUTE $ddl$ALTER TABLE "billing_accounts" ADD CONSTRAINT "billing_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('billing_accounts_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.billing_accounts')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.billing_accounts: constraint billing_accounts_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for billing_periods_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'billing_periods') THEN
    EXECUTE $ddl$ALTER TABLE "billing_periods" ADD CONSTRAINT "billing_periods_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('billing_periods_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.billing_periods')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.billing_periods: constraint billing_periods_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.platform_payments') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.platform_payments for payment_allocations_payment_id_platform_payments_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'payment_allocations') THEN
    EXECUTE $ddl$ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_platform_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."platform_payments"("id") ON DELETE restrict ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('payment_allocations_payment_id_platform_payments_id_fk', 63) AND conrelid = to_regclass('public.payment_allocations')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.payment_allocations: constraint payment_allocations_payment_id_platform_payments_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.platform_invoices') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.platform_invoices for payment_allocations_invoice_id_platform_invoices_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'payment_allocations') THEN
    EXECUTE $ddl$ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_invoice_id_platform_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."platform_invoices"("id") ON DELETE restrict ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('payment_allocations_invoice_id_platform_invoices_id_fk', 63) AND conrelid = to_regclass('public.payment_allocations')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.payment_allocations: constraint payment_allocations_invoice_id_platform_invoices_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.platform_invoices') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.platform_invoices for platform_invoice_line_items_invoice_id_platform_invoices_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'platform_invoice_line_items') THEN
    EXECUTE $ddl$ALTER TABLE "platform_invoice_line_items" ADD CONSTRAINT "platform_invoice_line_items_invoice_id_platform_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."platform_invoices"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('platform_invoice_line_items_invoice_id_platform_invoices_id_fk', 63) AND conrelid = to_regclass('public.platform_invoice_line_items')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.platform_invoice_line_items: constraint platform_invoice_line_items_invoice_id_platform_invoices_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for platform_cost_ledger_entries_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'platform_cost_ledger_entries') THEN
    EXECUTE $ddl$ALTER TABLE "platform_cost_ledger_entries" ADD CONSTRAINT "platform_cost_ledger_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('platform_cost_ledger_entries_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.platform_cost_ledger_entries')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.platform_cost_ledger_entries: constraint platform_cost_ledger_entries_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for platform_cost_ledger_entries_parent_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'platform_cost_ledger_entries') THEN
    EXECUTE $ddl$ALTER TABLE "platform_cost_ledger_entries" ADD CONSTRAINT "platform_cost_ledger_entries_parent_organization_id_organizations_id_fk" FOREIGN KEY ("parent_organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('platform_cost_ledger_entries_parent_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.platform_cost_ledger_entries')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.platform_cost_ledger_entries: constraint platform_cost_ledger_entries_parent_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.billing_periods') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.billing_periods for platform_cost_ledger_entries_billing_period_id_billing_periods_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'platform_cost_ledger_entries') THEN
    EXECUTE $ddl$ALTER TABLE "platform_cost_ledger_entries" ADD CONSTRAINT "platform_cost_ledger_entries_billing_period_id_billing_periods_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_periods"("id") ON DELETE restrict ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('platform_cost_ledger_entries_billing_period_id_billing_periods_id_fk', 63) AND conrelid = to_regclass('public.platform_cost_ledger_entries')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.platform_cost_ledger_entries: constraint platform_cost_ledger_entries_billing_period_id_billing_periods_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.cost_centers') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.cost_centers for platform_cost_ledger_entries_cost_center_id_cost_centers_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'platform_cost_ledger_entries') THEN
    EXECUTE $ddl$ALTER TABLE "platform_cost_ledger_entries" ADD CONSTRAINT "platform_cost_ledger_entries_cost_center_id_cost_centers_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "public"."cost_centers"("id") ON DELETE restrict ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('platform_cost_ledger_entries_cost_center_id_cost_centers_id_fk', 63) AND conrelid = to_regclass('public.platform_cost_ledger_entries')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.platform_cost_ledger_entries: constraint platform_cost_ledger_entries_cost_center_id_cost_centers_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.allocation_runs') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.allocation_runs for allocation_basis_snapshots_run_id_allocation_runs_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'allocation_basis_snapshots') THEN
    EXECUTE $ddl$ALTER TABLE "allocation_basis_snapshots" ADD CONSTRAINT "allocation_basis_snapshots_run_id_allocation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."allocation_runs"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('allocation_basis_snapshots_run_id_allocation_runs_id_fk', 63) AND conrelid = to_regclass('public.allocation_basis_snapshots')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.allocation_basis_snapshots: constraint allocation_basis_snapshots_run_id_allocation_runs_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.allocation_rules') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.allocation_rules for allocation_rule_versions_rule_id_allocation_rules_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'allocation_rule_versions') THEN
    EXECUTE $ddl$ALTER TABLE "allocation_rule_versions" ADD CONSTRAINT "allocation_rule_versions_rule_id_allocation_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."allocation_rules"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('allocation_rule_versions_rule_id_allocation_rules_id_fk', 63) AND conrelid = to_regclass('public.allocation_rule_versions')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.allocation_rule_versions: constraint allocation_rule_versions_rule_id_allocation_rules_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for allocation_rules_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'allocation_rules') THEN
    EXECUTE $ddl$ALTER TABLE "allocation_rules" ADD CONSTRAINT "allocation_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('allocation_rules_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.allocation_rules')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.allocation_rules: constraint allocation_rules_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.allocation_runs') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.allocation_runs for allocation_run_lines_run_id_allocation_runs_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'allocation_run_lines') THEN
    EXECUTE $ddl$ALTER TABLE "allocation_run_lines" ADD CONSTRAINT "allocation_run_lines_run_id_allocation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."allocation_runs"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('allocation_run_lines_run_id_allocation_runs_id_fk', 63) AND conrelid = to_regclass('public.allocation_run_lines')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.allocation_run_lines: constraint allocation_run_lines_run_id_allocation_runs_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for allocation_runs_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'allocation_runs') THEN
    EXECUTE $ddl$ALTER TABLE "allocation_runs" ADD CONSTRAINT "allocation_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('allocation_runs_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.allocation_runs')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.allocation_runs: constraint allocation_runs_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.billing_periods') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.billing_periods for allocation_runs_billing_period_id_billing_periods_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'allocation_runs') THEN
    EXECUTE $ddl$ALTER TABLE "allocation_runs" ADD CONSTRAINT "allocation_runs_billing_period_id_billing_periods_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_periods"("id") ON DELETE restrict ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('allocation_runs_billing_period_id_billing_periods_id_fk', 63) AND conrelid = to_regclass('public.allocation_runs')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.allocation_runs: constraint allocation_runs_billing_period_id_billing_periods_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.allocation_rule_versions') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.allocation_rule_versions for allocation_runs_rule_version_id_allocation_rule_versions_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'allocation_runs') THEN
    EXECUTE $ddl$ALTER TABLE "allocation_runs" ADD CONSTRAINT "allocation_runs_rule_version_id_allocation_rule_versions_id_fk" FOREIGN KEY ("rule_version_id") REFERENCES "public"."allocation_rule_versions"("id") ON DELETE restrict ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('allocation_runs_rule_version_id_allocation_rule_versions_id_fk', 63) AND conrelid = to_regclass('public.allocation_runs')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.allocation_runs: constraint allocation_runs_rule_version_id_allocation_rule_versions_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for chargeback_statements_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'chargeback_statements') THEN
    EXECUTE $ddl$ALTER TABLE "chargeback_statements" ADD CONSTRAINT "chargeback_statements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('chargeback_statements_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.chargeback_statements')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.chargeback_statements: constraint chargeback_statements_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.billing_periods') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.billing_periods for chargeback_statements_billing_period_id_billing_periods_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'chargeback_statements') THEN
    EXECUTE $ddl$ALTER TABLE "chargeback_statements" ADD CONSTRAINT "chargeback_statements_billing_period_id_billing_periods_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_periods"("id") ON DELETE restrict ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('chargeback_statements_billing_period_id_billing_periods_id_fk', 63) AND conrelid = to_regclass('public.chargeback_statements')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.chargeback_statements: constraint chargeback_statements_billing_period_id_billing_periods_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.allocation_runs') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.allocation_runs for chargeback_statements_allocation_run_id_allocation_runs_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'chargeback_statements') THEN
    EXECUTE $ddl$ALTER TABLE "chargeback_statements" ADD CONSTRAINT "chargeback_statements_allocation_run_id_allocation_runs_id_fk" FOREIGN KEY ("allocation_run_id") REFERENCES "public"."allocation_runs"("id") ON DELETE restrict ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('chargeback_statements_allocation_run_id_allocation_runs_id_fk', 63) AND conrelid = to_regclass('public.chargeback_statements')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.chargeback_statements: constraint chargeback_statements_allocation_run_id_allocation_runs_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.transaction_fee_events') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.transaction_fee_events for fee_adjustments_fee_event_id_transaction_fee_events_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'fee_adjustments') THEN
    EXECUTE $ddl$ALTER TABLE "fee_adjustments" ADD CONSTRAINT "fee_adjustments_fee_event_id_transaction_fee_events_id_fk" FOREIGN KEY ("fee_event_id") REFERENCES "public"."transaction_fee_events"("id") ON DELETE restrict ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('fee_adjustments_fee_event_id_transaction_fee_events_id_fk', 63) AND conrelid = to_regclass('public.fee_adjustments')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.fee_adjustments: constraint fee_adjustments_fee_event_id_transaction_fee_events_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for fee_adjustments_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'fee_adjustments') THEN
    EXECUTE $ddl$ALTER TABLE "fee_adjustments" ADD CONSTRAINT "fee_adjustments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('fee_adjustments_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.fee_adjustments')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.fee_adjustments: constraint fee_adjustments_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for transaction_fee_events_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'transaction_fee_events') THEN
    EXECUTE $ddl$ALTER TABLE "transaction_fee_events" ADD CONSTRAINT "transaction_fee_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('transaction_fee_events_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.transaction_fee_events')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.transaction_fee_events: constraint transaction_fee_events_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.transaction_fee_rules') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.transaction_fee_rules for transaction_fee_events_rule_id_transaction_fee_rules_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'transaction_fee_events') THEN
    EXECUTE $ddl$ALTER TABLE "transaction_fee_events" ADD CONSTRAINT "transaction_fee_events_rule_id_transaction_fee_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."transaction_fee_rules"("id") ON DELETE restrict ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('transaction_fee_events_rule_id_transaction_fee_rules_id_fk', 63) AND conrelid = to_regclass('public.transaction_fee_events')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.transaction_fee_events: constraint transaction_fee_events_rule_id_transaction_fee_rules_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.commercial_contracts') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.commercial_contracts for transaction_fee_events_contract_id_commercial_contracts_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'transaction_fee_events') THEN
    EXECUTE $ddl$ALTER TABLE "transaction_fee_events" ADD CONSTRAINT "transaction_fee_events_contract_id_commercial_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."commercial_contracts"("id") ON DELETE set null ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('transaction_fee_events_contract_id_commercial_contracts_id_fk', 63) AND conrelid = to_regclass('public.transaction_fee_events')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.transaction_fee_events: constraint transaction_fee_events_contract_id_commercial_contracts_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.fee_settlement_batches') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.fee_settlement_batches for transaction_fee_events_settlement_batch_id_fee_settlement_batches_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'transaction_fee_events') THEN
    EXECUTE $ddl$ALTER TABLE "transaction_fee_events" ADD CONSTRAINT "transaction_fee_events_settlement_batch_id_fee_settlement_batches_id_fk" FOREIGN KEY ("settlement_batch_id") REFERENCES "public"."fee_settlement_batches"("id") ON DELETE set null ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('transaction_fee_events_settlement_batch_id_fee_settlement_batches_id_fk', 63) AND conrelid = to_regclass('public.transaction_fee_events')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.transaction_fee_events: constraint transaction_fee_events_settlement_batch_id_fee_settlement_batches_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for transaction_fee_rules_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'transaction_fee_rules') THEN
    EXECUTE $ddl$ALTER TABLE "transaction_fee_rules" ADD CONSTRAINT "transaction_fee_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('transaction_fee_rules_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.transaction_fee_rules')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.transaction_fee_rules: constraint transaction_fee_rules_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.commercial_contracts') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.commercial_contracts for transaction_fee_rules_contract_id_commercial_contracts_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'transaction_fee_rules') THEN
    EXECUTE $ddl$ALTER TABLE "transaction_fee_rules" ADD CONSTRAINT "transaction_fee_rules_contract_id_commercial_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."commercial_contracts"("id") ON DELETE set null ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('transaction_fee_rules_contract_id_commercial_contracts_id_fk', 63) AND conrelid = to_regclass('public.transaction_fee_rules')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.transaction_fee_rules: constraint transaction_fee_rules_contract_id_commercial_contracts_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.commercial_contracts') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.commercial_contracts for contract_covered_orgs_contract_id_commercial_contracts_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'contract_covered_orgs') THEN
    EXECUTE $ddl$ALTER TABLE "contract_covered_orgs" ADD CONSTRAINT "contract_covered_orgs_contract_id_commercial_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."commercial_contracts"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('contract_covered_orgs_contract_id_commercial_contracts_id_fk', 63) AND conrelid = to_regclass('public.contract_covered_orgs')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.contract_covered_orgs: constraint contract_covered_orgs_contract_id_commercial_contracts_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for contract_covered_orgs_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'contract_covered_orgs') THEN
    EXECUTE $ddl$ALTER TABLE "contract_covered_orgs" ADD CONSTRAINT "contract_covered_orgs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('contract_covered_orgs_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.contract_covered_orgs')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.contract_covered_orgs: constraint contract_covered_orgs_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.reconciliation_runs') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.reconciliation_runs for reconciliation_exceptions_run_id_reconciliation_runs_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'reconciliation_exceptions') THEN
    EXECUTE $ddl$ALTER TABLE "reconciliation_exceptions" ADD CONSTRAINT "reconciliation_exceptions_run_id_reconciliation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."reconciliation_runs"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('reconciliation_exceptions_run_id_reconciliation_runs_id_fk', 63) AND conrelid = to_regclass('public.reconciliation_exceptions')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.reconciliation_exceptions: constraint reconciliation_exceptions_run_id_reconciliation_runs_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for reconciliation_exceptions_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'reconciliation_exceptions') THEN
    EXECUTE $ddl$ALTER TABLE "reconciliation_exceptions" ADD CONSTRAINT "reconciliation_exceptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('reconciliation_exceptions_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.reconciliation_exceptions')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.reconciliation_exceptions: constraint reconciliation_exceptions_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.reconciliation_runs') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.reconciliation_runs for reconciliation_matches_run_id_reconciliation_runs_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'reconciliation_matches') THEN
    EXECUTE $ddl$ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_run_id_reconciliation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."reconciliation_runs"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('reconciliation_matches_run_id_reconciliation_runs_id_fk', 63) AND conrelid = to_regclass('public.reconciliation_matches')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.reconciliation_matches: constraint reconciliation_matches_run_id_reconciliation_runs_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for reconciliation_runs_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'reconciliation_runs') THEN
    EXECUTE $ddl$ALTER TABLE "reconciliation_runs" ADD CONSTRAINT "reconciliation_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('reconciliation_runs_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.reconciliation_runs')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.reconciliation_runs: constraint reconciliation_runs_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.claims') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.claims for case_documents_claim_id_claims_claim_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'case_documents') THEN
    EXECUTE $ddl$ALTER TABLE "case_documents" ADD CONSTRAINT "case_documents_claim_id_claims_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("claim_id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('case_documents_claim_id_claims_claim_id_fk', 63) AND conrelid = to_regclass('public.case_documents')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.case_documents: constraint case_documents_claim_id_claims_claim_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.documents') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.documents for case_documents_document_id_documents_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'case_documents') THEN
    EXECUTE $ddl$ALTER TABLE "case_documents" ADD CONSTRAINT "case_documents_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('case_documents_document_id_documents_id_fk', 63) AND conrelid = to_regclass('public.case_documents')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.case_documents: constraint case_documents_document_id_documents_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for case_documents_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'case_documents') THEN
    EXECUTE $ddl$ALTER TABLE "case_documents" ADD CONSTRAINT "case_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('case_documents_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.case_documents')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.case_documents: constraint case_documents_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for document_access_grants_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'document_access_grants') THEN
    EXECUTE $ddl$ALTER TABLE "document_access_grants" ADD CONSTRAINT "document_access_grants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('document_access_grants_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.document_access_grants')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.document_access_grants: constraint document_access_grants_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.documents') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.documents for document_access_grants_document_id_documents_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'document_access_grants') THEN
    EXECUTE $ddl$ALTER TABLE "document_access_grants" ADD CONSTRAINT "document_access_grants_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('document_access_grants_document_id_documents_id_fk', 63) AND conrelid = to_regclass('public.document_access_grants')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.document_access_grants: constraint document_access_grants_document_id_documents_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for document_links_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'document_links') THEN
    EXECUTE $ddl$ALTER TABLE "document_links" ADD CONSTRAINT "document_links_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('document_links_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.document_links')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.document_links: constraint document_links_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.documents') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.documents for document_links_document_id_documents_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'document_links') THEN
    EXECUTE $ddl$ALTER TABLE "document_links" ADD CONSTRAINT "document_links_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('document_links_document_id_documents_id_fk', 63) AND conrelid = to_regclass('public.document_links')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.document_links: constraint document_links_document_id_documents_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for document_versions_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'document_versions') THEN
    EXECUTE $ddl$ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('document_versions_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.document_versions')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.document_versions: constraint document_versions_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.documents') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.documents for document_versions_document_id_documents_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'document_versions') THEN
    EXECUTE $ddl$ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('document_versions_document_id_documents_id_fk', 63) AND conrelid = to_regclass('public.document_versions')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.document_versions: constraint document_versions_document_id_documents_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for correspondence_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'correspondence') THEN
    EXECUTE $ddl$ALTER TABLE "correspondence" ADD CONSTRAINT "correspondence_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('correspondence_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.correspondence')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.correspondence: constraint correspondence_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.profiles for correspondence_drafted_by_profiles_user_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'correspondence') THEN
    EXECUTE $ddl$ALTER TABLE "correspondence" ADD CONSTRAINT "correspondence_drafted_by_profiles_user_id_fk" FOREIGN KEY ("drafted_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('correspondence_drafted_by_profiles_user_id_fk', 63) AND conrelid = to_regclass('public.correspondence')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.correspondence: constraint correspondence_drafted_by_profiles_user_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.profiles for correspondence_assigned_signer_id_profiles_user_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'correspondence') THEN
    EXECUTE $ddl$ALTER TABLE "correspondence" ADD CONSTRAINT "correspondence_assigned_signer_id_profiles_user_id_fk" FOREIGN KEY ("assigned_signer_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('correspondence_assigned_signer_id_profiles_user_id_fk', 63) AND conrelid = to_regclass('public.correspondence')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.correspondence: constraint correspondence_assigned_signer_id_profiles_user_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.profiles for correspondence_approved_by_profiles_user_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'correspondence') THEN
    EXECUTE $ddl$ALTER TABLE "correspondence" ADD CONSTRAINT "correspondence_approved_by_profiles_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('correspondence_approved_by_profiles_user_id_fk', 63) AND conrelid = to_regclass('public.correspondence')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.correspondence: constraint correspondence_approved_by_profiles_user_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.profiles for correspondence_signed_by_profiles_user_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'correspondence') THEN
    EXECUTE $ddl$ALTER TABLE "correspondence" ADD CONSTRAINT "correspondence_signed_by_profiles_user_id_fk" FOREIGN KEY ("signed_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('correspondence_signed_by_profiles_user_id_fk', 63) AND conrelid = to_regclass('public.correspondence')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.correspondence: constraint correspondence_signed_by_profiles_user_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.profiles for correspondence_dispatched_by_profiles_user_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'correspondence') THEN
    EXECUTE $ddl$ALTER TABLE "correspondence" ADD CONSTRAINT "correspondence_dispatched_by_profiles_user_id_fk" FOREIGN KEY ("dispatched_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('correspondence_dispatched_by_profiles_user_id_fk', 63) AND conrelid = to_regclass('public.correspondence')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.correspondence: constraint correspondence_dispatched_by_profiles_user_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.correspondence') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.correspondence for correspondence_audit_trail_correspondence_id_correspondence_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'correspondence_audit_trail') THEN
    EXECUTE $ddl$ALTER TABLE "correspondence_audit_trail" ADD CONSTRAINT "correspondence_audit_trail_correspondence_id_correspondence_id_fk" FOREIGN KEY ("correspondence_id") REFERENCES "public"."correspondence"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('correspondence_audit_trail_correspondence_id_correspondence_id_fk', 63) AND conrelid = to_regclass('public.correspondence_audit_trail')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.correspondence_audit_trail: constraint correspondence_audit_trail_correspondence_id_correspondence_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.profiles for correspondence_audit_trail_actor_user_id_profiles_user_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'correspondence_audit_trail') THEN
    EXECUTE $ddl$ALTER TABLE "correspondence_audit_trail" ADD CONSTRAINT "correspondence_audit_trail_actor_user_id_profiles_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('correspondence_audit_trail_actor_user_id_profiles_user_id_fk', 63) AND conrelid = to_regclass('public.correspondence_audit_trail')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.correspondence_audit_trail: constraint correspondence_audit_trail_actor_user_id_profiles_user_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.correspondence') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.correspondence for correspondence_recipients_correspondence_id_correspondence_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'correspondence_recipients') THEN
    EXECUTE $ddl$ALTER TABLE "correspondence_recipients" ADD CONSTRAINT "correspondence_recipients_correspondence_id_correspondence_id_fk" FOREIGN KEY ("correspondence_id") REFERENCES "public"."correspondence"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('correspondence_recipients_correspondence_id_correspondence_id_fk', 63) AND conrelid = to_regclass('public.correspondence_recipients')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.correspondence_recipients: constraint correspondence_recipients_correspondence_id_correspondence_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for user_signatures_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'user_signatures') THEN
    EXECUTE $ddl$ALTER TABLE "user_signatures" ADD CONSTRAINT "user_signatures_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('user_signatures_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.user_signatures')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.user_signatures: constraint user_signatures_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.profiles for user_signatures_user_id_profiles_user_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'user_signatures') THEN
    EXECUTE $ddl$ALTER TABLE "user_signatures" ADD CONSTRAINT "user_signatures_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('user_signatures_user_id_profiles_user_id_fk', 63) AND conrelid = to_regclass('public.user_signatures')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.user_signatures: constraint user_signatures_user_id_profiles_user_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.deadline_reminders') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.deadline_reminders for deadline_reminder_executions_reminder_id_deadline_reminders_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'deadline_reminder_executions') THEN
    EXECUTE $ddl$ALTER TABLE "deadline_reminder_executions" ADD CONSTRAINT "deadline_reminder_executions_reminder_id_deadline_reminders_id_fk" FOREIGN KEY ("reminder_id") REFERENCES "public"."deadline_reminders"("id") ON DELETE restrict ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('deadline_reminder_executions_reminder_id_deadline_reminders_id_fk', 63) AND conrelid = to_regclass('public.deadline_reminder_executions')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.deadline_reminder_executions: constraint deadline_reminder_executions_reminder_id_deadline_reminders_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for org_configurations_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'org_configurations') THEN
    EXECUTE $ddl$ALTER TABLE "org_configurations" ADD CONSTRAINT "org_configurations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('org_configurations_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.org_configurations')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.org_configurations: constraint org_configurations_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for bargaining_units_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'bargaining_units') THEN
    EXECUTE $ddl$ALTER TABLE "bargaining_units" ADD CONSTRAINT "bargaining_units_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('bargaining_units_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.bargaining_units')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.bargaining_units: constraint bargaining_units_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.employers') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.employers for bargaining_units_employer_id_employers_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'bargaining_units') THEN
    EXECUTE $ddl$ALTER TABLE "bargaining_units" ADD CONSTRAINT "bargaining_units_employer_id_employers_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('bargaining_units_employer_id_employers_id_fk', 63) AND conrelid = to_regclass('public.bargaining_units')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.bargaining_units: constraint bargaining_units_employer_id_employers_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.worksites') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.worksites for bargaining_units_worksite_id_worksites_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'bargaining_units') THEN
    EXECUTE $ddl$ALTER TABLE "bargaining_units" ADD CONSTRAINT "bargaining_units_worksite_id_worksites_id_fk" FOREIGN KEY ("worksite_id") REFERENCES "public"."worksites"("id") ON DELETE set null ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('bargaining_units_worksite_id_worksites_id_fk', 63) AND conrelid = to_regclass('public.bargaining_units')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.bargaining_units: constraint bargaining_units_worksite_id_worksites_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.profiles for bargaining_units_chief_steward_id_profiles_user_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'bargaining_units') THEN
    EXECUTE $ddl$ALTER TABLE "bargaining_units" ADD CONSTRAINT "bargaining_units_chief_steward_id_profiles_user_id_fk" FOREIGN KEY ("chief_steward_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('bargaining_units_chief_steward_id_profiles_user_id_fk', 63) AND conrelid = to_regclass('public.bargaining_units')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.bargaining_units: constraint bargaining_units_chief_steward_id_profiles_user_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.profiles for bargaining_units_bargaining_chair_id_profiles_user_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'bargaining_units') THEN
    EXECUTE $ddl$ALTER TABLE "bargaining_units" ADD CONSTRAINT "bargaining_units_bargaining_chair_id_profiles_user_id_fk" FOREIGN KEY ("bargaining_chair_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('bargaining_units_bargaining_chair_id_profiles_user_id_fk', 63) AND conrelid = to_regclass('public.bargaining_units')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.bargaining_units: constraint bargaining_units_bargaining_chair_id_profiles_user_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.profiles for bargaining_units_created_by_profiles_user_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'bargaining_units') THEN
    EXECUTE $ddl$ALTER TABLE "bargaining_units" ADD CONSTRAINT "bargaining_units_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('bargaining_units_created_by_profiles_user_id_fk', 63) AND conrelid = to_regclass('public.bargaining_units')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.bargaining_units: constraint bargaining_units_created_by_profiles_user_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.profiles for bargaining_units_updated_by_profiles_user_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'bargaining_units') THEN
    EXECUTE $ddl$ALTER TABLE "bargaining_units" ADD CONSTRAINT "bargaining_units_updated_by_profiles_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('bargaining_units_updated_by_profiles_user_id_fk', 63) AND conrelid = to_regclass('public.bargaining_units')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.bargaining_units: constraint bargaining_units_updated_by_profiles_user_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for committees_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'committees') THEN
    EXECUTE $ddl$ALTER TABLE "committees" ADD CONSTRAINT "committees_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('committees_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.committees')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.committees: constraint committees_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.bargaining_units') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.bargaining_units for committees_unit_id_bargaining_units_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'committees') THEN
    EXECUTE $ddl$ALTER TABLE "committees" ADD CONSTRAINT "committees_unit_id_bargaining_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."bargaining_units"("id") ON DELETE set null ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('committees_unit_id_bargaining_units_id_fk', 63) AND conrelid = to_regclass('public.committees')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.committees: constraint committees_unit_id_bargaining_units_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.worksites') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.worksites for committees_worksite_id_worksites_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'committees') THEN
    EXECUTE $ddl$ALTER TABLE "committees" ADD CONSTRAINT "committees_worksite_id_worksites_id_fk" FOREIGN KEY ("worksite_id") REFERENCES "public"."worksites"("id") ON DELETE set null ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('committees_worksite_id_worksites_id_fk', 63) AND conrelid = to_regclass('public.committees')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.committees: constraint committees_worksite_id_worksites_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.profiles for committees_chair_id_profiles_user_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'committees') THEN
    EXECUTE $ddl$ALTER TABLE "committees" ADD CONSTRAINT "committees_chair_id_profiles_user_id_fk" FOREIGN KEY ("chair_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('committees_chair_id_profiles_user_id_fk', 63) AND conrelid = to_regclass('public.committees')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.committees: constraint committees_chair_id_profiles_user_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.profiles for committees_secretary_id_profiles_user_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'committees') THEN
    EXECUTE $ddl$ALTER TABLE "committees" ADD CONSTRAINT "committees_secretary_id_profiles_user_id_fk" FOREIGN KEY ("secretary_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('committees_secretary_id_profiles_user_id_fk', 63) AND conrelid = to_regclass('public.committees')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.committees: constraint committees_secretary_id_profiles_user_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.profiles for committees_created_by_profiles_user_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'committees') THEN
    EXECUTE $ddl$ALTER TABLE "committees" ADD CONSTRAINT "committees_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('committees_created_by_profiles_user_id_fk', 63) AND conrelid = to_regclass('public.committees')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.committees: constraint committees_created_by_profiles_user_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.profiles for committees_updated_by_profiles_user_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'committees') THEN
    EXECUTE $ddl$ALTER TABLE "committees" ADD CONSTRAINT "committees_updated_by_profiles_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('committees_updated_by_profiles_user_id_fk', 63) AND conrelid = to_regclass('public.committees')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.committees: constraint committees_updated_by_profiles_user_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for worksites_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'worksites') THEN
    EXECUTE $ddl$ALTER TABLE "worksites" ADD CONSTRAINT "worksites_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('worksites_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.worksites')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.worksites: constraint worksites_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.employers') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.employers for worksites_employer_id_employers_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'worksites') THEN
    EXECUTE $ddl$ALTER TABLE "worksites" ADD CONSTRAINT "worksites_employer_id_employers_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('worksites_employer_id_employers_id_fk', 63) AND conrelid = to_regclass('public.worksites')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.worksites: constraint worksites_employer_id_employers_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.profiles for worksites_created_by_profiles_user_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'worksites') THEN
    EXECUTE $ddl$ALTER TABLE "worksites" ADD CONSTRAINT "worksites_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('worksites_created_by_profiles_user_id_fk', 63) AND conrelid = to_regclass('public.worksites')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.worksites: constraint worksites_created_by_profiles_user_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.profiles for worksites_updated_by_profiles_user_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'worksites') THEN
    EXECUTE $ddl$ALTER TABLE "worksites" ADD CONSTRAINT "worksites_updated_by_profiles_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('worksites_updated_by_profiles_user_id_fk', 63) AND conrelid = to_regclass('public.worksites')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.worksites: constraint worksites_updated_by_profiles_user_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.committees') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.committees for committee_action_items_committee_id_committees_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'committee_action_items') THEN
    EXECUTE $ddl$ALTER TABLE "committee_action_items" ADD CONSTRAINT "committee_action_items_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('committee_action_items_committee_id_committees_id_fk', 63) AND conrelid = to_regclass('public.committee_action_items')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.committee_action_items: constraint committee_action_items_committee_id_committees_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.committee_meetings') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.committee_meetings for committee_action_items_meeting_id_committee_meetings_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'committee_action_items') THEN
    EXECUTE $ddl$ALTER TABLE "committee_action_items" ADD CONSTRAINT "committee_action_items_meeting_id_committee_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."committee_meetings"("id") ON DELETE set null ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('committee_action_items_meeting_id_committee_meetings_id_fk', 63) AND conrelid = to_regclass('public.committee_action_items')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.committee_action_items: constraint committee_action_items_meeting_id_committee_meetings_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for committee_action_items_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'committee_action_items') THEN
    EXECUTE $ddl$ALTER TABLE "committee_action_items" ADD CONSTRAINT "committee_action_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('committee_action_items_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.committee_action_items')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.committee_action_items: constraint committee_action_items_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.profiles for committee_action_items_assigned_to_profiles_user_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'committee_action_items') THEN
    EXECUTE $ddl$ALTER TABLE "committee_action_items" ADD CONSTRAINT "committee_action_items_assigned_to_profiles_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('committee_action_items_assigned_to_profiles_user_id_fk', 63) AND conrelid = to_regclass('public.committee_action_items')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.committee_action_items: constraint committee_action_items_assigned_to_profiles_user_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.profiles for committee_action_items_completed_by_profiles_user_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'committee_action_items') THEN
    EXECUTE $ddl$ALTER TABLE "committee_action_items" ADD CONSTRAINT "committee_action_items_completed_by_profiles_user_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('committee_action_items_completed_by_profiles_user_id_fk', 63) AND conrelid = to_regclass('public.committee_action_items')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.committee_action_items: constraint committee_action_items_completed_by_profiles_user_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.committee_meetings') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.committee_meetings for committee_action_items_carried_from_meeting_id_committee_meetings_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'committee_action_items') THEN
    EXECUTE $ddl$ALTER TABLE "committee_action_items" ADD CONSTRAINT "committee_action_items_carried_from_meeting_id_committee_meetings_id_fk" FOREIGN KEY ("carried_from_meeting_id") REFERENCES "public"."committee_meetings"("id") ON DELETE set null ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('committee_action_items_carried_from_meeting_id_committee_meetings_id_fk', 63) AND conrelid = to_regclass('public.committee_action_items')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.committee_action_items: constraint committee_action_items_carried_from_meeting_id_committee_meetings_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.profiles for committee_action_items_created_by_profiles_user_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'committee_action_items') THEN
    EXECUTE $ddl$ALTER TABLE "committee_action_items" ADD CONSTRAINT "committee_action_items_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('committee_action_items_created_by_profiles_user_id_fk', 63) AND conrelid = to_regclass('public.committee_action_items')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.committee_action_items: constraint committee_action_items_created_by_profiles_user_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.profiles for committee_action_items_updated_by_profiles_user_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'committee_action_items') THEN
    EXECUTE $ddl$ALTER TABLE "committee_action_items" ADD CONSTRAINT "committee_action_items_updated_by_profiles_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('committee_action_items_updated_by_profiles_user_id_fk', 63) AND conrelid = to_regclass('public.committee_action_items')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.committee_action_items: constraint committee_action_items_updated_by_profiles_user_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.committees') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.committees for committee_documents_committee_id_committees_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'committee_documents') THEN
    EXECUTE $ddl$ALTER TABLE "committee_documents" ADD CONSTRAINT "committee_documents_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('committee_documents_committee_id_committees_id_fk', 63) AND conrelid = to_regclass('public.committee_documents')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.committee_documents: constraint committee_documents_committee_id_committees_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for committee_documents_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'committee_documents') THEN
    EXECUTE $ddl$ALTER TABLE "committee_documents" ADD CONSTRAINT "committee_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('committee_documents_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.committee_documents')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.committee_documents: constraint committee_documents_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.committee_meetings') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.committee_meetings for committee_documents_meeting_id_committee_meetings_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'committee_documents') THEN
    EXECUTE $ddl$ALTER TABLE "committee_documents" ADD CONSTRAINT "committee_documents_meeting_id_committee_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."committee_meetings"("id") ON DELETE set null ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('committee_documents_meeting_id_committee_meetings_id_fk', 63) AND conrelid = to_regclass('public.committee_documents')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.committee_documents: constraint committee_documents_meeting_id_committee_meetings_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.profiles for committee_documents_uploaded_by_profiles_user_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'committee_documents') THEN
    EXECUTE $ddl$ALTER TABLE "committee_documents" ADD CONSTRAINT "committee_documents_uploaded_by_profiles_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('committee_documents_uploaded_by_profiles_user_id_fk', 63) AND conrelid = to_regclass('public.committee_documents')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.committee_documents: constraint committee_documents_uploaded_by_profiles_user_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for committee_intelligence_snapshots_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'committee_intelligence_snapshots') THEN
    EXECUTE $ddl$ALTER TABLE "committee_intelligence_snapshots" ADD CONSTRAINT "committee_intelligence_snapshots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('committee_intelligence_snapshots_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.committee_intelligence_snapshots')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.committee_intelligence_snapshots: constraint committee_intelligence_snapshots_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.committees') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.committees for committee_intelligence_snapshots_committee_id_committees_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'committee_intelligence_snapshots') THEN
    EXECUTE $ddl$ALTER TABLE "committee_intelligence_snapshots" ADD CONSTRAINT "committee_intelligence_snapshots_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('committee_intelligence_snapshots_committee_id_committees_id_fk', 63) AND conrelid = to_regclass('public.committee_intelligence_snapshots')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.committee_intelligence_snapshots: constraint committee_intelligence_snapshots_committee_id_committees_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.profiles for committee_intelligence_snapshots_generated_by_profiles_user_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'committee_intelligence_snapshots') THEN
    EXECUTE $ddl$ALTER TABLE "committee_intelligence_snapshots" ADD CONSTRAINT "committee_intelligence_snapshots_generated_by_profiles_user_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('committee_intelligence_snapshots_generated_by_profiles_user_id_fk', 63) AND conrelid = to_regclass('public.committee_intelligence_snapshots')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.committee_intelligence_snapshots: constraint committee_intelligence_snapshots_generated_by_profiles_user_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.committee_meetings') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.committee_meetings for committee_meeting_attendees_meeting_id_committee_meetings_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'committee_meeting_attendees') THEN
    EXECUTE $ddl$ALTER TABLE "committee_meeting_attendees" ADD CONSTRAINT "committee_meeting_attendees_meeting_id_committee_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."committee_meetings"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('committee_meeting_attendees_meeting_id_committee_meetings_id_fk', 63) AND conrelid = to_regclass('public.committee_meeting_attendees')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.committee_meeting_attendees: constraint committee_meeting_attendees_meeting_id_committee_meetings_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.profiles for committee_meeting_attendees_member_id_profiles_user_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'committee_meeting_attendees') THEN
    EXECUTE $ddl$ALTER TABLE "committee_meeting_attendees" ADD CONSTRAINT "committee_meeting_attendees_member_id_profiles_user_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('committee_meeting_attendees_member_id_profiles_user_id_fk', 63) AND conrelid = to_regclass('public.committee_meeting_attendees')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.committee_meeting_attendees: constraint committee_meeting_attendees_member_id_profiles_user_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.committees') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.committees for committee_meetings_committee_id_committees_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'committee_meetings') THEN
    EXECUTE $ddl$ALTER TABLE "committee_meetings" ADD CONSTRAINT "committee_meetings_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('committee_meetings_committee_id_committees_id_fk', 63) AND conrelid = to_regclass('public.committee_meetings')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.committee_meetings: constraint committee_meetings_committee_id_committees_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for committee_meetings_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'committee_meetings') THEN
    EXECUTE $ddl$ALTER TABLE "committee_meetings" ADD CONSTRAINT "committee_meetings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('committee_meetings_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.committee_meetings')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.committee_meetings: constraint committee_meetings_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.profiles for committee_meetings_minutes_approved_by_profiles_user_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'committee_meetings') THEN
    EXECUTE $ddl$ALTER TABLE "committee_meetings" ADD CONSTRAINT "committee_meetings_minutes_approved_by_profiles_user_id_fk" FOREIGN KEY ("minutes_approved_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('committee_meetings_minutes_approved_by_profiles_user_id_fk', 63) AND conrelid = to_regclass('public.committee_meetings')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.committee_meetings: constraint committee_meetings_minutes_approved_by_profiles_user_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.profiles for committee_meetings_created_by_profiles_user_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'committee_meetings') THEN
    EXECUTE $ddl$ALTER TABLE "committee_meetings" ADD CONSTRAINT "committee_meetings_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('committee_meetings_created_by_profiles_user_id_fk', 63) AND conrelid = to_regclass('public.committee_meetings')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.committee_meetings: constraint committee_meetings_created_by_profiles_user_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.profiles for committee_meetings_updated_by_profiles_user_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'committee_meetings') THEN
    EXECUTE $ddl$ALTER TABLE "committee_meetings" ADD CONSTRAINT "committee_meetings_updated_by_profiles_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('committee_meetings_updated_by_profiles_user_id_fk', 63) AND conrelid = to_regclass('public.committee_meetings')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.committee_meetings: constraint committee_meetings_updated_by_profiles_user_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for data_quality_warnings_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'data_quality_warnings') THEN
    EXECUTE $ddl$ALTER TABLE "data_quality_warnings" ADD CONSTRAINT "data_quality_warnings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('data_quality_warnings_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.data_quality_warnings')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.data_quality_warnings: constraint data_quality_warnings_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.ingestion_batches') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.ingestion_batches for data_quality_warnings_batch_id_ingestion_batches_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'data_quality_warnings') THEN
    EXECUTE $ddl$ALTER TABLE "data_quality_warnings" ADD CONSTRAINT "data_quality_warnings_batch_id_ingestion_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."ingestion_batches"("id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('data_quality_warnings_batch_id_ingestion_batches_id_fk', 63) AND conrelid = to_regclass('public.data_quality_warnings')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.data_quality_warnings: constraint data_quality_warnings_batch_id_ingestion_batches_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.duplicate_groups') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.duplicate_groups for duplicate_group_members_group_id_duplicate_groups_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'duplicate_group_members') THEN
    EXECUTE $ddl$ALTER TABLE "duplicate_group_members" ADD CONSTRAINT "duplicate_group_members_group_id_duplicate_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."duplicate_groups"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('duplicate_group_members_group_id_duplicate_groups_id_fk', 63) AND conrelid = to_regclass('public.duplicate_group_members')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.duplicate_group_members: constraint duplicate_group_members_group_id_duplicate_groups_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for duplicate_groups_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'duplicate_groups') THEN
    EXECUTE $ddl$ALTER TABLE "duplicate_groups" ADD CONSTRAINT "duplicate_groups_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('duplicate_groups_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.duplicate_groups')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.duplicate_groups: constraint duplicate_groups_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.grievances') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.grievances for grievance_timeline_events_grievance_id_grievances_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'grievance_timeline_events') THEN
    EXECUTE $ddl$ALTER TABLE "grievance_timeline_events" ADD CONSTRAINT "grievance_timeline_events_grievance_id_grievances_id_fk" FOREIGN KEY ("grievance_id") REFERENCES "public"."grievances"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('grievance_timeline_events_grievance_id_grievances_id_fk', 63) AND conrelid = to_regclass('public.grievance_timeline_events')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.grievance_timeline_events: constraint grievance_timeline_events_grievance_id_grievances_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for grievance_timeline_events_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'grievance_timeline_events') THEN
    EXECUTE $ddl$ALTER TABLE "grievance_timeline_events" ADD CONSTRAINT "grievance_timeline_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('grievance_timeline_events_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.grievance_timeline_events')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.grievance_timeline_events: constraint grievance_timeline_events_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.organizations for ingestion_batches_organization_id_organizations_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'ingestion_batches') THEN
    EXECUTE $ddl$ALTER TABLE "ingestion_batches" ADD CONSTRAINT "ingestion_batches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('ingestion_batches_organization_id_organizations_id_fk', 63) AND conrelid = to_regclass('public.ingestion_batches')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.ingestion_batches: constraint ingestion_batches_organization_id_organizations_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  IF to_regclass('public.ingestion_batches') IS NULL THEN
    RAISE EXCEPTION 'missing parent public.ingestion_batches for ingestion_records_batch_id_ingestion_batches_id_fk';
  END IF;
  IF EXISTS (SELECT 1 FROM ue_bootstrap_created_relations WHERE relname = 'ingestion_records') THEN
    EXECUTE $ddl$ALTER TABLE "ingestion_records" ADD CONSTRAINT "ingestion_records_batch_id_ingestion_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."ingestion_batches"("id") ON DELETE cascade ON UPDATE no action;$ddl$;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = left('ingestion_records_batch_id_ingestion_batches_id_fk', 63) AND conrelid = to_regclass('public.ingestion_records')
  ) THEN
    RAISE EXCEPTION 'incompatible existing relation public.ingestion_records: constraint ingestion_records_batch_id_ingestion_batches_id_fk is absent';
  END IF;
END
$ue$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employers_organization" ON "employers" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employers_status" ON "employers" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employers_name" ON "employers" USING btree ("name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employers_parent_company" ON "employers" USING btree ("parent_company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_case_access_grievance" ON "grievance_case_access_assignments" USING btree ("grievance_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_case_access_user" ON "grievance_case_access_assignments" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_case_access_org" ON "grievance_case_access_assignments" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_case_access_status" ON "grievance_case_access_assignments" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_case_access_expires" ON "grievance_case_access_assignments" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cba_organization_idx" ON "collective_agreements" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cba_jurisdiction_idx" ON "collective_agreements" USING btree ("jurisdiction");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cba_employer_idx" ON "collective_agreements" USING btree ("employer_name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cba_union_idx" ON "collective_agreements" USING btree ("union_name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cba_expiry_idx" ON "collective_agreements" USING btree ("expiry_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cba_status_idx" ON "collective_agreements" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cba_effective_date_idx" ON "collective_agreements" USING btree ("effective_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cba_sector_idx" ON "collective_agreements" USING btree ("industry_sector");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cba_clauses_cba_idx" ON "cba_clauses" USING btree ("cba_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cba_clauses_type_idx" ON "cba_clauses" USING btree ("clause_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cba_clauses_number_idx" ON "cba_clauses" USING btree ("clause_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cba_clauses_parent_idx" ON "cba_clauses" USING btree ("parent_clause_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cba_clauses_confidence_idx" ON "cba_clauses" USING btree ("confidence_score");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_centers_org_idx" ON "cost_centers" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_centers_code_idx" ON "cost_centers" USING btree ("code","organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_centers_type_idx" ON "cost_centers" USING btree ("type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_centers_status_idx" ON "cost_centers" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commercial_contracts_org_idx" ON "commercial_contracts" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commercial_contracts_billing_idx" ON "commercial_contracts" USING btree ("billing_account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commercial_contracts_status_idx" ON "commercial_contracts" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commercial_contracts_expiration_idx" ON "commercial_contracts" USING btree ("expiration_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contract_line_items_contract_idx" ON "contract_line_items" USING btree ("contract_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contract_line_items_feature_idx" ON "contract_line_items" USING btree ("feature_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entitlement_usage_log_entitlement_idx" ON "entitlement_usage_log" USING btree ("entitlement_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entitlement_usage_log_org_idx" ON "entitlement_usage_log" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entitlement_usage_log_created_idx" ON "entitlement_usage_log" USING btree ("created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "org_entitlements_org_feature_idx" ON "org_entitlements" USING btree ("organization_id","feature_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_entitlements_status_idx" ON "org_entitlements" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_entitlements_expires_idx" ON "org_entitlements" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sub_events_log_org_idx" ON "subscription_events_log" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sub_events_log_sub_idx" ON "subscription_events_log" USING btree ("subscription_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sub_events_log_event_idx" ON "subscription_events_log" USING btree ("event_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sub_events_log_created_idx" ON "subscription_events_log" USING btree ("created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "billing_accounts_org_idx" ON "billing_accounts" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_accounts_status_idx" ON "billing_accounts" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "billing_periods_org_label_idx" ON "billing_periods" USING btree ("organization_id","label");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_allocations_payment_idx" ON "payment_allocations" USING btree ("payment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_allocations_invoice_idx" ON "payment_allocations" USING btree ("invoice_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_line_items_invoice_idx" ON "platform_invoice_line_items" USING btree ("invoice_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pcle_org_idx" ON "platform_cost_ledger_entries" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pcle_period_idx" ON "platform_cost_ledger_entries" USING btree ("billing_period_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pcle_cost_type_idx" ON "platform_cost_ledger_entries" USING btree ("cost_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pcle_event_type_idx" ON "platform_cost_ledger_entries" USING btree ("event_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pcle_source_idx" ON "platform_cost_ledger_entries" USING btree ("source_type","source_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pcle_allocation_idx" ON "platform_cost_ledger_entries" USING btree ("allocation_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pcle_created_idx" ON "platform_cost_ledger_entries" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pcle_local_idx" ON "platform_cost_ledger_entries" USING btree ("local_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "abs_run_idx" ON "allocation_basis_snapshots" USING btree ("run_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "abs_local_idx" ON "allocation_basis_snapshots" USING btree ("local_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "arv_rule_idx" ON "allocation_rule_versions" USING btree ("rule_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "arv_effective_idx" ON "allocation_rule_versions" USING btree ("effective_from","effective_to");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "allocation_rules_org_idx" ON "allocation_rules" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "arl_run_idx" ON "allocation_run_lines" USING btree ("run_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "arl_local_idx" ON "allocation_run_lines" USING btree ("local_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "allocation_runs_org_idx" ON "allocation_runs" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "allocation_runs_period_idx" ON "allocation_runs" USING btree ("billing_period_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "allocation_runs_status_idx" ON "allocation_runs" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chargeback_org_idx" ON "chargeback_statements" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chargeback_local_idx" ON "chargeback_statements" USING btree ("local_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chargeback_period_idx" ON "chargeback_statements" USING btree ("billing_period_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_adjustments_event_idx" ON "fee_adjustments" USING btree ("fee_event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_adjustments_org_idx" ON "fee_adjustments" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_adjustments_type_idx" ON "fee_adjustments" USING btree ("adjustment_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "txn_fee_events_org_idx" ON "transaction_fee_events" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "txn_fee_events_rule_idx" ON "transaction_fee_events" USING btree ("rule_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "txn_fee_events_idempotency_idx" ON "transaction_fee_events" USING btree ("idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "txn_fee_events_source_idx" ON "transaction_fee_events" USING btree ("source_transaction_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "txn_fee_events_status_idx" ON "transaction_fee_events" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "txn_fee_events_captured_idx" ON "transaction_fee_events" USING btree ("captured_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "txn_fee_rules_org_idx" ON "transaction_fee_rules" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "txn_fee_rules_contract_idx" ON "transaction_fee_rules" USING btree ("contract_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "txn_fee_rules_flow_idx" ON "transaction_fee_rules" USING btree ("flow_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "txn_fee_rules_status_idx" ON "transaction_fee_rules" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contract_covered_orgs_contract_idx" ON "contract_covered_orgs" USING btree ("contract_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contract_covered_orgs_org_idx" ON "contract_covered_orgs" USING btree ("organization_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "contract_covered_orgs_contract_org_idx" ON "contract_covered_orgs" USING btree ("contract_id","organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reconciliation_exceptions_run_idx" ON "reconciliation_exceptions" USING btree ("run_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reconciliation_exceptions_org_idx" ON "reconciliation_exceptions" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reconciliation_exceptions_status_idx" ON "reconciliation_exceptions" USING btree ("exception_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reconciliation_exceptions_type_idx" ON "reconciliation_exceptions" USING btree ("exception_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reconciliation_matches_run_idx" ON "reconciliation_matches" USING btree ("run_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reconciliation_matches_source_idx" ON "reconciliation_matches" USING btree ("source_type","source_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reconciliation_matches_target_idx" ON "reconciliation_matches" USING btree ("target_type","target_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reconciliation_runs_org_idx" ON "reconciliation_runs" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reconciliation_runs_status_idx" ON "reconciliation_runs" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reconciliation_runs_period_idx" ON "reconciliation_runs" USING btree ("period_start","period_end");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_case_documents_unique" ON "case_documents" USING btree ("claim_id","document_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_case_documents_claim" ON "case_documents" USING btree ("claim_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_case_documents_document" ON "case_documents" USING btree ("document_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_case_documents_org" ON "case_documents" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_document_access_grants_document" ON "document_access_grants" USING btree ("document_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_document_access_grants_user" ON "document_access_grants" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_document_access_grants_org" ON "document_access_grants" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_document_access_grants_status" ON "document_access_grants" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_document_links_unique" ON "document_links" USING btree ("document_id","linked_entity_type","linked_entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_document_links_document" ON "document_links" USING btree ("document_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_document_links_entity" ON "document_links" USING btree ("linked_entity_type","linked_entity_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_document_versions_unique" ON "document_versions" USING btree ("document_id","version_no");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_document_versions_document" ON "document_versions" USING btree ("document_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_document_versions_org" ON "document_versions" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_correspondence_org" ON "correspondence" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_correspondence_status" ON "correspondence" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_correspondence_drafter" ON "correspondence" USING btree ("drafted_by");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_correspondence_signer" ON "correspondence" USING btree ("assigned_signer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_correspondence_ref" ON "correspondence" USING btree ("reference_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_correspondence_grievance" ON "correspondence" USING btree ("grievance_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_corr_audit_corr" ON "correspondence_audit_trail" USING btree ("correspondence_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_corr_audit_actor" ON "correspondence_audit_trail" USING btree ("actor_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_corr_audit_event" ON "correspondence_audit_trail" USING btree ("event_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_corr_audit_time" ON "correspondence_audit_trail" USING btree ("timestamp");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_corr_recipients_corr" ON "correspondence_recipients" USING btree ("correspondence_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_signatures_user" ON "user_signatures" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_signatures_org" ON "user_signatures" USING btree ("organization_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_pilot_checklist_org_item" ON "pilot_checklist_items" USING btree ("organization_id","item_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pilot_checklist_org" ON "pilot_checklist_items" USING btree ("organization_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_pilot_demo_seeds_org" ON "pilot_demo_seeds" USING btree ("organization_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_pilot_enrollments_org" ON "pilot_enrollments" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pilot_milestones_org" ON "pilot_milestones" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pilot_events_org" ON "pilot_events" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pilot_events_user" ON "pilot_events" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pilot_events_type" ON "pilot_events" USING btree ("event_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pilot_events_session" ON "pilot_events" USING btree ("session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pilot_events_created" ON "pilot_events" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pilot_feedback_org" ON "pilot_feedback" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pilot_feedback_user" ON "pilot_feedback" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pilot_feedback_created" ON "pilot_feedback" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deadline_audit_events_deadline_idx" ON "deadline_audit_events" USING btree ("source_deadline_id","occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deadline_audit_events_reminder_idx" ON "deadline_audit_events" USING btree ("reminder_id","occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deadline_audit_events_org_time_idx" ON "deadline_audit_events" USING btree ("organization_id","occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deadline_audit_events_type_time_idx" ON "deadline_audit_events" USING btree ("event_type","occurred_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "deadline_reminder_executions_attempt_uidx" ON "deadline_reminder_executions" USING btree ("reminder_id","attempt_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deadline_reminder_executions_reminder_idx" ON "deadline_reminder_executions" USING btree ("reminder_id","attempted_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "deadline_reminders_pending_uidx" ON "deadline_reminders" USING btree ("source_deadline_id","recipient_email_hash","offset_days","reminder_kind");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "deadline_reminders_provider_msg_uidx" ON "deadline_reminders" USING btree ("provider","provider_message_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deadline_reminders_pending_scan_idx" ON "deadline_reminders" USING btree ("scheduled_for","id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deadline_reminders_lease_recovery_idx" ON "deadline_reminders" USING btree ("lease_expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deadline_reminders_source_lookup_idx" ON "deadline_reminders" USING btree ("source_deadline_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deadline_reminders_org_status_idx" ON "deadline_reminders" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_org_configurations_org_cat_key" ON "org_configurations" USING btree ("organization_id","category","key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_org_configurations_org" ON "org_configurations" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bargaining_units_organization" ON "bargaining_units" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bargaining_units_employer" ON "bargaining_units" USING btree ("employer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bargaining_units_worksite" ON "bargaining_units" USING btree ("worksite_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bargaining_units_status" ON "bargaining_units" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bargaining_units_unit_number" ON "bargaining_units" USING btree ("unit_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bargaining_units_contract_expiry" ON "bargaining_units" USING btree ("contract_expiry_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committees_organization" ON "committees" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committees_type" ON "committees" USING btree ("committee_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committees_status" ON "committees" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committees_unit" ON "committees" USING btree ("unit_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committees_worksite" ON "committees" USING btree ("worksite_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committees_chair" ON "committees" USING btree ("chair_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_worksites_organization" ON "worksites" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_worksites_employer" ON "worksites" USING btree ("employer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_worksites_status" ON "worksites" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_worksites_code" ON "worksites" USING btree ("code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committee_action_items_committee" ON "committee_action_items" USING btree ("committee_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committee_action_items_meeting" ON "committee_action_items" USING btree ("meeting_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committee_action_items_status" ON "committee_action_items" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committee_action_items_assigned" ON "committee_action_items" USING btree ("assigned_to");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committee_action_items_due" ON "committee_action_items" USING btree ("due_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committee_action_items_org" ON "committee_action_items" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committee_documents_committee" ON "committee_documents" USING btree ("committee_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committee_documents_meeting" ON "committee_documents" USING btree ("meeting_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committee_documents_category" ON "committee_documents" USING btree ("category");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committee_documents_org" ON "committee_documents" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committee_intel_org" ON "committee_intelligence_snapshots" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committee_intel_committee" ON "committee_intelligence_snapshots" USING btree ("committee_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committee_intel_period" ON "committee_intelligence_snapshots" USING btree ("period_start","period_end");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_meeting_attendees_meeting" ON "committee_meeting_attendees" USING btree ("meeting_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_meeting_attendees_member" ON "committee_meeting_attendees" USING btree ("member_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committee_meetings_committee" ON "committee_meetings" USING btree ("committee_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committee_meetings_organization" ON "committee_meetings" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committee_meetings_date" ON "committee_meetings" USING btree ("meeting_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committee_meetings_status" ON "committee_meetings" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_quality_warnings_org" ON "data_quality_warnings" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_quality_warnings_record" ON "data_quality_warnings" USING btree ("record_type","record_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_quality_warnings_batch" ON "data_quality_warnings" USING btree ("batch_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_quality_warnings_resolved" ON "data_quality_warnings" USING btree ("resolved");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_dup_members_group" ON "duplicate_group_members" USING btree ("group_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_dup_members_record" ON "duplicate_group_members" USING btree ("record_type","record_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_dup_members_unique" ON "duplicate_group_members" USING btree ("group_id","record_type","record_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_duplicate_groups_org" ON "duplicate_groups" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_duplicate_groups_status" ON "duplicate_groups" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_duplicate_groups_type" ON "duplicate_groups" USING btree ("group_type");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_timeline_events_dedup" ON "grievance_timeline_events" USING btree ("grievance_id","event_date","event_type","content_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_timeline_events_grievance" ON "grievance_timeline_events" USING btree ("grievance_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_timeline_events_org" ON "grievance_timeline_events" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_timeline_events_date" ON "grievance_timeline_events" USING btree ("event_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ingestion_batches_org" ON "ingestion_batches" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ingestion_batches_status" ON "ingestion_batches" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ingestion_records_batch" ON "ingestion_records" USING btree ("batch_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ingestion_records_status" ON "ingestion_records" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ingestion_records_ext_id" ON "ingestion_records" USING btree ("external_id");
