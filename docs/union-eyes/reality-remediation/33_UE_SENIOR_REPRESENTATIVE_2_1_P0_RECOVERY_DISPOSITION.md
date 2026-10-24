# UE_SENIOR_REPRESENTATIVE_2_1_P0_RECOVERY_DISPOSITION

Continuation of `UE-SENIOR-REP-2.1-CONVERGENCE` (see [file 32](./32_UE_SENIOR_REPRESENTATIVE_2_1_CONVERGENCE_DISPOSITION.md)). Registered 2026-10-23.

**Verdicts — LOCAL: NO_GO · STAGING: NO_GO · PRODUCTION: NO_GO.** Nothing in this document is `NATIVE_STAGING_PROVEN`. Branch is unpublished; no merge, push, deployment or production mutation occurred.

Evidence labels: `SOURCE_INSPECTED`, `TEST_PROVEN` (automated test, including PGlite = real PostgreSQL engine, no network/session), `LOCAL_RUNTIME_PROVEN` (running application with persistent synthetic data), `NATIVE_STAGING_PROVEN`, `NOT_PROVEN`.

## 1. Verified baseline and commit contents

- Worktree `C:/APPS/nzila-os.worktrees/frozen-senior-representative-architecture`, branch `agents/frozen-senior-representative-architecture`.
- Baseline `0c994b968` (PR #995 merge). Checkpoint `c38dc348f` exists and contains the P0-B/P0-C/P0-D patches and tests. `git for-each-ref --contains` shows only this local branch holds it: **unpublished**. Other worktrees were not touched.
- **Correction (2026-10-23, after review):** an earlier version of this paragraph said no Representative 2.2 or Member 2.1 work existed in this repository. That was wrong: the check filtered branch names, and those branches are not named after their persona. See section 13 for the full ref inventory and overlap analysis.
- This continuation adds a second local commit on top (no history rewrite).

## 2. Disposition of the four generated inventory files — SOURCE_INSPECTED

`tooling/repo-inventory/output/{inventory.json,inventory.md,repo-inventory.json,repo-inventory.md}` changed by counters only (`tsTestFileCount` +1, `codeFileCount` +1 per added file). They are **not accidental**: the repository's `inventory-sync` pre-commit hook (`lefthook.yml`) regenerates and stages exactly these four files for any commit touching `apps/**`, because CI's "Enforce committed inventory lock" step fails on drift. Removing them would break CI, and a commit touching `apps/**` cannot exclude them without bypassing the hook, which was not done. Decision: keep them, and treat them as derived output that the integration owner regenerates after the final merge (counts will change again when other persona branches land).

## 3. Cross-case read confidentiality (P0) — reproduction, fix, residual

### Reproduction (SOURCE_INSPECTED, then converted to failing-before/passing-after tests)

Every one of these treated `hasMinRole('steward')` as case access, so any steward-or-above in an organization could read matters they had no relationship to:

| Surface | Defect |
| --- | --- |
| `GET /api/grievances` | Returned up to 500 **full rows** (narrative, grievant name/email) for the whole organization to any steward+. |
| `GET /api/grievances/[id]` | `isStewardPlus` bypassed the relationship check for the record, events, linked documents and governed-document filtering. |
| `GET /api/grievances/[id]/related-documents`, `/intelligence` | Same bypass; `intelligence` also built similar-case and knowledge-graph output from other cases. |
| `case-pattern-detection-service` | Treated the actor as `canViewCase: true` for every candidate case when `isStewardPlus`. |
| `GET /api/documents/repository`, `/repository/[id]`, `/documents/[id]/download` | `hasCaseAccess: isStewardPlus || …` for case-linked documents. |
| `GET /api/search/universal` | Case, document and note results unfiltered for steward+. |
| `POST /api/grievances/[id]/documents` | Steward+ could attach documents to any case. |
| `PATCH /api/documents/repository/[id]` | Steward+ could relabel any case document (e.g. downgrade `privileged`). |
| `POST /api/grievances/[id]/suggest-clauses` | Analysed any case's description and could link clauses to it. |
| `isDocumentVisibleByPolicy` | `isStewardPlus` short-circuited all non-sensitive labels to visible. |

(Earlier in this mission the access-roster `GET` and grant/revoke were already closed; see file 32.)

### Fix (TEST_PROVEN)

The rule is now one sentence everywhere: **a case is readable only by its creator, its primary owner, or a holder of an active, unexpired case-access grant; organization role seniority is not an input.**

- `isDocumentVisibleByPolicy` and `authorizeDocumentsForActor` no longer take `isStewardPlus` (field kept as optional, ignored, `@deprecated`, so callers outside this change compile). Primary owner remains the only case-less path.
- All routes above stopped computing/consuming seniority for case content. Case-linked documents whose `linkedEntityType` is not `grievance` now fail closed for everyone without an explicit grant (previously only steward+ could read them; behaviour change to be confirmed by the owner).
- `GET /api/grievances` returns full records only for matters the caller authored, owns, or holds a grant for. The queue otherwise exposes unassigned, non-confidential `draft` intakes as **triage metadata only** (`id`, number, type, status, priority, created date; no narrative, grievant identity or employer detail), tagged `accessScope: 'case' | 'intake_triage'`. Shared predicates live in [grievance-read-scope.ts](../../../apps/union-eyes/lib/services/grievance-read-scope.ts).
- Label changes on a case document, document upload to a case, and clause linking now need case-management authority (primary owner, or `canUploadDocuments` / `canDraftActions` grants where applicable).

### Evidence

| Claim | Evidence | Level |
| --- | --- | --- |
| Predicate returns only authored/owned/active-grant matters; expired and revoked grants, foreign-organization grants and SQL-injection-shaped non-UUID ids behave correctly; revocation is immediate; triage scope excludes assigned and confidential intakes | `lib/services/grievance-read-scope.pglite.test.ts` (PostgreSQL engine via PGlite) | TEST_PROVEN |
| A steward-level user with no relationship is denied (403) on grievance detail, intelligence, related documents, document upload and clause suggestion, and no analysis/graph/insert is attempted | route tests in `app/api/__tests__/grievances-*.test.ts`, `grievances-id-suggest-clauses…` | TEST_PROVEN (mocked data layer) |
| Policy denies a seniority-flagged user with a stray document grant but no case relationship, every label | `document-governance-service.test.ts` | TEST_PROVEN |
| Repository listing does not pass seniority into the policy | `documents-repository.route.test.ts` | TEST_PROVEN |
| Real authenticated HTTP requests against a running candidate, cache/notification/export/signed-URL behaviour | not run | **NOT_PROVEN** |

### Not closed — reported for the owner (Representative 2.2 / integration owner)

1. **Claims path.** `caseReadScope` grants tenant-wide claim reads to `chief_steward`, `business_agent`, `officer`, `admin` (`lib/cases/case-authorization.ts`, asserted as intended by `case-authorization.pglite.test.ts`). The mission requires that senior roles not receive unlimited underlying content. Changing it alters the Representative 2.2 policy matrix and an existing tested contract, so it was **not changed**. Needs an owner decision plus a metadata-only supervisory projection (which in turn needs the mandate store, section 5).
2. **Other steward-gated writes with no relationship check**: `PATCH /api/grievances/[id]/status`, `/convert`, `/priority-override`, `/assign` (officer+), `/recommend-steward`, `/import`. Integrity rather than disclosure, but the same class. Not changed; **P1**.
3. **Exports, messaging/correspondence, notifications, member context, cached representations, document list outside the routes above, and revoked-user stale links** were not audited route-by-route here. **NOT_PROVEN.** `app/api/cases/*/export`, `app/api/cases/*/evidence` and external-facing routes are the next sweep.
4. **Database boundary.** `grievances` is a 0108-baseline "direct org policy" table (`db/rls-storage-authority/baseline-0108.ts`): RLS isolates **organizations**, not cases within one. No same-organization case-level RLS exists. Proposing one needs a migration and an RLS-census entry — owner decision. Until then isolation inside an organization is application-enforced only. **NOT_PROVEN at the database layer.**
5. **Search recall.** `search/universal` applies the case filter after `LIMIT`, so results for low-privilege users can be sparse. Correctness is unaffected; UX follow-up.
6. Reachability: no deployed environment was queried. If these routes are live in an environment, every item in the table above is reachable there by any steward-or-above account; report to the release owner for containment. This session cannot deploy.

## 4. Grant-escalation regression evidence (TEST_PROVEN)

Unchanged from file 32 and re-run: `lib/services/case-access-service.test.ts` (non-owner steward writes nothing; self-grant; ineligible grantee; expiry and scope terms; wrong-case revoke) and `grievances-access.route.test.ts` (steward+ without relationship denied on GET/POST/PATCH; re-activation refused). Grant administration remains primary-owner-only as containment.

## 5. Five-authority contract and storage decision — SOURCE_INSPECTED; BLOCKED pending owner

Existing stores inspected before proposing anything:

| Existing | Reusable for |
| --- | --- |
| `grievance_case_access_assignments` | Per-matter collaborator grants (role, scope flags, expiry, status). Keep as the **case review** grant and as the revocation target on handover. |
| `document_access_grants` | Per-document grants. Keep as **restricted information** grant. |
| `representation_authorities` (+ `external_matter_access_grants`) | Lifecycle pattern (`pending/active/revoked/expired/superseded`, `effectiveAt/expiresAt/revokedAt/supersededBy`, scoped `matter_type/matter_id`, evidence document). Models member → external specialist authority, **not** an internal supervisory mandate; reuse the pattern, not the rows. |
| `recusal_tracking` (governance/conflicts) | Candidate source of conflict/recusal facts. Currently not wired to any case read or assignment path. |
| `grievance_approvals`, `grievance_assignments` | Exist but are `LATENT_UNREACHABLE` per the RLS census (no production caller). Not usable as evidence of an approval workflow. |

Smallest shared contract needed (proposal only — **no schema was created**; storage belongs to the shared UE integration owner):

`supervisory_mandates` — one row per delegated power: `organization_id`; `holder_user_id`; `power` ∈ {`queue_oversight`, `assignment`, `case_review`, `decision_approval`, `restricted_access`}; `scope_kind` ∈ {`servicing_territory`, `workplace`, `matter`} + `scope_ref` (null only for territory scope bound to a configured institution); `actions` (text[], e.g. `approve:settlement`); `sensitivity_ceiling`; `effective_at`, `expires_at`, `revoked_at/by`; `granted_by` (must hold `grant_mandate` for that power and differ from holder); `acting_for_user_id` (succession/acting supervisor, always time-boxed); `status`; evidence reference. Evaluation is a single server function that must check, per action: actor's active organization, mandate active and unexpired, scope contains the resource, no `recusal_tracking`/party conflict, sensitivity ≤ ceiling, holder ≠ subject (no self-approval), and the approved representation protocol permits the action. Seniority is not an input; there is no universal override.

Until that store and evaluator exist, **queue oversight, assignment, case review, decision approval and restricted-information authority for senior roles are BLOCKED** and current fail-closed restrictions stand.

## 6. Legacy protocol compatibility and independent approval — TEST_PROVEN

- New status `legacy_unapproved`: well-formed settings saved before provenance existed. Preserved byte-for-byte, never executable. Malformed shape or malformed provenance → `invalid`; absent → `missing`; authored but unapproved → `pending_approval`; independently approved → `approved`.
- Adoption path: `POST /api/admin/representation-protocol {"action":"submit_legacy"}` stamps the submitting administrator as author, keeps the settings, and moves the record to `pending_approval`; a **different** administrator approves with `POST` (no body). Nothing is auto-approved and self-approval is refused. UI shows the state and the two actions.
- Consumers: `autoAssignGrievance`, `manuallyAssignGrievance` and `reassignGrievance` now require an approved protocol (tests assert no writes otherwise). Note `lib/case-assignment-engine.ts` has **no production HTTP caller** (RLS census: `LATENT_UNREACHABLE`), so these gates guard a future wiring, not a live path. **Filing, escalation and the claims assign route do not consult the protocol.** Enforcing it there would disable official-case filing for every organization that has not adopted a protocol, so it needs a staged rollout decision. **NOT_PROVEN.**
- Single-administrator deadlock: unresolved by design. Segregation of duties is not relaxed. A valid independent approver is another organization administrator or a governance-controlled onboarding approver; no such platform approver identity is established in this codebase, so such an organization stays `pending_approval` and its protocol-gated actions remain unavailable.
- Inventory of affected records (read-only, not run — no production access authorized): `SELECT organization_id, key, updated_by, updated_at, value ? 'approval' AS has_approval FROM org_configurations WHERE category='grievance' AND key='representation_protocol';` Records with `has_approval = false` are `legacy_unapproved` (or `invalid` if malformed).

## 7. Assignment and audit consistency — TEST_PROVEN (mocked data layer) / SOURCE_INSPECTED

`POST /api/cases/[caseId]/assign` (claims model; authoritative for claims; grievances use `unionRepId` + case-access grants and have no equivalent shared transfer workflow):

| Property | Behaviour |
| --- | --- |
| Authorization, eligibility, party conflict | `case_assign`, `caseAssigneeEligible`, filer/assignee party check — before any write. |
| Concurrency | Row locked `FOR UPDATE`, then compare-and-set on the previous assignee. Lost race → 409 `ASSIGNMENT_CONFLICT`, no history/audit/evidence. Serialization under real concurrent connections is **NOT_PROVEN** (PGlite is single-connection). |
| Repeat submission | Same assignee already holds the case → 200 `{transferred:false}`; no write, no re-audit. Safe to retry. |
| Durable history | `claim_updates` row inserted in the same transaction as the assignment. |
| Audit, canonical mode | `appendCanonicalAuditLog(tx, …)` inside the transaction: audit failure rolls the assignment back, and no evidence/metric fires. |
| Audit, non-canonical mode | Separate post-commit write; failure → 500 `ASSIGNMENT_COMMITTED_AUDIT_FAILED` exposing the committed state and history record id; a retry is a no-op (above). |
| Prior-owner access | Claim reads are scoped by `assignedTo`, so the outgoing owner loses read scope with the same write (`case-authorization.pglite.test.ts`). |

Not implemented, so a transfer is **not** a full handover: successor acceptance, pending-obligation/deadline carry-over, outstanding-communication transfer, member-visible update, grievance-model transfer and revocation of the outgoing owner's collaborator grants. SR11 stays LIMITED. In `reassignGrievance` (unreachable engine) the successor is now created before the prior assignment is retired, mismatched-case and non-active assignments are refused, and a failed retire is reported as a failure, not a completed transfer.

## 8. Gate results

| Gate | Result | Notes |
| --- | --- | --- |
| Focused suites for every changed file (route, service, policy, protocol, engine, PGlite) | PASS | ~25 files, re-run after each change. |
| `pnpm --filter @nzila/union-eyes typecheck` | PASS (0 errors) | After fixing an implicit-`any` introduced during this work. |
| Full union-eyes vitest (`vitest run` in `apps/union-eyes`) | 1345 files passed, 4 failed, 13 skipped; 18,563 tests passed, 2 failed | See below. |
| `pnpm validate:docs` | PASS (0 errors) | |
| `pnpm governance:audit` | PASS (exit 0) | It rewrites tracked report files; those were reverted, not committed. |
| UE lint (`eslint`, apps/union-eyes) | PASS (0 errors, 2,886 warnings; not compared with baseline) | |
| Root `pnpm lint`, `pnpm typecheck`, `pnpm test:fast` (whole monorepo) | **NOT RUN** | Repo-wide; out of budget for this session. Only the union-eyes slices above were run. |
| PostgreSQL 15/16 RLS suites (`*.postgres.test.ts`) | **NOT PROVEN — environment** | Hook timed out starting a disposable container (Docker 29.2 present). Not an application result. |

Full-suite failures, none touching changed code: `apply-rls-foundation-migration.postgres.test.ts` and `p4-authority-state.postgres.test.ts` (Docker start timeout, above); `member-query-importers.test.ts` (synchronous whole-tree `readFileSync` scan exceeds its 120 s timeout on this host before reaching its assertion; the assertion concerns `organization-members-queries`, which this work does not import); `local-vault-fixture.test.ts` (timeout under load; **passed** when run alone). Six "failed to start forks worker" errors occurred while typecheck ran concurrently. The previously reported `cases-evidence` / `cases-export` failures (`@nzila/blob` link) no longer occur after full workspace dependency installation (both pass in the full run).

## 9. Connected supervisor journey — NOT_PROVEN

No progress on Journeys 1–8. Team Oversight, intake allocation by a supervisor, supervisor review/approval and governed handover all depend on the BLOCKED mandate store (section 5); implementing them against role level would recreate the universal-override defect. The only supervisory-adjacent behaviour that now exists and is tested is the metadata-only intake triage list, which does not require a mandate because it exposes no case content. No UI was added; it is not wired to a destination view. WorkAid: untouched, UNAVAILABLE.

## 10. Shared-agent integration status

| Shared file | Change | Needs |
| --- | --- | --- |
| `lib/services/document-governance-service.ts`, `document-authorization-service.ts` | Removed seniority input | Representation 2.2 agreement; it is the case-read policy. |
| `app/api/grievances/**`, `documents/**`, `search/universal`, `case-pattern-detection-service` | Seniority bypass removed | Same. |
| `lib/cases/case-authorization.ts` (claims) | **Unchanged** | Owner decision, section 3 item 1. |
| `app/api/cases/[caseId]/assign/route.ts`, `lib/audited-case-mutations.ts` | Transactional audit, idempotency | Rebase risk with Representation 2.2. |
| Member 2.1 | **Four files overlap** (corrected; originally recorded as none): `documents/repository/route.ts`, `documents/repository/[id]/route.ts`, `documents/[id]/download/route.ts`, `search/universal/route.ts`. Real merge conflicts, and a semantic regression risk if resolved toward Member (section 13). | Integration-owner resolution. |

## 11. Remaining blockers

**P0:** claims-path tenant-wide reads for senior roles; no same-organization case-level database boundary; exports/messaging/notification/signed-URL read paths unaudited; no HTTP-level proof on a running candidate.
**P1:** steward-gated writes without relationship checks (status, convert, priority-override); full handover workflow; protocol enforcement for filing/escalation and a rollout plan; independent protocol approver identity for single-administrator organizations; the mandate store and evaluator; root-level lint/typecheck/test:fast and PostgreSQL RLS suites on a working container host.

## 12. Verdicts

| Scope | Verdict |
| --- | --- |
| Local | **NO_GO** — P0 above open; fixes are TEST_PROVEN only. |
| Staging | **NO_GO** — no native acceptance; known runtime-isolation and operational-readiness blockers (file 25) remain open. |
| Production | **NO_GO**. |

## 13. Cross-persona ref inventory and overlap (read-only; added after review) — SOURCE_INSPECTED

Method: `git for-each-ref`, `git worktree list`, `git diff --name-only <merge-base> <tip>`, and in-memory `git merge-tree --write-tree` (no ref, index or worktree was modified; no other worktree was entered). All four persona branches are **local only**: `origin` has none of them (remote has no `agents/*` refs). No stashes.

| Persona | Branch (worktree) | Tip | Base | Files changed | Overlap with this branch | In-memory merge with this branch |
| --- | --- | --- | --- | --- | --- | --- |
| Senior Representative 2.1 | `agents/frozen-senior-representative-architecture` | `7df6ca85d` | `0c994b968` | 42 | — | — |
| Representative 2.2 | `agents/pasted-text-processing-7ac45129` | `571784d58` | `0c994b968` | 38 | 0 | Conflicts only in the four generated `tooling/repo-inventory/output` files (regenerate) |
| Member 2.1 | `agents/local-ue-navigation-validation` | `a9578d5e3` | `0c994b968` | 69 (3 commits) | **4** | **Content conflicts** in the document download/repository routes and `search/universal`, plus inventory files |
| Officer / Executive 2.1 | `agents/union-eyes-officer-executive-2-1-freeze` | `638817da2` | `0c994b968` | 51 | 0 | Clean |
| Financial Officer, Governance Officer | `agents/union-eyes-financial-officer-freeze`, `agents/frozen-governance-officer-21-architecture` | `0c994b968` | — | 0 | — | No work committed yet |
| WorkAid prep | `agents/workaid-prep-20261023` | `541effda5` | — | not analysed | — | Out of scope |

Uncommitted state in the other worktrees was **not** inspected, so "0 overlap" applies to committed work only.

### Findings that matter for integration

1. **A clean textual merge is not a safe merge.** Representative 2.2 and Officer/Executive merge cleanly with this branch, but both were cut from `0c994b968` and still carry the seniority-based case access that this branch removed (`isStewardPlus` is used in **12 non-test files** on each of them, against **2 here**, both being the deprecated, ignored optional field; the remaining 9 files here are tests that assert it is ignored). Any code they added that calls those paths inherits the bypass. Re-run the cross-case read tests (`grievance-read-scope.pglite.test.ts`, the `grievances-*` and `documents-*` route tests) on the merged result.
2. **Member 2.1 reintroduces the bypass through a new helper.** On the four overlapping files it replaces `hasCaseAccess: isStewardPlus || caseAccess.canViewCase || !row.linkedEntityId` with `hasDocumentContextAccess({ isStewardPlus, … })`, whose first line is `if (input.isStewardPlus || input.canViewCase) return true`. That returns `true` for **case-linked** documents for any steward+, restoring the disclosure this branch closed for the default-visible labels. Resolving the conflict "toward Member" would silently undo the fix. The Member change is otherwise valuable (non-staff scoping of unlinked documents and uploader-identity redaction) and should be kept. Suggested resolution, for the integration owner to decide: keep the helper and the redaction, but drop the `isStewardPlus` short-circuit for documents with a `linkedEntityId`; staff scope for *unlinked* organization documents remains a separate policy decision.
3. **Representative 2.2 builds on the open claims-path policy.** Its `workbench/assigned` and `workbench/assign` routes use `caseReadScope` / `findReadableCase`, and `workbench-projection.ts` and `members/directory-access.ts` are designed around `case_read_any`. So the unresolved P0-A (tenant-wide claim reads for chief steward and above) is not isolated to code this branch left alone — the 2.2 workbench actively depends on it. Changing it requires the integration owner to decide between a relationship-scoped read plus a metadata-only supervisory projection, and the existing 2.2 contract.
4. **The earlier statement that no concurrent persona work existed was incorrect** (cause: filtering `git branch` by persona-like names; the Representative 2.2 branch is `pasted-text-processing-7ac45129`). It is corrected above and in file 32. Conclusion unchanged: nothing was merged, rebased, or pushed, and no other agent's worktree was modified.

### Not done (needs the integration owner)

Merging, rebasing or cherry-picking any of these branches; deciding the consolidated case-read policy; the shared authority kernel / mandate store; and the unified verification campaign. This branch stays a candidate source, not an integration target.
