-- Union Eyes Gate 0: read-only platform payment reference preflight.
-- Run against each target PostgreSQL 15/16 database with an authorized read-only role.
-- This is diagnostic evidence only: it does not repair data, install an index,
-- prove concurrent-write safety, or authorize financial collection.
-- Preserve output with database version, schema revision, role and timestamp.
BEGIN READ ONLY;
SELECT current_setting('server_version') AS pg_version,
       current_database() AS database_name,
       current_user AS inspection_role,
       now() AS inspected_at;
-- Duplicates within the proposed organization-scoped uniqueness key.
SELECT organization_id, external_reference, COUNT(*) AS duplicate_count,
       array_agg(id ORDER BY created_at, id) AS payment_ids
FROM platform_payments
WHERE external_reference IS NOT NULL
GROUP BY organization_id, external_reference
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, organization_id, external_reference;
-- Blank references are distinct from NULL and should not be accepted
-- as valid idempotency keys without an explicit contract.
SELECT organization_id, COUNT(*) AS blank_reference_count
FROM platform_payments
WHERE external_reference IS NOT NULL
  AND btrim(external_reference) = ''
GROUP BY organization_id ORDER BY organization_id;
-- Same reference across organizations may be valid; review provider namespace
-- before choosing a global rather than organization-scoped constraint.
SELECT external_reference, COUNT(DISTINCT organization_id) AS organization_count,
       COUNT(*) AS payment_count
FROM platform_payments
WHERE external_reference IS NOT NULL
GROUP BY external_reference
HAVING COUNT(DISTINCT organization_id) > 1
ORDER BY payment_count DESC, external_reference;
-- Normalized collisions: leading/trailing whitespace or case differences can
-- defeat an application-level equality check. Review provider-specific case
-- sensitivity before choosing a canonical reference representation.
SELECT organization_id, lower(btrim(external_reference)) AS normalized_reference,
       COUNT(*) AS collision_count,
       array_agg(id ORDER BY created_at, id) AS payment_ids
FROM platform_payments
WHERE external_reference IS NOT NULL AND btrim(external_reference) <> ''
GROUP BY organization_id, lower(btrim(external_reference))
HAVING COUNT(*) > 1
ORDER BY collision_count DESC, organization_id, normalized_reference;
-- Financial ownership consistency: a payment must not link an account or
-- invoice belonging to a different organization. Such rows must be triaged
-- before any constraint or idempotency migration.
SELECT p.id AS payment_id, p.organization_id AS payment_organization,
       a.organization_id AS account_organization,
       i.organization_id AS invoice_organization
FROM platform_payments p
LEFT JOIN billing_accounts a ON a.id = p.billing_account_id
LEFT JOIN payment_allocations pa ON pa.payment_id = p.id
LEFT JOIN platform_invoices i ON i.id = pa.invoice_id
WHERE (a.id IS NOT NULL AND a.organization_id <> p.organization_id)
   OR (i.id IS NOT NULL AND i.organization_id <> p.organization_id)
ORDER BY p.id;
-- Allocation ownership and arithmetic: a payment allocation must belong to the
-- same billing account as its invoice, and aggregate allocations must not
-- exceed the payment amount. These are diagnostic rows, not corrections.
SELECT pa.id AS allocation_id, pa.payment_id, pa.invoice_id,
       p.billing_account_id AS payment_account_id,
       i.billing_account_id AS invoice_account_id
FROM payment_allocations pa
JOIN platform_payments p ON p.id = pa.payment_id
JOIN platform_invoices i ON i.id = pa.invoice_id
WHERE p.billing_account_id <> i.billing_account_id
ORDER BY pa.id;
SELECT p.id AS payment_id, p.organization_id, p.amount AS payment_amount,
       COALESCE(SUM(pa.amount), 0) AS allocated_amount
FROM platform_payments p
LEFT JOIN payment_allocations pa ON pa.payment_id = p.id
GROUP BY p.id, p.organization_id, p.amount
HAVING COALESCE(SUM(pa.amount), 0) > p.amount
ORDER BY p.organization_id, p.id;
-- Negative allocation amounts require explicit refund/reversal semantics.
SELECT pa.id AS allocation_id, pa.payment_id, pa.invoice_id, pa.amount
FROM payment_allocations pa
WHERE pa.amount < 0
ORDER BY pa.id;
-- Inspect existing uniqueness and partial-index predicates.
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = current_schema()
  AND tablename = 'platform_payments'
ORDER BY indexname;
-- Review reference distribution by writer/method and status.
SELECT method, status, COUNT(*) AS payment_count,
       COUNT(*) FILTER (WHERE external_reference IS NULL) AS null_reference_count
FROM platform_payments
GROUP BY method, status
ORDER BY method, status;
ROLLBACK;
