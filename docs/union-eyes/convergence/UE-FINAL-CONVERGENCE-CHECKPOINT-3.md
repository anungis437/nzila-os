# UE Final Convergence — Checkpoint 3 (UE-FINAL-CONVERGENCE-CONTINUATION)

**Branch:** `agents/ue-final-convergence` (integration worktree `C:\APPS\nzila-os.worktrees\ue-final-convergence`)
**Resumed from:** `88cf612a6` (checkpoint 2). **Supersedes** [Checkpoint 2](./UE-FINAL-CONVERGENCE-CHECKPOINT-2.md) for the items below.
**Not pushed. No other agent's worktree touched.**

The continuation directive rejected several blockers as engineering-owned. They were: the native test image, the staff message assignment, the non-atomic audit fallback, the load-sensitive test orchestration and the broken seed. Each was investigated and either fixed or shown to be wrong. The directive's verdicts are given at the end.

## Blocker reclassification (what turned out to be false)

| Previously claimed | Finding |
|---|---|
| "Session bearer fix needs the native image" | The pinned `pgvector/pgvector:0.8.1-pg16` image was present locally. The native identity suite ran (17/17) and so did every `scripts/bootstrap-v2` native proof. |
| "Staff message assignment needs a privilege migration the agent cannot make" | Implemented (platform 0014, RLS 0021, manifest privileges) and proven on real PostgreSQL. |
| "Clean full-suite pass absent" | `pnpm test:fast` now passes in a single run (see Evidence). |
| "Seed needs re-authoring" | The seed targeted a schema the platform no longer has; retired with consumers migrated. |
| (new) "The messaging engine works" | It had never run on the canonical schema. The Django-created `messages` and `in_app_notifications` are bare stubs and `message_threads` has no column defaults (UE-CONV-H-007). |

## What changed

| Commit | Change |
|---|---|
| `f51b5a7fe` etc. | **Atomic audit.** `persistAtomicAudit` (canonical ledger, else an `audit_logs` insert in the same transaction, no separate-connection fallback) replaces the best-effort writers in governance approvals and denials, policy transitions, board packets, templates, council elections, reserved matters, claim and case creation, membership, document upload and download, admin membership actions and dues. Proven: commit together, rollback on audit failure, concurrent independence. ~60 best-effort call sites remain (K-005). |
| `f51b5a7fe` | **Staff message assignment** (I-002): expiring, revocable, administrator-granted triage designation; metadata-only queue; assign, reassign and release by the current assignee or a designation holder; exactly one of two concurrent assignments wins; history, notice and audit in one transaction; stub evolution. |
| `27d15c321` | **Session bearer** (A-004): both the TypeScript org binding and the Django canonical context forward only a 30-second bridge token, never the cookie. Test projects split so container, child-process and repository-scan suites run serially after the main project. |
| `6241f944d`, `abaaf8b60` | **Replay seeds and fake seeder retired** (H-005 CLOSED): `db/replay.ps1`, six SQL seeds and two empty TypeScript seeders deleted; `/api/admin/seed-test-data` returns 501; ratchet added. |
| `d36634665`, `c25d4f4eb`, `09ef28f2f` | **Atomic audit, second pass** (K-005). Case assign, notes, transition and escalate; grievance create, import rows, steward assignment, status, priority override, conversion and document upload; workbench assignment; the representation-authority and external-document-grant lifecycles; and collaborator access grant and revoke (ownership check, mutation and audit now in one transaction, which also closes a read-then-write race on the owner check). Each route test asserts the in-transaction audit and failure when the audit write fails. Ratchet `CASE-MUTATION-BEST-EFFORT-AUDIT` holds those files at zero and was shown to detect a reintroduced writer. Verified on this tree: `tsc` exit 0, 29 case and grievance route test files (169 tests) plus the service tests pass, convergence checker passes. Re-validated at the end of the session (tree at the census commit plus a source-audit test fix): `pnpm lint`, `pnpm validate:docs` and `pnpm governance:audit` exit 0; `tsc` exit 0; `pnpm test:fast` 2,340 files and 31,975 tests passed with ONE failure, `apps/flow/tests/invoices-page-slice.test.ts`, a cold-import timeout (15 s) in an app this branch does not touch, which passes in isolation (an earlier run under memory pressure also showed worker-start failures and three more load timeouts that pass in isolation). So `test:fast` is NOT a clean single-run pass at the head. Fresh PG15 and PG16 as the runtime role: the combined kernel suite (10 tests) passes on both after platform 0015; the storage, Django-audit, messaging and case-scope real-PG suites were not re-run. |
| `1ddee6e82` | **Atomic audit, third pass**: dispatch request and assignment, case evidence upload and delete (the stored object is removed only after the record and its audit commit), grievance clause link. The ratchet covers them; a dispatch route test was added. |
| `7ddbccc3d` | **Governed ownership backfill** (B-001): `planOwnershipBackfill` (read-only, defers every non-eligible legacy owner to a person, hashes the candidate set) and `executeOwnershipBackfill` (approved plan hash plus recorded decision reference, drift and truncation refused, assignments through `assignCase` under normal issuance governance, all or nothing, decision reference in the audit). 7 PGlite tests; the 10 existing kernel PGlite suites (187 tests) still pass. Reader migration is NOT done: it needs qualified kernel storage and an institutional decision that each legacy owner is genuine. |
| `bddfe8ec0` | **Payments transaction source** (D-001, platform 0015): nullable `member_id`, `amount`, `currency` with non-negative and ISO-shape checks, no invented values. Applied by the canonical bootstrap on fresh real PostgreSQL 15 and 16; the combined suite (10 tests) passes on both as the runtime role, including readiness true, untouched existing row, refused bad values, refused cross-tenant insert, and unregistered payments still denying every finance action. |
| (this commit) | **Canonical-schema census** (H-007): `canonical-schema-census.postgres.test.ts` compares every Drizzle table declaration with the real schema after Django `migrate` and the bootstrap. Finding: **500 declarations cannot be served as declared** (63 relations absent, 425 with missing columns, 173 with a required undeclared column), for example `dues_transactions` lacks 22 declared columns. Committed as a ratchet baseline; shown to fail when a table gains a defect. |
| `556a08d56` | **Seniority-derived tenant-wide case read removed.** `caseReadScope` gives a member their own cases, staff the cases assigned to them, and a live `cases` triage designation holder the unassigned cases. Designations generalized to a `messages` or `cases` scope. |

## Evidence (this tree)

| Check | Result |
|---|---|
| `pnpm test:fast` (root `vitest run`, all projects) | **Exit 0 in a single run: 2,338 files passed, 25 skipped, 0 failed, 0 unhandled errors; 31,949 tests passed, 608 skipped; 863 s.** The first clean single-run pass recorded on this branch |
| `pnpm lint` | exit 0 |
| `pnpm validate:docs` | 0 errors |
| `pnpm governance:audit` | exit 0 |
| `tsc --noEmit` (`apps/union-eyes`) | exit 0 |
| `node tooling/scripts/check-ue-convergence.mjs` | passes; 12 ratchet rules; migration lineage verified |
| Real PostgreSQL 15 and 16, fresh databases, Django `migrate` + approved bootstrap, as the runtime role | kernel combined, storage and Django-audit suites, messaging assignment (3) and case read scope (3): **31/31 on each version**; messaging and case scope again in canonical audit mode: 6/6 on each |
| Native proofs (`scripts/bootstrap-v2`, 25 files, with `AUTH_NATIVE_PROOF`, `UE_V2_NATIVE_FRAMEWORK` and `UE_V2_NATIVE_MANIFEST`) | 636 tests passed at the bearer commit; not re-run after the case-scope change, which does not touch authentication |
| In-process PostgreSQL | atomic audit (4), thread assignment (17), case scope and history suites updated and passing |

Test orchestration: the project split (`vitest.heavy.config.ts`, `vitest.shared.ts`) removes the contention that produced load-dependent timeouts; timeouts were not the control. The runtime of `test:fast` rose from about 550 s to about 860 s because the heavy suites now run serially.

## Not done — engineering-owned, still open

- **Staff conversation surface.** The queue, assignment and reply screens do not exist; staff notices carry no link. Unread state needs a governed privilege change for read receipts. Escalation is modelled as reassignment only. Retention and privacy controls for threads are not built (I-002).
- **Supervisory case read.** Reading another staff member's assigned cases now needs a kernel mandate, which needs institutionally adopted issuance rules. Until then only the assignee can read an assigned case. This is a deliberate, recorded consequence, not a granted bypass (E-001).
- **No application route consumes the kernel.** The claims read scope, triage and messaging use purpose-built predicates over their own governed tables. Routing the case, finance and governance routes through `enforceAuthority` (the single-path directive) is not started. Kernel storage (0013/0020) is proven on disposable databases only.
- **`union_rep_id`** (B-001): the governed backfill is built and proven on PGlite, but it has not been run against any organization and the ~30 readers are unmigrated.
- **Finance** (D-001, D-003): the `payments` source columns now exist (platform 0015) but no route registers payments or consumes the finance policy; the route gates are still a numeric hierarchy plus an exact allow-list. The duty model needs the institution to decide which offices hold which duties and thresholds.
- **WorkAid** (G-002): the synthetic harness only; no union-side referral, consent or counsel adapter on the kernel (G-003 external).
- **Audit** (K-005): about 45 best-effort call sites remain: case evidence, dispatch assignment and requests, recommend-steward, suggest-clauses and others outside the case and grievance mutation set. The two representation-authority and external-grant services have no route consumer; their atomicity is proven by mocked-transaction tests only, not on PostgreSQL.
- **Canonical-schema repair** (H-007): the census exists and is ratcheted, but the 500 entries are unresolved. They must be ranked by reachable write path and each either evolved through a platform migration or retired with its callers. Until then, any feature that writes to those relations (including the dues payment and settlement paths) cannot be assumed to run on the Django-first lineage.
- **Bridge window**: a bridge can outlive revocation of its parent session by at most 30 seconds; closing it needs a parent link and a definer-predicate migration.
- **Persona journeys** (workstream I/11): no end-to-end journey through real routes and persistence per persona was built.
- **Unqualified hashes**: platform 0013 and 0014 and scoped 0020 and 0021 are registered UNQUALIFIED and applied only to disposable databases.

## External gates (unchanged)

Institutional adoption of the issuance rules and document class policy; a credentialed staging clone; credential rotation; the webhook sender and Whop consumer; the counsel-side verifier and key custody; deployment log controls for the bearer exposure.

## Verdicts

| Verdict | State |
|---|---|
| ENGINEERING_CONVERGENCE | **NOT ACHIEVED.** P0/P1 engineering-owned items remain (kernel route adoption, finance duties, `union_rep_id`, remaining audit sites, staff conversation surface) |
| PERSONA_FOUNDATION_READINESS | **PARTIAL.** All six persona branches and the WorkAid harness are integrated; the case, document, directory and message read paths are relationship-scoped and tested on real PostgreSQL; member, representative, executive, financial and governance journeys are not proven end to end |
| CREDENTIALED_END_TO_END_ACCEPTANCE | **NOT STARTED** |
| INSTITUTIONAL_POLICY_ADOPTION | **NOT ADOPTED** |
| STAGING_QUALIFICATION | **NOT STARTED** (not authorized) |
| PRODUCTION_RELEASE | **NO-GO** (`UE_SAAS_OPERATIONAL_READINESS` = `NO_GO — RUNTIME_PROOF_REQUIRED`) |

## Resume order

1. Convert the remaining best-effort audit sites outside the case, grievance and dispatch mutation set, extend `CASE-MUTATION-BEST-EFFORT-AUDIT`, and add a real-PostgreSQL rollback proof for case-access grant and grievance creation.
2. Rank the H-007 census by reachable write path and repair the highest-risk relations (dues, claims, documents) through platform migrations with real-schema tests; shrink the baseline.
3. Build the staff conversation surface and unread state on the existing contract.
4. Route one domain end to end through `enforceAuthority` (case read) with a dedicated authority connection, then retire `caseReadScope`. Gated on kernel storage qualification.
5. Run the ownership backfill per organization on a qualified clone, then migrate the `union_rep_id` readers.
6. Finance duties and governed limits (needs the institutional decision); WorkAid union-side referral and consent on the kernel.
