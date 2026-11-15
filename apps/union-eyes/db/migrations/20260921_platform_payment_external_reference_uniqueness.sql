-- ─────────────────────────────────────────────────────────────────────────────
-- Platform payment external-reference idempotency identity
--
-- platform_payments.external_reference carries the provider idempotency token
-- (Stripe event id for webhook-driven payments; a human-entered bank/wire/
-- cheque reference for manual reconciliation via /api/finance/invoices/[id]/
-- payments -> recordPayment). Manual references are entered per organization
-- and are NOT globally unique — two organizations may legitimately record the
-- same human reference. The canonical idempotency key is therefore
-- per-organization:
--
--   PLATFORM_PAYMENT_CANONICAL_IDEMPOTENCY_KEY =
--     (organization_id, external_reference) WHERE external_reference IS NOT NULL
--
-- NULL external_reference (manual payments without a reference) is intentionally
-- NOT constrained — multiple NULLs per org are allowed.
--
-- Before this migration, replay handling was select-first (SELECT ... by
-- external_reference, then INSERT), which is race-vulnerable: two concurrent
-- duplicate Stripe events could both pass the SELECT and double-insert a
-- payment. This unique index makes at-most-one durable payment identity per
-- (organization, reference) a database invariant; the webhook now reserves via
-- INSERT ... ON CONFLICT DO NOTHING RETURNING.
--
-- SAFETY: this migration FAILS (and changes nothing) if pre-existing duplicate
-- (organization_id, external_reference) groups exist. No financial rows are
-- merged or deleted — duplicates must be resolved by an operator first.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  dup_groups integer;
BEGIN
  -- A missing payment table means the required ledger migration has not run.
  -- Refuse success rather than recording an unapplied idempotency guarantee.
  IF to_regclass('platform_payments') IS NULL THEN
    RAISE EXCEPTION
      'platform_payments is missing; apply the platform ledger migration before payment-reference uniqueness';
  END IF;

  SELECT count(*) INTO dup_groups
  FROM (
    SELECT organization_id, external_reference
    FROM platform_payments
    WHERE external_reference IS NOT NULL
    GROUP BY organization_id, external_reference
    HAVING count(*) > 1
  ) d;

  IF dup_groups > 0 THEN
    RAISE EXCEPTION
      'platform_payments has % duplicate (organization_id, external_reference) group(s); resolve them before applying the uniqueness constraint. No rows were merged or deleted.',
      dup_groups;
  END IF;

  EXECUTE
    'CREATE UNIQUE INDEX IF NOT EXISTS platform_payments_org_external_reference_uq '
    || 'ON platform_payments (organization_id, external_reference) '
    || 'WHERE external_reference IS NOT NULL';

  -- IF NOT EXISTS alone is unsafe: an unrelated index with this name can
  -- suppress creation and falsely signal that payment replay is protected.
  -- Verify the actual catalog invariant, including validity and predicate.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class idx
    JOIN pg_index ix ON ix.indexrelid = idx.oid
    JOIN pg_class tbl ON tbl.oid = ix.indrelid
    JOIN pg_am am ON am.oid = idx.relam
    JOIN pg_attribute a1 ON a1.attrelid = tbl.oid AND a1.attnum = ix.indkey[0]
    JOIN pg_attribute a2 ON a2.attrelid = tbl.oid AND a2.attnum = ix.indkey[1]
    WHERE idx.oid = to_regclass('platform_payments_org_external_reference_uq')
      AND tbl.oid = to_regclass('platform_payments')
      AND am.amname = 'btree'
      AND ix.indisunique AND ix.indisvalid AND ix.indisready
      AND ix.indnkeyatts = 2 AND ix.indnatts = 2
      AND ix.indexprs IS NULL
      AND a1.attname = 'organization_id'
      AND a2.attname = 'external_reference'
      AND regexp_replace(pg_get_expr(ix.indpred, ix.indrelid), '[()"[:space:]]', '', 'g')
          = 'external_referenceISNOTNULL'
  ) THEN
    RAISE EXCEPTION
      'platform payment reference uniqueness index is missing or has an unexpected definition; refuse financial idempotency qualification';
  END IF;
END $$;
