-- PLATFORM_SQL 0017_dues_transactions_ledger_shape
--
-- Django created public.dues_transactions as a bare stub (id, timestamps, organization_id, member_id, assignment_id,
-- rule_id and a nullable transaction_type) with no column defaults. The dues billing, payment, reminder and retry
-- services insert and select the full Drizzle shape: the amounts, the covered period, the due date, status, payment
-- and processor details and the receipt. None of those columns exist, so every one of those paths fails on the
-- deployed schema.
--
-- The declared shape is added here. Money columns cannot be backfilled honestly, so a populated stub is refused
-- rather than given invented amounts, periods or statuses; on an empty relation the required columns are enforced
-- NOT NULL exactly as declared. The ledger keeps one integrity rule beyond the declaration: a period cannot end
-- before it starts. Adjustments and refunds may be negative, so the amounts carry no sign check.

DO $$
BEGIN
  IF to_regclass('public.dues_transactions') IS NULL THEN
    RAISE EXCEPTION 'platform 0017 fail-closed: public.dues_transactions does not exist.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.dues_transactions)
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'dues_transactions' AND column_name = 'total_amount'
     ) THEN
    RAISE EXCEPTION 'platform 0017 fail-closed: public.dues_transactions is a populated stub; amounts, periods and statuses cannot be backfilled.';
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'payment_processor' AND n.nspname = 'public') THEN
    CREATE TYPE public.payment_processor AS ENUM ('stripe', 'whop', 'paypal', 'square', 'manual');
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE public.dues_transactions ALTER COLUMN id SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE public.dues_transactions ALTER COLUMN created_at SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE public.dues_transactions ALTER COLUMN updated_at SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE public.dues_transactions
  ADD COLUMN IF NOT EXISTS amount numeric(10, 2),
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS period_end date,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS status varchar(50) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_date timestamptz,
  ADD COLUMN IF NOT EXISTS payment_method varchar(50),
  ADD COLUMN IF NOT EXISTS payment_reference varchar(255),
  ADD COLUMN IF NOT EXISTS processor_type public.payment_processor,
  ADD COLUMN IF NOT EXISTS processor_payment_id varchar(255),
  ADD COLUMN IF NOT EXISTS processor_customer_id varchar(255),
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dues_amount numeric(10, 2),
  ADD COLUMN IF NOT EXISTS cope_amount numeric(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS pac_amount numeric(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS strike_fund_amount numeric(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS late_fee_amount numeric(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS adjustment_amount numeric(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total_amount numeric(10, 2),
  ADD COLUMN IF NOT EXISTS paid_date timestamptz,
  ADD COLUMN IF NOT EXISTS receipt_url text;
--> statement-breakpoint
-- The declared required columns are enforced only where no existing row could violate them (the guard above refuses
-- a populated stub that lacks the money columns).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.dues_transactions) THEN
    ALTER TABLE public.dues_transactions
      ALTER COLUMN transaction_type TYPE varchar(50),
      ALTER COLUMN transaction_type SET NOT NULL,
      ALTER COLUMN amount SET NOT NULL,
      ALTER COLUMN period_start SET NOT NULL,
      ALTER COLUMN period_end SET NOT NULL,
      ALTER COLUMN due_date SET NOT NULL,
      ALTER COLUMN dues_amount SET NOT NULL,
      ALTER COLUMN total_amount SET NOT NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.dues_transactions'::regclass AND conname = 'dues_transactions_period_ordered'
  ) THEN
    ALTER TABLE public.dues_transactions
      ADD CONSTRAINT dues_transactions_period_ordered CHECK (period_start IS NULL OR period_end IS NULL OR period_end >= period_start);
  END IF;
END $$;
