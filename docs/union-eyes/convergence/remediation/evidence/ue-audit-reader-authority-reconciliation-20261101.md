# Union Eyes Gate 0 — scoped audit-reader privilege reconciliation (2026-11-01)

## Observed failure (not a qualification)
At exact HEAD `78ffd92044e4520c28c376a45c3458d0773a77ff`, native PostgreSQL 15/16 acceptance and disposable production-build HTTP/browser acceptance failed during database bootstrap. The exact error was `audit_security.audit_logs privileges are runtime[SELECT,INSERT] system[]` in `recordRestoredAuthority`; the existing source-governed manifest expected INSERT only even though scoped migration 0045 had installed tenant-RLS SELECT. The failure occurred before the application journeys ran.

## Permanent engineering correction
Align `SCOPED_NONPUBLIC_PRIVILEGES` and the packaged, SHA-256-digested catalog authority contract with the already-reviewed 0045 migration. Do not weaken `verifyRestoredAuthority`, skip reconciliation, remove RLS, grant UPDATE/DELETE, or widen the tenant predicate. New regression coverage checks exact manifest/contract alignment, contract digest, tenant-scoped policy, append-only privilege envelope and rollback.

## Qualification boundary
This is source-level remediation of a bootstrap authority mismatch, not evidence that native PostgreSQL 15/16, complete Vitest/contract, HTTP/browser, staging or institutional review passed on the new commit. Re-run exact-HEAD workflows and inspect both native database jobs, the browser/HTTP job and the native audit-reader test. No defect is independently CLOSED, no ratification is inferred and frozen Gate 0 provenance is unchanged.
