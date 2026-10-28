# UE Full-Platform Convergence — Execution Summary

Mission: `UE-FULL-PLATFORM-CONVERGENCE-TO-STAGING-2026`
Branch: `agents/ue-cursor-final-closure` (PR #1014) · Baseline: `0b0e363aa` · Recorded at `8636991de`.
Frozen Gate 0 evidence is untouched. Per-defect state lives in the machine-readable
[remediation ledger](./remediation/ue-defect-remediation-ledger.json); this page is the narrative.

**Current verdict: `READY_FOR_STAGING = NO`**

## Defect position

46 of the 150 release-debt items are repaired and tested; every item classed `RELEASE_BLOCKING` now has an executable disposition. None is `CLOSED`.

| State | Count | Meaning |
|---|---|---|
| `NATIVE_VERIFIED` | 10 | Ran unmodified on native PostgreSQL 15 and 16, combined schema, runtime role, with an adversarial cross-tenant case |
| `UNIT_VERIFIED` | 36 | Positive and adversarial tests against mocks or an in-process SQL engine |
| `E2E_VERIFIED` | 0 | Needs the running application over HTTP or a browser |
| `CLOSED` | 0 | Needs every required proof and an independent release decision |

Of the 46: 34 release-blocking (all 34 in the class), 11 conditionally blocking (including the two challenged items treated as release-blocking), 1 awaiting disposition. 0 items classed release-blocking remain open; 108 items in other classes remain (conditionally blocking, awaiting disposition, tracked debt), and release-blocking repair is not closure: no item is `CLOSED`.

## Batches

| Batch | Commit | Content |
|---|---|---|
| 1 | `8f8cb18aa` | Native-proof unblock (cache 0029, election RLS closure); rewards export, reconciliation run, settings PUT, profile roles; ratchets, persona matrix, stale tests |
| 2 | `43b1cc814` | Steward directory disclosure |
| 3 | `f866548e1` | Precedent ownership, report-execution joins, pilot telemetry scope |
| 4 | `560f003a1` | `/api/version`, `/api/docs`, v2 catch-all (410), CUPE reset, carbon (501), e-mail membership rebinding |
| 5 | `af75d9e88` | Tax paths (501) and ledger denial, single open dues payment, anniversary idempotency, signer identity |
| 6 | `6a4a6e820` | Native tenant-isolation proof (PG15 and PG16, 16 tests each) |
| 7 | `e0afd3bf9` | Organization reads and roster: item, children, descendants, hierarchy, search, tree, analytics, roster GET and POST bounded to what the caller may read; active-membership-only guard |
| 8 | `66acc8b1e` | The 12 remaining release-blocking defects: organizing campaigns, pension retirement eligibility, testimonials, health-and-safety incident read, anonymity and dashboard, exit-interview sensitivity, consent and publication, cognition constants (501), ICRA report gate, operational metrics; plus organization list and tree (OPL-01, OPL-07). Native proof for pension (PG15 and PG16, 17 tests each) |
| 9 | `8636991de` | Interview sensitivity and consent applied to every derived engine (topic graph, propagation, resilience, simulation, continuity risk, succession, expertise map, governance timeline); forecast no longer fabricates a trend; succession model call audited and schema-validated; native proof for organization list, tree, item, hierarchy and search (PG15 and PG16, 5 tests each) |

## Native proof

`db/__tests__/tenant-isolation-remediation.postgres.test.ts` runs the repaired route handlers unmodified against a
database built by Django `migrate` plus the approved Drizzle bootstrap. Only the transport is substituted: each
statement runs as `union_eyes_runtime` with `app.current_org_id` set, or as `union_eyes_system`. Cases that run on the
superuser connection prove the repaired statement carries its own tenant predicate.

Results: PG16 17/17, PG15 17/17 (16/16 at batch 6; batch 8 adds the pension retirement route). Earlier native suites (combined, thread, atomic-audit, census, document-intake,
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

- Union Eyes `tsc`: clean. Union Eyes suite before the final batch-8 additions: 1379 files; the only failure (a committed schema-mutation program that listed the dashboard as a reader) was corrected, then re-run. Contract tests: 302 files; the one failure (a source-text check of the member interview filter, which moved to the shared interview access policy) was updated to read both files.
- `check-ue-convergence`: passed. `validate:docs`: no critical errors. ESLint on changed files: 0 errors.
- Deployment-safety tooling tests: 24/24.
- Frozen `ue-gate0b*-classification.test.mjs` quote pre-repair source text and fail once that source is repaired. They are
  not CI gates and are not edited.

## Open dependencies created or revealed by these repairs

- **Deployment secret.** `/api/version` now needs `UE_CANDIDATE_PROBE_TOKEN` to return image digests. The deploy workflow
  injects it; the secret must exist, or digest verification fails closed.
- **Precedent sharing.** Cross-organization precedent reads need a reviewed multi-party RLS policy migration.
- **Interview-derived engines.** Eligibility (published, consented, public_internal or restricted) now applies to every derived engine; the levels are an engineering default awaiting the institutional decision, there is no minimum cohort before a role is attached to a tag, and the forecast reports no trend until a measured history exists. The correlation, precedent and procedural engines answer 501 until a real computation exists.
- **Knowledge base entitlement.** The knowledge-base read routes do not check the `union_knowledge_suite` entitlement.
- **Institutional defaults.** Officer floors for organizing, pension and campaign data, the anonymous-report actor and the interview indexing levels are engineering defaults awaiting institutional confirmation.
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
- The remaining 123 release-debt items, 12 of them release-blocking (organizing campaign rows, pension retirement list,
  testimonial writes, cognition literals, interview publication and reads, health-and-safety, ICRA gate, ML metrics).
- The organization routes have not run natively (their SQL was checked against the native schema).

Queue note: `VS_CODE_EXECUTION_QUEUE.*` still reads `READY_FOR_VS_EXECUTION` for its six items; the evidence file is the
record of their execution. Queue verdicts remain false.
