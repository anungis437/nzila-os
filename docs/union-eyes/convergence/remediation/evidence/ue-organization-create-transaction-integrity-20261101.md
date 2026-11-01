# Union Eyes — organization creation transaction integrity (2026-11-01)

**Status:** SOURCE_CHANGED_TESTS_AUTHORED_NOT_QUALIFIED. This is a cross-cutting engineering correction, **not a newly closed defect** and not an independent qualification or institutional ratification.

## Observed source defect

In `apps/union-eyes/app/api/organizations/route.ts`, the POST handler called `withSystemContext(async (tx) => ...)` but used the module-level `db` handle for its parent hierarchy lookup and organization INSERT. The audit alone received `tx`. Therefore parent lookup, insert and audit were not proven to execute on the same transaction/connection, contrary to the source comment; a failed audit could leave an organization record created outside the audit transaction.

## Correction

The parent lookup and organization INSERT now use the same `tx` that is passed to `persistAtomicAudit`. The module-level `db` import is removed. The system-administrator guard remains before database work; tenant-scoped creation is not granted. The hierarchy depth rule and existing response contract remain unchanged.

Regression tests in `apps/union-eyes/app/api/__tests__/organizations.route.test.ts` pass a distinct transaction handle and require both SQL operations and audit to use it, and require an audit error to propagate rather than returning false HTTP 201. These are authored tests, **not executed qualification evidence**.

Source commits: `e5e06c71cdeb0b64b69f93b83c3d72d9f1888a3d` and `555ed187ea62ae9d9d1eab2cc2311bdb962b0c04`.

## Remaining acceptance

- Run focused and complete Vitest/contract at the exact commit and record actual results.
- Run native PostgreSQL 15/16 with a forced audit failure and prove rollback of both organization INSERT and audit.
- Run production-build HTTP/browser tests for authorized administrator creation, unauthorized caller refusal, and failed-audit no-success.
- Review hierarchy concurrency/locking and input validation separately; this correction does not claim to resolve those.
- Obtain independent reviewer, persona-owner and institutional authority decisions under Gate 0C.4.

The 777 original defects, frozen provenance, all prior statuses and zero independent closures remain unchanged. The native PG15/16 CI failure at baseline `6637174104651edd7109b42d478bd78b6a228871` concerns SECURITY DEFINER clause-sharing helpers in scoped migration 0048 and is **not** repaired by this change; no safety preflight was bypassed.
