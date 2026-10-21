-- PLATFORM_SQL — additive evolution of the historical DAPL enums.
--
-- Frozen 20260325_dapl_platform_ledger.sql and migrations-audit/finance-enums.sql
-- predate transaction_fee, settlement, fee_captured, settlement_closed, and
-- settlement_batch. Platform 0009 requires the canonical label order and is
-- not edited. This statement runs first. It adds only missing labels, keeps
-- existing labels and their relative order, and does not rewrite rows.
-- A label that is not in the canonical list, or an existing order that cannot
-- be preserved by insertion, raises and leaves the type unchanged.
-- Types that do not exist yet are left for 0009 to create.

DO $ue$
DECLARE
  spec record;
  canonical text[];
  existing text[];
  anchors text[];
  label text;
  anchor text;
  i int;
  j int;
BEGIN
  FOR spec IN
    SELECT *
    FROM (VALUES
      (
        'platform_cost_type',
        ARRAY['base_subscription', 'local_fee', 'seat_fee', 'module_fee', 'usage_fee', 'onboarding_fee', 'support_fee', 'transaction_fee', 'settlement', 'adjustment', 'credit', 'subsidy', 'writeoff']::text[]
      ),
      (
        'ledger_event_type',
        ARRAY['invoice_generated', 'payment_received', 'allocation_run', 'adjustment_posted', 'credit_applied', 'subsidy_applied', 'writeoff_posted', 'period_closed', 'reversal', 'fee_captured', 'settlement_closed']::text[]
      ),
      (
        'ledger_source_type',
        ARRAY['subscription', 'invoice', 'payment', 'adjustment', 'allocation', 'manual', 'system', 'transaction_fee', 'settlement_batch']::text[]
      )
    ) AS planned(type_name, labels)
  LOOP
    canonical := spec.labels;
    IF to_regtype(format('public.%I', spec.type_name)) IS NULL THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
      INTO existing
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = spec.type_name;

    j := 1;
    FOREACH label IN ARRAY existing LOOP
      WHILE j <= cardinality(canonical) AND canonical[j] IS DISTINCT FROM label LOOP
        j := j + 1;
      END LOOP;
      IF j > cardinality(canonical) THEN
        RAISE EXCEPTION 'incompatible existing type public.%', spec.type_name;
      END IF;
      j := j + 1;
    END LOOP;

    anchors := existing;
    FOR i IN 1..cardinality(canonical) LOOP
      IF canonical[i] = ANY (anchors) THEN
        CONTINUE;
      END IF;
      anchor := NULL;
      FOR j IN i + 1..cardinality(canonical) LOOP
        IF canonical[j] = ANY (anchors) THEN
          anchor := canonical[j];
          EXIT;
        END IF;
      END LOOP;
      IF anchor IS NULL THEN
        EXECUTE format('ALTER TYPE public.%I ADD VALUE %L', spec.type_name, canonical[i]);
      ELSE
        EXECUTE format('ALTER TYPE public.%I ADD VALUE %L BEFORE %L', spec.type_name, canonical[i], anchor);
      END IF;
    END LOOP;
  END LOOP;
END
$ue$;
