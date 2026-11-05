-- PLATFORM_SQL 0015_payments_transaction_source
--
-- The Django-created public.payments relation is a four-column stub (id, created_at, updated_at, organization_id).
-- Money movement cannot be authorized against a row that carries no amount, currency or payer, so the kernel's
-- finance policy treats such a relation as UNAVAILABLE (lib/authority/store/resources.ts financeSourceReadiness).
--
-- This migration adds the three columns the policy reads, additively and NULLABLE. No value is invented for an
-- existing row: a payment whose amount, currency or payer is null cannot be registered as a finance transaction,
-- because registration snapshots a valid amount and the loader refuses a null one. A negative amount is refused,
-- since refunds and reversals are separate steps in the finance ledger, not signed payments.
--
-- Registration, preparation, approval, execution and reconciliation stay in ue_authority_financial_steps (0013).
-- No route consumes them yet and the institution has not decided which offices hold which financial duties.

DO $$
BEGIN
  IF to_regclass('public.payments') IS NULL THEN
    RAISE EXCEPTION 'platform 0015 fail-closed: public.payments does not exist.';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS member_id varchar(255),
  ADD COLUMN IF NOT EXISTS amount numeric(19, 2),
  ADD COLUMN IF NOT EXISTS currency varchar(3);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.payments'::regclass AND conname = 'payments_amount_non_negative'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_amount_non_negative CHECK (amount IS NULL OR amount >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.payments'::regclass AND conname = 'payments_currency_iso_shape'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_currency_iso_shape CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$');
  END IF;
END $$;
