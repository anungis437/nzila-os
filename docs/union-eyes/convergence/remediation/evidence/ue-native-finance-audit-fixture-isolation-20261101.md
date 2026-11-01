# Union Eyes — native finance duty audit-fixture isolation (2026-11-01)

## Authority and scope
Branch `agents/ue-cursor-final-closure`; baseline `275ac8e687b09025472b6d8db2521ab54f39f564`; source correction `febaad0a20e8966027182cd11d3babf3debf23ed`. This is additive test-engineering evidence, **not** a release approval or a new defect closure. The frozen 777-defect registers and 150-item priority index are untouched.

## Exact-baseline failure observed
At baseline, GitHub Actions `Union Eyes Native PostgreSQL Acceptance`, run `41353856746`, failed on **both PG15 and PG16**. Each version executed 11 native test files: 10 passed and `db/__tests__/finance-duties.postgres.test.ts` failed three tests (125 passed, 3 failed out of 128). The first failure was in the test that set `UE_CANONICAL_BOOTSTRAP_V2=1` inside a **legacy-lineage fixture** without the auth-owned `user_management.ue_authority_membership_rows(uuid,text[])` function or a live V2 session. The resulting missing-function error was not the expected injected audit fault. The test then left `finance.payment.registered` armed in the shared disposable database; the subsequent concurrency and revoked-membership tests failed from that leftover injected fault. The failure is real and is not counted as native acceptance.

## Correction
`apps/union-eyes/db/__tests__/finance-duties.postgres.test.ts` now clears the disposable audit fault table in asynchronous `afterEach` regardless of a preceding assertion failure. The legacy-lineage audit-rollback test no longer switches its environment flag and misrepresents a legacy database as canonical V2. A separate negative native test checks that the auth-owned V2 reader is absent in this fixture, enables the V2 flag only for that request, requires refusal identifying the missing reader, and verifies no financial step or public audit row was persisted. Its `finally` restores the environment flag.

This preserves the safety boundary: missing V2 identity authority is a failure, not a fake successful audit proof. No production role, RLS, audit, financial mandate, migration or safety preflight was relaxed.

## Qualification boundary
Source change and regression assertions are committed. Exact-commit PG15/16 execution, complete Vitest/contract, HTTP/browser and staging results must be checked independently. The new negative test **does not** establish Canonical V2 happy-path financial audit atomicity. That requires a separately provisioned native database with the auth-owned membership reader, a real live session and canonical hash-chain audit, plus independent release qualification.

The 777-defect provenance and 111 capabilities remain in scope. **Defect credit: 0; CLOSED credit: 0; overall GO: NO.**
