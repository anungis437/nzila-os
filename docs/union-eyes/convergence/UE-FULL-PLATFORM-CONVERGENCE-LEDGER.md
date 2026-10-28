# UE Full-Platform Convergence — Execution Summary

Mission: `UE-FULL-PLATFORM-CONVERGENCE-TO-STAGING-2026`
Branch: `agents/ue-cursor-final-closure` (PR #1014) · Baseline: `0b0e363aa` · Recorded at `6a4a6e820`.
Frozen Gate 0 evidence is untouched. Per-defect state lives in the machine-readable
[remediation ledger](./remediation/ue-defect-remediation-ledger.json); this page is the narrative.

**Current verdict: `READY_FOR_STAGING = NO`**

## Defect position

19 of the 150 release-debt items are repaired and tested. None is `CLOSED`.

| State | Count | Meaning |
|---|---|---|
| `NATIVE_VERIFIED` | 5 | Ran unmodified on native PostgreSQL 15 and 16, combined schema, runtime role, with an adversarial cross-tenant case |
| `UNIT_VERIFIED` | 14 | Positive and adversarial tests against mocks or an in-process SQL engine |
| `E2E_VERIFIED` | 0 | Needs the running application over HTTP or a browser |
| `CLOSED` | 0 | Needs every required proof and an independent release decision |

Of the 19: 14 were release-blocking, 4 conditionally blocking, 1 awaiting disposition.

## Batches

| Batch | Commit | Content |
|---|---|---|
| 1 | `8f8cb18aa` | Native-proof unblock (cache 0029, election RLS closure); rewards export, reconciliation run, settings PUT, profile roles; ratchets, persona matrix, stale tests |
| 2 | `43b1cc814` | Steward directory disclosure |
| 3 | `f866548e1` | Precedent ownership, report-execution joins, pilot telemetry scope |
| 4 | `560f003a1` | `/api/version`, `/api/docs`, v2 catch-all (410), CUPE reset, carbon (501), e-mail membership rebinding |
| 5 | `af75d9e88` | Tax paths (501) and ledger denial, single open dues payment, anniversary idempotency, signer identity |
| 6 | `6a4a6e820` | Native tenant-isolation proof (PG15 and PG16, 16 tests each) |

## Native proof

`db/__tests__/tenant-isolation-remediation.postgres.test.ts` runs the repaired route handlers unmodified against a
database built by Django `migrate` plus the approved Drizzle bootstrap. Only the transport is substituted: each
statement runs as `union_eyes_runtime` with `app.current_org_id` set, or as `union_eyes_system`. Cases that run on the
superuser connection prove the repaired statement carries its own tenant predicate.

Results: PG16 16/16, PG15 16/16. Earlier native suites (combined, thread, atomic-audit, census, document-intake,
location-retention, finance-duties, message-lifecycle, workaid, auth, election-succession, notification-delivery,
ownership-backfill) are recorded in [`evidence/vs-native-execution-8f8cb18aa.json`](./evidence/vs-native-execution-8f8cb18aa.json).

A defect the native run found: `union_eyes_system` holds no privilege on `arbitration_precedents`, so the system-role
read first written for shared precedents would have failed in production. The route now reads in the caller's tenant
context.

## Ratchet allowlists

Both allowlist entries are justified by executable proof, not by the allowlist itself (see the ledger's
`ratchetAllowlists`): the ownership backfill converts only reviewed legacy owners through `assignCase` and replays
idempotently under concurrency; the election succession rolls back when its audit write fails and stores one successor
under concurrent grants.

## Verification at the recorded commit

- Union Eyes `tsc`: clean. Union Eyes suite at `af75d9e88`: 1378 files / 19935 tests passed (batch 6 changed one route and
  added a native suite that skips without a database; the affected unit suites were re-run and pass). Contract tests:
  302 files / 10279 passed.
- `check-ue-convergence`: passed. `validate:docs`: no critical errors. ESLint on changed files: 0 errors.
- Deployment-safety tooling tests: 24/24.
- Frozen `ue-gate0b*-classification.test.mjs` quote pre-repair source text and fail once that source is repaired. They are
  not CI gates and are not edited.

## Open dependencies created or revealed by these repairs

- **Deployment secret.** `/api/version` now needs `UE_CANDIDATE_PROBE_TOKEN` to return image digests. The deploy workflow
  injects it; the secret must exist, or digest verification fails closed.
- **Precedent sharing.** Cross-organization precedent reads need a reviewed multi-party RLS policy migration.
- **Anniversary awards.** A unique index would exclude concurrent runs at the database; it needs a reviewed migration.
- **Removed v2 endpoints.** About 30 frontend call sites call `/api/v2/*` routes that no longer exist (reports, analytics,
  CLC remittances, federation, communications). They fail visibly now; each capability must be implemented or retired.
- **Arrears and health-and-welfare.** Generic collections over the remittance ledger now refuse; the capabilities are not implemented.
- **Institutional decisions not issued (default deny):** export audience, officer floors for steward directory and
  signature sending, report-source readers.

## Not proven

- Canonical V2 message predicate (test skipped).
- HTTP-level proof of the public-exposure containment through the proxy; browser acceptance of all fourteen stakeholder
  experiences; accessibility, EN/FR, performance and rate-limit acceptance.
- Credentialed provider sandboxes.
- Journeys A–I end to end; clean-checkout Docker reproducibility; staging manifest and rollback plan.
- The remaining 131 release-debt items.

Queue note: `VS_CODE_EXECUTION_QUEUE.*` still reads `READY_FOR_VS_EXECUTION` for its six items; the evidence file is the
record of their execution. Queue verdicts remain false.
