# Union Eyes Gate 0 — clause-sharing owner-read tenant transaction

**Classification:** supplemental source correction; **not independently qualified or CLOSED**.
**Frozen register:** preserved (777 original defects, 111 capabilities). Relevant existing classification: `DEF-0B4-CLAUSE-LIBRARY-SYSTEM-ROLE-CROSS-TENANT-READS`. This evidence adds no new defect and no completion credit.

## Observed root cause

At baseline `f902f8b705fe0b230d45088bc4a6c306ee2ff945`, `GET /api/clause-library/[id]/share` called `withRLSContext({ organizationId }, async () => ...)` but executed its SELECT through the imported module-level `db` rather than the transaction handle. The owner check after the SELECT is not a substitute for executing the read under the caller's actual database tenant context. This created a transaction-boundary/RLS exposure risk.

The whole-app regression on that baseline also had one failed test: `app/api/__tests__/clause-library-audit.route.test.ts` expected a 403 sharing-scope denial without providing the now-required owner-clause read fixture. That failure was a test setup defect, not evidence that the underlying owner authorization should be skipped.

## Source correction and adversarial regression

- Source commit `9b55a6d1c3a810d1127189514c9ee7f412d683a2`: the GET handler now uses the `tx` supplied by `withRLSContext` for its SELECT; the unused module-level `db` import is removed. Existing owner-only 404 behavior and session-derived organization identity are retained.
- Test commit `43a614ce4238306537a32c20d8d134bef9dac9d6`: asserts GET uses the transaction, never the module database handle; a non-owner receives 404; missing organization context fails before any query. Corrects the POST denial fixture to provide an owned clause before checking standing. No test relaxes a production authorization boundary.
- Files: `apps/union-eyes/app/api/clause-library/[id]/share/route.ts`, `apps/union-eyes/app/api/__tests__/clause-library-audit.route.test.ts`.

## Verification boundaries

**Source:** exact-head readback of `43a614ce4238306537a32c20d8d134bef9dac9d6` confirmed the GET uses `tx` and the adversarial tests exist.

**Prior baseline CI (not transferable):** at `f902f8b705fe0b230d45088bc4a6c306ee2ff945`, native PostgreSQL acceptance, security regression, disposable HTTP/browser acceptance, App Floor Check, contract regression and governance attestation passed. Whole-application Vitest failed 1 of 23,808 tests (23,779 passed, 28 skipped), specifically the clause-sharing denial fixture.

**Exact-head executable/unit:** pending at evidence preparation; no focused test execution is claimed.

**Exact-head native PG15/16:** pending; this new GET correction has not yet been proven with adversarial tenant identities against both native databases.

**Exact-head HTTP/browser/staging:** pending; no staging or live-provider acceptance claimed.

**Institutional:** independent reviewer, owner-persona ratification and institutional authority decisions remain outstanding. This correction is not a release authorization.

## Remaining acceptance

Execute the full application and contract suites, native PG15/16 cross-tenant GET/POST cases, disposable production-build HTTP/browser and staging with distinct tenant principals. Confirm the database transaction context and RLS behavior with real credentials, then seek independent review. Do not mark the mapped defect CLOSED from source or mocked tests alone. Do not merge or promote production without separate release approval.
