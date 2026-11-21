/**
 * Step 1 S1-A01: the primary case-handler domain guards on real PostgreSQL.
 * Runs the exact case-primary-domain-guards suite in its native mode (an owned disposable PostgreSQL 16 container with forced
 * RLS and canonical roles), so the native CI job proves the same assertions the PGlite run proves. No assertion is copied or relaxed.
 */
process.env.UE_CASE_DOMAIN_NATIVE = '1'
await import('../auth/case-primary-domain-guards.pglite.test')
