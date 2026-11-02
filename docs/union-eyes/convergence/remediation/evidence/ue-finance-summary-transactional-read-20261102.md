# Union Eyes — finance summary transactional read and mandatory audit
Date: 2026-11-02
Branch: `agents/ue-cursor-final-closure`
Parent HEAD: `883a77abeab92ec68abd4f0d19c3f84044303af3`
Status: SOURCE_CHANGED_TESTS_AUTHORED_NOT_QUALIFIED

## Root cause and change
The executive financial summary verified `finance:view` in one `withRLSContext` transaction, then issued seventeen financial queries inside a second, implicit organization context, through a module-level `db.execute` import. That created an avoidable authorization/read transaction gap and left consolidated sensitive financial access without an explicit same-transaction read audit. The first authorization did not bind the subsequent reads to the mandate transaction.

The route now uses one explicit `withRLSContext({ organizationId, userId }, async tx => ...)` for the live ledger-wide financial view mandate, all seventeen `tx.execute` queries and `persistAtomicAudit(tx, ...)` before returning any financial payload. The explicit tenant context and fail-closed audit make the read dependent on the transaction's successful completion. No new financial authority or synthetic data is issued.

## Regression tests authored
`apps/union-eyes/app/api/__tests__/finance-summary.route.test.ts` now asserts one explicit tenant transaction, mandate parameters, all seventeen queries on its transaction handle, the same-handle audit, refusal before any read on mandate failure, and refusal of the response on audit failure. The pre-existing summary shape test remains. These are mocked route tests, not independent runtime proof.

## Qualification and remaining
At the parent HEAD `883a77abeab92ec68abd4f0d19c3f84044303af3`, seven substantive GitHub Actions workflows passed: full regression, security, native PostgreSQL acceptance, disposable HTTP/browser, app floor and governance (six named workflows; Dependabot skipped). No new-HEAD result is inferred from that baseline. Run exact-HEAD focused/full Vitest and contract, real PG15 and PG16 with cross-tenant roles and revoked mandate, real HTTP/browser/staging, and inspect actual read-audit durability. Institutional authority and independent reviewer/persona ratifications remain outstanding. No frozen 777 classification, release debt index, historic qualification evidence, or CLOSED state changed. This is a related financial-tenant-read correction, not direct closure of the frozen CLC report defect.

## Additional financial truthfulness correction (same remediation batch)
The summary previously reported a 100% collection rate when `totalCharged <= 0`, implying successful collection without a denominator. It now returns `collectionRate: null` for insufficient data. The executive Financial Overview renders `N/A`, uses a neutral KPI state and states that no dues charges were recorded. The positive-denominator rate calculation is unchanged. Added a route regression test for the zero-denominator case and a source-level UI guard. Runtime UI rendering and API contract compatibility remain to be qualified at this new HEAD.
