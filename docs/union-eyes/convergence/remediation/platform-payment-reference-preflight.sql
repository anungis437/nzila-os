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
