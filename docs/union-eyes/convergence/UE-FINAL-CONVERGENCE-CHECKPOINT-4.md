# UE Final Convergence — Checkpoint 4 (continuation from `e7360607f`)

Mandate `UE-FINAL-CONVERGENCE-CONTINUATION`. Staging and production remain NO-GO. Nothing was pushed.

## What this checkpoint changes

| Commit | Change |
|---|---|
| `029b80bdc` | **Authority kernel adopted by a real domain (grievance case access).** One adapter, `lib/authority/store/route-adapter.ts` (`drizzleExecutor`, `decideCase`, `kernelCaseRelationshipScope`). `lib/services/case-access-service.ts` answers `getEffectiveCaseAccess`, collaborator grant and revoke, and the roster only from kernel decisions and governed relationships; a grant is `assignCase` under the adopted `case_assignment` rule, audited by the kernel in the same transaction. The 11 callers keep their interface. The pre-kernel `grievance_case_access_assignments` table is retired as an authority source: the kernel's own case loader no longer derives collaborators from it, list scopes use live non-recused kernel relationships as a pre-filter only, and a test proves a legacy row grants nothing. Ratchet `RETIRED-CASE-ACCESS-TABLE` at zero; seven stale `MUTABLE-REP-IDENTIFIER` allowlist entries removed. |
| `4a41bf982` | **Mutation isolation.** The organization predicate is now in the statement for deadline extension, approval, completion and escalation (shared `lib/deadline-engine/deadline-scope.ts`), shared clause library update and delete, ingestion retry, and grievance assign, status and convert. Ratchet test `mutation-scope-ratchet.test.ts` records the **309** remaining unscoped UPDATE/DELETE statements on tenant-scoped relations (190 file and relation pairs) and fails on any new one. |
| `34c6a76a6` | **Schema repair** platform 0020 (23 more relations); census **374 to 351**. Every remaining entry has a disposition and proof (`ue-canonical-schema-disposition.json`), checked complete by a database-free test. |

## Evidence

| Check | Result |
|---|---|
| `tsc --noEmit` (`apps/union-eyes`) | exit 0 after the kernel adoption and mutation work |
| `app/api`, `lib`, `services` unit tests | 1,229 files, 17,207 tests passed before the mutation-scope commit; the one later failure (a mock missing `and`) was fixed and its suite passes |
| `db/__tests__` (kernel PGlite suites, registry, census disposition) | 57 files, 1,073 tests passed |
| Kernel case access on PGlite with real kernel storage | 10 tests: rank and the legacy column grant nothing, foreign organization, missing case, ineligible grantee, self grant, primary owner, expiry terms, revocation, kernel audit chain |
| Combined kernel suite on fresh real PostgreSQL 16 | 10/10 after the schema migrations (fixtures needed the declared required `payments` columns `type` and `method`, a consequence of 0018) |
| Census on fresh real PostgreSQL 16 as the runtime role | 4/4; baseline 351 |
| `pnpm test:fast` (root, all projects) | **Exit 0 in a single run on the tree at `34c6a76a6`: 2,345 files passed, 26 skipped, 0 failed; 31,994 tests passed, 612 skipped; 955 s.** Earlier-session failures (a cold-import timeout in `apps/flow`) did not recur |
| `pnpm lint`, `pnpm validate:docs`, `pnpm governance:audit`, `tsc --noEmit` | all exit 0 on the same tree |
| Real PostgreSQL **15 and 16**, fresh databases, Django `migrate` plus the approved bootstrap (platform through 0020), as the runtime role | combined kernel suite, canonical-schema census (4 tests), messaging assignment (3) and case read scope (3): **20/20 on each version**. An earlier run that showed failures used an empty `UE_CANONICAL_BOOTSTRAP_V2` (it must be `0` or `1`), not a product defect |

Not re-run in this checkpoint: the heavy project as a whole after 0020 (the four real-PostgreSQL suites above were), the native authentication proofs, and the browser journeys.

## Findings worth knowing

- **Dual authority was real.** The kernel's case loader still read the pre-kernel collaborator table, so a legacy row could have conferred a collaborator relationship through the kernel. Removed.
- **Self-granted collaborators cannot be stored**: the database constraint refuses them before any policy runs.
- **The census is not closable by deleting declarations.** Deleting the 103 unreferenced latent declarations broke the schema folder (foreign keys and relations still name them), so it was reverted. Retirement needs that schema reworked together.
- **Request-context mutations are row-level-security bound** (`db` routes to the caller's tenant transaction); the unscoped statements matter most in system context, cron, webhooks and jobs. The ratchet is textual and does not see a predicate built in a helper or raw SQL.

## Not done — engineering-owned, still open

- **Kernel adoption beyond grievance case access.** The claims and cases routes (CUPE action enforcer, `caseReadScope`), documents, messaging, directory, finance and governance still use their own policy helpers; this is not yet the single enforcement boundary. Kernel storage (0013, 0020) is applied only to disposable databases, and until the issuance rules are adopted the kernel grants nothing, so only a case's creator reads a case through this path (deliberate fail-closed).
- **Mutation scope:** 309 statements remain in the baseline.
- **Schema:** 351 census entries remain: 103 `RETIRE_DECLARATION`, 59 `VERIFY_UNREACHABLE_THEN_RETIRE`, 116 `CONTAINED_DENY_ALL`, 23 `GLOBAL_REFERENCE_SHAPE`, 12 `SYSTEM_ONLY_SHAPE`, 10 `CREATE_RELATION_REQUIRED`, 15 `LIVE_UNREFERENCED`, 7 `INDIVIDUAL_DECISION`, 4 `REGISTRY_GAP`, 2 `SEPARATE_DATABASE`. Classification is not closure.
- **Audit:** the supplementary summary audits in case intake and bulk import, and denial-path audits, remain best-effort. No real-PostgreSQL fault-injection proof exists yet for the converted routes (mocked and PGlite only).
- **Identity bridge:** the 30-second parent-revocation window is unchanged.
- **Finance duties, WorkAid union-side referral and consent, the staff conversation surface, persona journeys, the `union_rep_id` backfill run and reader migration, legacy elimination (H-003/H-004):** not done in this checkpoint.
- **`grievances/[id]/assign` still writes the legacy primary-representative column** and requests assignment convergence; it must move to kernel assignment before that column can be retired.

## External gates (unchanged)

Institutional adoption of the issuance rules and document class policy; a credentialed staging clone; credential rotation; the webhook sender and Whop consumer; the counsel-side verifier and key custody; deployment log controls.

## Verdicts

| Verdict | State |
|---|---|
| ENGINEERING_CONVERGENCE | **NOT ACHIEVED** |
| PERSONA_FOUNDATION_READINESS | **PARTIAL** |
| CREDENTIALED_END_TO_END_ACCEPTANCE | **NOT STARTED** |
| INSTITUTIONAL_POLICY_ADOPTION | **NOT ADOPTED** |
| STAGING_QUALIFICATION | **NOT STARTED** (not authorized) |
| PRODUCTION_RELEASE | **NO-GO** |

## Resume order

1. Move `grievances/[id]/assign` and the claims/cases routes onto kernel assignment and `decideCase`; retire `caseReadScope` and the CUPE case helpers once their consumers are migrated.
2. Convert the system-context entries in the mutation-scope baseline first (webhooks, cron, jobs, platform services).
3. Real-PostgreSQL fault injection for audit rollback on the converted routes.
4. Rework the schema folder so the 103 `RETIRE_DECLARATION` entries can be deleted; prove the 59 `VERIFY_UNREACHABLE_THEN_RETIRE` ones unreachable; create the 10 absent relations.
5. Identity bridge parent linkage; finance duties; WorkAid union side; staff conversation surface; persona journeys.
