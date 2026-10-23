# UE_SENIOR_REPRESENTATIVE_2_1_CONVERGENCE_DISPOSITION

Mission: `UE-SENIOR-REP-2.1-CONVERGENCE`. Canonical authority: `UE-SENIOR-REPRESENTATIVE-CANONICAL-2.1 = FROZEN` (design decision; no release gate changed). Registered 2026-10-23.

**Release verdict: NO_GO.** This slice closes bounded P0 authority defects at `CODE_PROVEN` level only. Nothing here is `LOCAL_RUNTIME_PROVEN` or `NATIVE_STAGING_PROVEN`, and `UE_SAAS_OPERATIONAL_READINESS` is unchanged (file 25). Deployment authority: none. Phase 3B must not start.

## 1. Original checkout and dirty-state inventory

- Worktree: `C:/APPS/nzila-os.worktrees/frozen-senior-representative-architecture`, branch `agents/frozen-senior-representative-architecture`.
- Baseline HEAD: `0c994b968` (merge of PR #995, `fix/ue-global-experience-convergence`). Working tree was clean at start; no local-only commits.
- Other worktrees (not touched, not reused): `C:/APPS/nzila-os` (`main` @ `441556737`), `nzila-os-navigation` (`184319d6a`), `local-ue-navigation-validation` (`a9578d5e3`), `pasted-text-processing` (`541effda5`, WorkAid prep), `pasted-text-processing-7ac45129` (`0c994b968`), plus detached Codex worktrees. No reset, rebase, merge, cherry-pick or push was performed.
- Dependencies were restored in this worktree only (`pnpm install --frozen-lockfile --ignore-scripts`, filtered to `apps/union-eyes`, `packages/platform-auth`, `packages/db`) because `node_modules` was absent. No manifest or lockfile changed.

## 2. Files changed

Source: `lib/services/case-access-service.ts`, `app/api/grievances/[id]/access/route.ts`, `app/api/grievances/[id]/route.ts`, `components/grievances/grievance-detail-console.tsx`, `lib/audited-case-mutations.ts` (adds `CASE_ACCESS_DENIED`), `lib/representation/protocol-types.ts`, `lib/representation/protocol-service.ts`, `lib/representation/index.ts`, `lib/case-assignment-engine.ts`, `app/api/admin/representation-protocol/route.ts`, `components/admin/representation-protocol-editor.tsx`, `app/api/cases/[caseId]/assign/route.ts` (all under `apps/union-eyes/`).

Tests: `lib/services/case-access-service.test.ts`, `app/api/__tests__/grievances-access.route.test.ts`, `app/api/__tests__/admin-representation-protocol.route.test.ts`, `app/api/__tests__/cases-assign.route.test.ts`, `lib/__tests__/case-assignment-engine.test.ts`, new `lib/representation/__tests__/protocol-resolution.test.ts`.

## 3. Frozen navigation coverage

**Not changed and not qualified in this slice.** The seven Representative 2.2 destinations were not edited, no supervisory view (Team Oversight, Approvals, Exceptions) was added, and no eighth destination was introduced. No native browser session was run. Navigation disposition: `UNVERIFIED` — no claim.

## 4. SR01–SR22 capability-to-engine matrix

No capability is `OPERATIONAL`. Dispositions below are source-census based; none has native or runtime proof.

| ID | Disposition | Basis |
| --- | --- | --- |
| SR01 | BLOCKED | No supervisory mandate/delegation store exists (`db/schema` has no delegation, mandate or supervisory-grant table). Effective mandate cannot be evaluated. |
| SR02, SR03 | LIMITED | Role-gated `case_read_any` (level ≥ 2) reads; no scoped queue-oversight authority or intake-distribution workflow verified. |
| SR04 | LIMITED | `POST /api/cases/[caseId]/assign` persists assignment + staff note atomically; no acceptance, obligation carry-over or workload-balancing rules. |
| SR05, SR06, SR07 | BLOCKED | No independent approval workflow engine found for supervisory decisions; `case_assign`/`case_transition` are role-level checks, not delegated decisions. |
| SR08, SR09 | BLOCKED | `recusal_tracking` schema exists but is not wired into case access or assignment. Only the party-conflict check below is enforced. |
| SR10 | LIMITED | Deadline engine exists; file 25 records overdue processing as unproven. |
| SR11 | LIMITED | Primary-owner change revokes read scope implicitly (reads are scoped by `assignedTo`); successor acceptance, obligation and communication transfer are not implemented. |
| SR12 | LIMITED → improved | Case-access grants now require case-management authority (section 6). Sealed/medical document grants are unchanged. |
| SR13, SR15, SR16, SR17, SR18, SR19, SR20, SR21 | BLOCKED | No supervisory engine, route or persistence verified in this slice. |
| SR14 | UNAVAILABLE | No WorkAid referral code exists in `app/api`, `lib` or `db/schema`. The WorkAid prep branch was not imported. No Clio/WSIB integration was fabricated. |
| SR22 | UNVERIFIED | Not exercised. The one UI change adds an English-only alert in `grievance-detail-console.tsx`, which is already English-only there; EN/FR parity is not established. |

## 5. Five-power supervisory authorization matrix

| Power | Current state | Disposition |
| --- | --- | --- |
| Queue oversight | `case_read_any` is granted to `chief_steward`/`business_agent` and above by role level in `lib/action-enforcer.ts`; scope is whole-organization. | BLOCKED — role-bundled, not independent. |
| Assignment | `case_assign` has the same role level (≥ 2). | BLOCKED — role-bundled; no delegation. |
| Case review | Case-access grants, now primary-owner only. No supervisory case-review mandate. | LIMITED |
| Decision approval | None. | BLOCKED |
| Restricted-information | Private/sealed document access needs `canViewPrivateDocuments`, an explicit document grant, or primary ownership. | LIMITED — see residual defect below. |

The matrix in `lib/action-enforcer.ts` and `lib/cases/case-permissions.ts` is the shared Representative 2.2 authorization source. It was deliberately **not** modified (P0-F). Separating the five powers requires a mandate/delegation store (migration + RLS census entry), which is a schema decision for the integration owner.

## 6. P0 exploit reproductions, remediations and negative tests

### P0-B — Collaborator-grant administration (CONFIRMED and remediated, CODE_PROVEN)

Reproduction (from source and the pre-change policy, now captured as negative tests): `canManageAccess()` returned `true` for any `hasMinRole('steward')` caller. A steward with no relationship to a grievance could `POST /api/grievances/{id}/access` with their own user id and `canViewPrivateDocuments: true`. `isDocumentVisibleByPolicy` then released `privileged`/`highly_sensitive` documents to that user. The same steward+ check also exposed `PATCH` (revoke/re-activate any grant) and `GET` (grant roster) for any case, and `GET /api/grievances/[id]` told the UI to show management controls to every steward. Grantee eligibility, grievance existence in the organization, expiry and scope were not validated. `PATCH` could re-activate a revoked grant without re-validation. `GET` resolved the primary owner without an organization filter.

Remediation:
- Grant and revoke require the **primary owner of that specific case**, enforced in the service (`grantCaseAccessGuarded`, `revokeCaseAccessGuarded`), not only in the route.
- Grantee must be an active representative in the organization, reusing the existing `caseAssigneeEligible` predicate (no second eligibility implementation). Self-grant and owner-as-grantee are rejected.
- Reviewer/read-only grants and any private-document grant must expire (max 365 days); only `secondary_lro` may carry edit/draft/upload rights.
- `PATCH` accepts `revoked` only. `GET` requires a real case relationship and no longer reports `canManageAssignments` from role seniority. The owner lookup is organization-scoped.
- Denials are audited as `case.access_denied`. The UI now sends an expiry, no longer grants reviewers upload rights, and surfaces failures instead of silently ignoring them.

Negative tests: `lib/services/case-access-service.test.ts` (non-owner steward writes nothing; cross-org/missing case → 404; self-grant; ineligible grantee; expiry and scope terms; non-owner and wrong-case revoke) and `app/api/__tests__/grievances-access.route.test.ts` (steward+ without relationship denied on GET/POST/PATCH; re-activation rejected; malformed JSON → 400).

**Not removed:** the primary owner's legitimate grant/revoke control is unchanged. There is no approved replacement path for non-owner supervisors; a supervisor needing review access must obtain it from the owner, or via assignment. A supervisory review mandate is BLOCKED pending a delegation store.

**Residual, not fixed here (Representative 2.2 ownership, P0-F):** `GET /api/grievances/[id]` still lets any steward+ read any grievance in the organization (`isStewardPlus`), and `isDocumentVisibleByPolicy` treats steward+ as having case access. This is the queue-confidentiality boundary and must be resolved together with the Representative 2.2 agent. Until then, case-content disclosure to unrelated stewards is not contained.

### P0-C — Representation protocol authority (CONFIRMED and remediated, CODE_PROVEN)

Finding: `getRepresentationProtocol()` silently returned `PROTOCOL_STEWARD_LED` for a missing row, and cast any stored JSON without validation. `autoAssignGrievance` consumed that value to decide who may represent members, so a CAPE-style organization with no row (or a malformed row) silently got steward-led authority.

Remediation:
- `resolveStoredProtocol` validates structure and provenance and returns an explicit status: `approved`, `pending_approval`, `missing` or `invalid`. Only `approved` is `executable`.
- Approval must be recorded by an administrator different from the author. Any save clears prior approval, so approval always refers to the stored value. Client-supplied `approval` is stripped.
- `autoAssignGrievance` fails closed and writes nothing unless the protocol is executable. `getRepresentationProtocol()` is documented display-only. `GET /api/admin/representation-protocol` returns `execution` alongside the display protocol, a new `POST` records independent approval, and the editor distinguishes a display default from an approved protocol.
- Existing configurations created before this change have no provenance and become `invalid` until re-saved and approved. **This is an intentional behaviour change that an owner must schedule.**

Tests: `lib/representation/__tests__/protocol-resolution.test.ts`, `lib/__tests__/case-assignment-engine.test.ts` (missing/invalid/pending write nothing), `app/api/__tests__/admin-representation-protocol.route.test.ts`.

**Not solved:** the `manuallyAssignGrievance` and `reassignGrievance` engine paths and the claims assign route do not consult the protocol. A single-administrator organization cannot approve its own protocol. Whether this should be an exception for small locals is a governance decision.

### P0-D — Assignment consistency (PARTIAL, CODE_PROVEN)

The claims assign route is authoritative for claims; grievances use `unionRepId` and case-access grants. The two models have not converged, and no shared transfer workflow exists.

Added to `POST /api/cases/[caseId]/assign`: case parties cannot assign or receive their own case (403, audited); an unchanged assignee returns 409 rather than a transfer; if the audit write fails after commit the response is an explicit `ASSIGNMENT_COMMITTED_AUDIT_FAILED` (500, no `success`), not a clean success. Tests in `cases-assign.route.test.ts`.

Not implemented: successor acceptance, obligation/deadline/communication carry-over, document-grant revocation for the outgoing owner, and a member-visible update. Transfer is **not** reported as complete handover anywhere; SR11 stays LIMITED.

### P0-E — Sensitive and conflicted matters

Only the party-conflict case above and the grant-authority cases are covered. Supervisor medical-evidence access, counsel-restricted matters, a complaint about the supervisor, recusal, expired delegation, multi-affiliation crossing and stale-session/cached-link behavior were **not** tested. No disclosure was confirmed or contained beyond the residual noted under P0-B.

## 7. Connected supervisory journey (sections 4–5 of the mission)

**Not executed.** No local runtime with persistent synthetic data was run for this mission, and the supervisory workflow (intake allocation, approval, exception intervention, continuity, audit reload) is not implemented. No before/after persistence evidence exists. Organizational scenarios (CAPE, CUPE local/regional/national, LIUNA-style, small local, health and safety) were **not** exercised end to end; only the protocol resolver was unit-tested with CAPE LRO-led, CUPE national-rep-led and steward-led approved fixtures.

## 8. WorkAid authority and integration

No WorkAid code was imported or created. Referral states, institutional authorization and disclosure permission remain UNAVAILABLE. No Clio, WSIB or WSIAT integration exists or was simulated.

## 9. Member-visible outcomes and confidentiality

No member-facing projection or notification was changed. The assignment note remains `isInternal: true`, `visibilityScope: 'staff'`. No confidentiality proof beyond that exists for supervisory decisions, because no supervisory decision workflow exists.

## 10. EN/FR, responsive and accessibility

Not qualified. The new UI strings are English only, consistent with the surrounding components. New alerts use `role="alert"`/`role="status"`. No keyboard, screen-reader, mobile or French verification was performed.

## 11. Shared-file dependencies

- **Representation 2.2:** `lib/action-enforcer.ts`, `lib/cases/case-permissions.ts`, `lib/cases/case-authorization.ts` (unchanged), and the steward+ read path in `app/api/grievances/[id]/route.ts` and `lib/services/document-governance-service.ts`. `app/api/cases/[caseId]/assign/route.ts` and `lib/audited-case-mutations.ts` were edited with additive changes. Rebase or merge conflicts are possible and must be resolved by the integration owner.
- **Member 2.1:** no shared file was edited.
- **Schema/RLS:** a mandate/delegation table needs a migration and an RLS storage-authority census entry (`db/rls-storage-authority`). Not started.

## 12. Validation executed

All run from `apps/union-eyes` on this worktree, targeted only:

- `pnpm exec vitest run` on the changed test files plus related suites (`lib/representation`, `lib/__tests__/representation-protocol.test.ts`, `case-assignment-engine`, `workflow-automation-engine`, `hooks/__tests__/use-representation-protocol.test.ts`, `app/api/__tests__/grievances*`, `cases-assign`, `lib/cases`, `db/auth/case-assignee-predicate.pglite.test.ts`): passing.
- `pnpm exec tsc --noEmit -p .`: 0 errors.
- Required pre-review gates (`pnpm lint`, `pnpm typecheck`, `pnpm test:fast`, `pnpm validate:docs`, `pnpm governance:audit`) are the integration owner's responsibility and are **not** claimed as run here.

## 13. Remaining blockers and owners

| Blocker | Owner |
| --- | --- |
| Mandate/delegation store and independent five-power evaluator (SR01, SR05–SR07, SR13–SR21) | Senior Representative 2.1 + platform schema owner |
| Steward+ organization-wide case and document read (queue confidentiality) | Representative 2.2 |
| Transfer workflow: acceptance, obligations, grant revocation, member projection | Senior Representative 2.1, coordinated with Representative 2.2 |
| Recusal/conflict wiring and restricted-matter tests (P0-E) | Senior Representative 2.1 |
| Protocol consumption by manual/reassign/claims paths; re-approval of existing organizations; small-local approval policy | Senior Representative 2.1 + governance owner |
| Native browser, EN/FR, responsive, accessibility and connected-journey proof | Staging acceptance owner |
| WorkAid referral boundary | WorkAid agent/owner (outside this branch) |
| Runtime isolation and operational readiness (file 25) | Existing staging programme |

## 14. Verdict

`CODE_PROVEN`: P0-B grant authority, P0-C protocol fail-closed behaviour, and the three P0-D assignment guards listed above.
`LOCAL_RUNTIME_PROVEN`: none.
`NATIVE_STAGING_PROVEN`: none.

Release verdict: **NO_GO**. The Chief Steward / Senior LRO experience is **not** implemented or certified.
