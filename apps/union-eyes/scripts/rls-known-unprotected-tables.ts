/**
 * Known/accepted gaps for the orphaned-tenant-table check in rls-verify.ts.
 *
 * This file is INTENTIONALLY EMPTY (unpopulated) as shipped. It is not a
 * claim that no such gaps exist — this repository has 200+ tables and only
 * the tables in db/migrations/0108_rls_tenant_isolation_foundation.sql have
 * been audited and given RLS coverage in this remediation pass.
 *
 * To populate: run `pnpm --filter @nzila/union-eyes run rls:verify` against
 * a real database with the full schema (staging, not a minimal local proof
 * schema) and review the "orphaned-tenant-table scan" results. For each
 * table reported, either:
 *   (a) add real RLS coverage for it (preferred), or
 *   (b) add it here with a one-line justification comment explaining why it
 *       is safe to leave unprotected (e.g. genuinely global reference data,
 *       or already covered by an equivalent non-RLS control).
 *
 * Once this file has real entries, the check in rls-verify.ts starts
 * enforcing against it — any table NOT in this list and NOT RLS-protected
 * will fail the preflight. Until then, the check is report-only.
 */
const knownUnprotectedTables: string[] = []

export default knownUnprotectedTables
