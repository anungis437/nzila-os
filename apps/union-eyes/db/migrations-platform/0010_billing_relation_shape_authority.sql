-- PLATFORM_SQL — canonical shape for the three QA-owned billing relations.
--
-- Drizzle declarations in db/schema/domains/finance/platform-billing.ts own
-- the enum and billing_account_id nullability. The QA baseline remains the
-- fresh CREATE producer. This statement converts an empty legacy shape and
-- refuses to rewrite a populated incompatible relation.
-- billing_accounts is created by 0009_canonical_lineage_relations.

DO $ue$
BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('active', 'trialing', 'past_due', 'cancelled', 'paused');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'subscription_status'
  ) IS DISTINCT FROM ARRAY['active', 'trialing', 'past_due', 'cancelled', 'paused']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.subscription_status';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE public.platform_invoice_status AS ENUM (
    'draft', 'issued', 'paid', 'partially_paid', 'overdue', 'void', 'written_off'
  );
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'platform_invoice_status'
  ) IS DISTINCT FROM ARRAY['draft', 'issued', 'paid', 'partially_paid', 'overdue', 'void', 'written_off']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.platform_invoice_status';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
BEGIN
  CREATE TYPE public.platform_payment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN
  IF (
    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'platform_payment_status'
  ) IS DISTINCT FROM ARRAY['pending', 'processing', 'completed', 'failed', 'refunded']::text[] THEN
    RAISE EXCEPTION 'incompatible existing type public.platform_payment_status';
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  status_type text;
  billing_nullable text;
  row_count bigint;
  orphan_count bigint;
BEGIN
  IF to_regclass('public.billing_accounts') IS NULL THEN
    RAISE EXCEPTION 'billing shape authority: public.billing_accounts is absent.';
  END IF;
  IF to_regclass('public.org_subscriptions') IS NULL THEN
    RAISE EXCEPTION 'billing shape authority: public.org_subscriptions is absent.';
  END IF;

  SELECT c.udt_name INTO status_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'org_subscriptions' AND c.column_name = 'status';
  SELECT c.is_nullable INTO billing_nullable
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'org_subscriptions' AND c.column_name = 'billing_account_id';

  IF status_type IS DISTINCT FROM 'subscription_status' OR billing_nullable IS DISTINCT FROM 'NO' THEN
    SELECT count(*) INTO row_count FROM public.org_subscriptions;
    IF row_count > 0 THEN
      RAISE EXCEPTION
        'incompatible existing relation public.org_subscriptions: % populated row(s) do not match the canonical enum and billing_account_id contract. Rows were not rewritten.',
        row_count;
    END IF;
    ALTER TABLE public.org_subscriptions ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE public.org_subscriptions
      ALTER COLUMN status TYPE public.subscription_status USING status::public.subscription_status;
    ALTER TABLE public.org_subscriptions ALTER COLUMN status SET DEFAULT 'active';
    ALTER TABLE public.org_subscriptions ALTER COLUMN billing_account_id SET NOT NULL;
  END IF;

  SELECT count(*) INTO orphan_count
  FROM public.org_subscriptions s
  LEFT JOIN public.billing_accounts b ON b.id = s.billing_account_id
  WHERE b.id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'incompatible existing relation public.org_subscriptions: % row(s) have no billing_accounts parent. Rows were not rewritten.',
      orphan_count;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'org_subscriptions_billing_account_id_fkey'
      AND conrelid = 'public.org_subscriptions'::regclass
  ) THEN
    ALTER TABLE public.org_subscriptions
      ADD CONSTRAINT org_subscriptions_billing_account_id_fkey
      FOREIGN KEY (billing_account_id) REFERENCES public.billing_accounts(id) ON DELETE RESTRICT;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  status_type text;
  billing_nullable text;
  row_count bigint;
  orphan_count bigint;
BEGIN
  IF to_regclass('public.platform_invoices') IS NULL THEN
    RAISE EXCEPTION 'billing shape authority: public.platform_invoices is absent.';
  END IF;
  SELECT c.udt_name INTO status_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'platform_invoices' AND c.column_name = 'status';
  SELECT c.is_nullable INTO billing_nullable
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'platform_invoices' AND c.column_name = 'billing_account_id';

  IF status_type IS DISTINCT FROM 'platform_invoice_status' OR billing_nullable IS DISTINCT FROM 'NO' THEN
    SELECT count(*) INTO row_count FROM public.platform_invoices;
    IF row_count > 0 THEN
      RAISE EXCEPTION
        'incompatible existing relation public.platform_invoices: % populated row(s) do not match the canonical enum and billing_account_id contract. Rows were not rewritten.',
        row_count;
    END IF;
    ALTER TABLE public.platform_invoices ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE public.platform_invoices
      ALTER COLUMN status TYPE public.platform_invoice_status USING status::public.platform_invoice_status;
    ALTER TABLE public.platform_invoices ALTER COLUMN status SET DEFAULT 'draft';
    ALTER TABLE public.platform_invoices ALTER COLUMN billing_account_id SET NOT NULL;
  END IF;

  SELECT count(*) INTO orphan_count
  FROM public.platform_invoices s
  LEFT JOIN public.billing_accounts b ON b.id = s.billing_account_id
  WHERE b.id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'incompatible existing relation public.platform_invoices: % row(s) have no billing_accounts parent. Rows were not rewritten.',
      orphan_count;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'platform_invoices_billing_account_id_fkey'
      AND conrelid = 'public.platform_invoices'::regclass
  ) THEN
    ALTER TABLE public.platform_invoices
      ADD CONSTRAINT platform_invoices_billing_account_id_fkey
      FOREIGN KEY (billing_account_id) REFERENCES public.billing_accounts(id) ON DELETE RESTRICT;
  END IF;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  status_type text;
  billing_nullable text;
  row_count bigint;
  orphan_count bigint;
BEGIN
  IF to_regclass('public.platform_payments') IS NULL THEN
    RAISE EXCEPTION 'billing shape authority: public.platform_payments is absent.';
  END IF;
  SELECT c.udt_name INTO status_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'platform_payments' AND c.column_name = 'status';
  SELECT c.is_nullable INTO billing_nullable
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'platform_payments' AND c.column_name = 'billing_account_id';

  IF status_type IS DISTINCT FROM 'platform_payment_status' OR billing_nullable IS DISTINCT FROM 'NO' THEN
    SELECT count(*) INTO row_count FROM public.platform_payments;
    IF row_count > 0 THEN
      RAISE EXCEPTION
        'incompatible existing relation public.platform_payments: % populated row(s) do not match the canonical enum and billing_account_id contract. Rows were not rewritten.',
        row_count;
    END IF;
    ALTER TABLE public.platform_payments ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE public.platform_payments
      ALTER COLUMN status TYPE public.platform_payment_status USING status::public.platform_payment_status;
    ALTER TABLE public.platform_payments ALTER COLUMN status SET DEFAULT 'pending';
    ALTER TABLE public.platform_payments ALTER COLUMN billing_account_id SET NOT NULL;
  END IF;

  SELECT count(*) INTO orphan_count
  FROM public.platform_payments s
  LEFT JOIN public.billing_accounts b ON b.id = s.billing_account_id
  WHERE b.id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'incompatible existing relation public.platform_payments: % row(s) have no billing_accounts parent. Rows were not rewritten.',
      orphan_count;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'platform_payments_billing_account_id_fkey'
      AND conrelid = 'public.platform_payments'::regclass
  ) THEN
    ALTER TABLE public.platform_payments
      ADD CONSTRAINT platform_payments_billing_account_id_fkey
      FOREIGN KEY (billing_account_id) REFERENCES public.billing_accounts(id) ON DELETE RESTRICT;
  END IF;
END
$ue$;
