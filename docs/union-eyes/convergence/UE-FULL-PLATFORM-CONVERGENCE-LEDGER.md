# UE Full-Platform Convergence — Execution Ledger

Mission: `UE-FULL-PLATFORM-CONVERGENCE-TO-STAGING-2026`
Branch: `agents/ue-cursor-final-closure` (PR #1014) · Baseline: `0b0e363aa` · This ledger is append-only; frozen Gate 0 evidence is untouched.

**Current verdict: `READY_FOR_STAGING = NO`**

## Batch 1 — native-proof unblock and first release-debt repairs (commit `8f8cb18aa`)

| Item | Root cause | Repair | Proof |
|---|---|---|---|
| Mass native `permission denied` | Platform 0033/0034 election relations unclassified; grant activation aborted | Cache 0029 FORCE RLS, registry, lineage, catalog contract | Native PG15/PG16 suites, evidence JSON |
| Rewards export (DEF-0B11-PRP-REWARDS-EXPORT) | Over-broad audience, unaudited, unbounded, CSV formula injection | Admin floor, same-tx audit, LIMIT 5000, `toSafeCsv`, no-store | `rewards-export.route.test.ts` (8) |
| Reconciliation run-by-id | Lookup not organization-bound | Org-bound `getReconciliationRun`, guid validation | service + route tests |
| Organization settings PUT | Arbitrary keys writable, incl. billing/telemetry | Allow-list policy, protected keys refused, before/after audit | `settings-organization.route.test.ts` (18) |
| `/api/profile/roles` | CRUD collection over `profiles` | Self-only endpoint | `profile-roles.route.test.ts` |
| Ratchets / persona matrix | Two ratchet failures, five unmapped pages | Allowlists with reasons; matrix rows | check-ue-convergence, contract tests |
| Stale tests | Fixtures lagged routes (delivery ledger table, live reconcile mandate, UTC, `referred_categories`) | Fixtures updated; added mandate-denial test | full UE suite green |

Evidence: [`evidence/vs-native-execution-8f8cb18aa.json`](./evidence/vs-native-execution-8f8cb18aa.json).

## Batch 2 — steward directory disclosure

| Item | Root cause | Repair | Proof |
|---|---|---|---|
| DEF-0B11-IDS-STEWARD-ASSIGNMENT-ROWS-READABLE-BY-ANY-MEMBER… | Generic CRUD GET at `member` returned whole `steward_assignments` rows (personal phone, notes, grievance link) | Dedicated `GET /api/stewards` and `/api/stewards/[id]`: members get an allow-listed projection of active rows (`lib/stewards/steward-directory.ts`); officers get full rows with an atomic audit; other-organization or non-active rows read as 404; writes answer 405 (no appointment route exists) | `stewards-directory.route.test.ts` (10); UE suite, contract tests (10289) and convergence check pass |

Queue note: `VS_CODE_EXECUTION_QUEUE.*` still reads `READY_FOR_VS_EXECUTION` for its six items; the evidence file above is the record of their execution. Queue verdicts remain false.

## Open (not proven)

- Canonical V2 message predicate (test skipped).
- Browser acceptance, accessibility, EN/FR, performance, rate limits.
- Credentialed provider sandboxes; institutional mandates (default deny, not issued).
- Journeys A–I end to end; clean-checkout Docker reproducibility; staging manifest and rollback plan.
- Remaining release-debt items (examples): steward assignment visibility, precedent org-scope no-op, dues pay-post duplicates, rewards cron repeats, reports/execute unscoped joins, usage telemetry cross-org reads, CUPE bootstrap reset, three public exposures.
