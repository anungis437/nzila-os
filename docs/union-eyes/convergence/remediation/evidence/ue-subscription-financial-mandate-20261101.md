# Union Eyes Gate 0 — subscription financial mandate and tenant-scoped reads

**Defect:** `DEF-0B3-SUBSCRIPTION-ROLE-TITLE-AND-MEMBER-READ` (existing PARTIAL, not CLOSED).

**Branch:** `agents/ue-cursor-final-closure`. Source and regression commits: `bc0b8cec32b805d602b01dccf74800a4ec794f40`, `7bd93290c78e2ed1dc6910bf4df314b7319f21ab`, `785a8777d59d446b3b98b32dcc30cc416c709811`, `7d6ea677f072d0f863a810aa23a9a9f1e1e8722c`, `03947304b3d6454400c022f30f31cd1d4ddfdd52`, `262974e23992cfbc99a8544914a03226f1f87385`, `b97b82c40bd4a0510bd5543f84e9349cc1d966ce`.

## Engineering correction (source inspection only)

- Subscription collection GET now requires authenticated organization and principal, reads inside `withRLSContext`, checks a live `finance:view` mandate, filters records to the mandate's resource IDs or organization ledger, and pages at a bounded limit/offset. A role title or entitlement alone is insufficient.
- Subscription detail GET requires a live `finance:view` mandate naming that subscription or the ledger before its tenant-scoped read.
- Collection POST pause/resume checks `finance:execute` for the exact subscription ID before invoking the existing organization-scoped service. The service's own transaction remains separate from the mandate preflight; this is **not** a claim of atomic external side-effect authorization.
- Item PATCH checks `finance:prepare` for the exact subscription, reads the current row, preserves server-owned commercial metadata, conditionally updates and appends the audit record in the same tenant transaction.
- Item DELETE checks `finance:execute` for the exact subscription, reads and conditionally cancels it and appends the audit record in the same tenant transaction.
- All routes refuse missing organization or principal. No default mandate is invented. If financial mandates are unissued, the existing authority kernel fails closed.

## Regression evidence authored, not executed

`apps/union-eyes/app/api/__tests__/billing-subscriptions.route.test.ts` exercises missing context, financial mandate refusal before data access, scoped collection listing, bounded pagination, resource-specific execute checks and refusal before pause/resume.

`apps/union-eyes/app/api/__tests__/billing-subscriptions-mandates.route.test.ts` exercises detail GET, PATCH and DELETE denial before data access, tenant-bound predicates, protected commercial provenance and same-transaction audit calls.

These tests are authored source artifacts, **not** proof of passing execution. The previous exact-HEAD `9e645367e47e4ab279dea913d14fd83f5dab212f` had App Floor Check, security regression, native PostgreSQL acceptance and governance attestation passing, but whole-app/contract and HTTP/browser workflows failing. None of those prior results qualifies these new commits.

## Qualification still required

1. Focused Vitest and complete application/contract tests on the new exact HEAD, with failures repaired rather than waived.
2. Real PostgreSQL 15/16 runtime-role tenant isolation and resource-mandate fixtures; verify absent, revoked, unrelated and ledger-wide mandates, with concurrent writes and audit rollback.
3. Real HTTP/browser checks of GET, pause, resume, metadata update and cancellation for the officer, secretary-treasurer, unauthorized principal and another tenant; confirm all list pages remain accessible.
4. Confirm financial mandate issuance, subscription cancellation provider reconciliation and commercial authority with institutional owners. The pause/resume preflight and provider mutation are not a single transaction.
5. Independent reviewer, owner-persona ratification and institutional authority decisions under Gate 0C.4.

**Credit:** No new implementation/qualification count; no CLOSED state. Frozen 777-defect register unchanged. Overall Gate 0 remains NO_GO.
