# UE_REPRESENTATIVE_2_2_CONVERGENCE_DISPOSITION

**Mission:** UE-REP-2.2-CONVERGENCE · **Canonical authority:** UE-REPRESENTATIVE-CANONICAL-2.2 (FROZEN)
**Executed:** Slices 1–2 and the authorization-convergence and mandate-lifecycle parts of the continuation.
**Not executed:** the connected journey on a real database, institutional scenario proofs against deployed state,
native browser / mobile / EN-FR acceptance, WorkAid (nothing exists to integrate).

**Operational disposition:** NOT QUALIFIED. **Staging / production:** NO-GO.
`UE_SAAS_OPERATIONAL_READINESS` stays `NO_GO — RUNTIME_PROOF_REQUIRED`. Phase 3B was not started.
Nothing below is deployed-staging proof.

## How to read the evidence levels

| Level | Meaning | Counts as "proven"? |
| --- | --- | --- |
| U | Unit / route test with mocked persistence | No |
| P | Executed against PostgreSQL semantics in-process (PGlite) | No — SQL logic only, no RLS role, no deployed schema |
| R | Real runtime: deployed database/RLS, real auth, native browser | **None exists for any item** |

Classifications used below: **IMPLEMENTED-UNVERIFIED** (code + U/P evidence, no runtime proof), **MISSING**, **BLOCKED**,
**NOT EXAMINED**. No item is classified as implemented-and-proven because no item has level-R evidence.

## 1. Source baseline

| Item | Value |
| --- | --- |
| Worktree | `C:/APPS/nzila-os.worktrees/pasted-text-processing-7ac45129` (isolated) |
| Branch | `agents/pasted-text-processing-7ac45129` |
| Original SHA | `0c994b968aed0657cca5b702954ba87252408245` |
| Commits | `571784d58` (navigation + first authorization pass) · `b9828f29c` (authorization convergence) |
| Other worktrees | Read-only inspection only; nothing in them was edited, reset, rebased or merged |

## 2. Integration with concurrent persona work (Member 2.1)

Member 2.1 lives at `C:/APPS/nzila-os.worktrees/local-ue-navigation-validation` (HEAD `a9578d5e3`, 48 uncommitted files at
inspection time). Merge base with this branch is `0c994b968`. Nothing was merged or copied.

**Files edited by both sides (textual conflicts expected, semantics separable):**

| File(s) | This branch's change | Integration note |
| --- | --- | --- |
| `lib/dashboard/role-experience.ts`, its tests, `components/__tests__/sidebar.test.tsx`, `e2e/helpers/role-fixtures.ts`, `lib/dashboard/__tests__/dual-nav-honesty.test.ts` | Staff navigation replaced by the seven destinations; `/dashboard/clause-library` added to staff prefixes | Keep Member's member-nav changes; apply the staff block verbatim |
| `messages/{en,en-CA,fr,fr-CA,it,pt}.json` | New keys: 7 nav labels (`experienceNavigation`), `workbench.restrictedMember`, `restrictedMatterNotice`, `assignDenied` | Pure key additions; union the key sets |
| `app/api/documents/[id]/download/route.ts`, `documents/repository/route.ts`, `documents/repository/[id]/route.ts`, `search/universal/route.ts` | One-line change per file: `isStewardPlus = await hasMinRole('steward')` → `await hasSupervisoryCaseRead(organizationId, userId)` plus the import | Re-apply after taking Member's document-visibility changes. The helper is in `lib/cases/supervisory-case-read.ts` (new file, no conflict) |

**Member-owned files this branch deliberately did NOT edit, with required follow-ups:**

* `app/api/cases/[caseId]/transition/route.ts` — **open P0-F leak (see §4, F2).** Needs the change below applied inside Member's version.
* `lib/cases/case-authorization.ts`, `claim-detail-query.ts`, `transition-history.ts` — all new authorization here is in new files
  (`supervisory-case-read.ts`, `grievance-list-scope.ts`, `grievance-transition-authority.ts`, `creator-access.ts`,
  `note-visibility.ts`, `workbench-projection.ts`, `members/directory-access.ts`) that only import existing exports.

## 3. Navigation (Slice 1)

Seven destinations for staff, each mapped to an existing route; no new pages. Legacy routes remain reachable by deep link;
Workspace stays reachable through the role-home hub cue. Knowledge & Guidance is hidden below steward level.

| # | Destination | Route | Classification |
| --- | --- | --- | --- |
| 1 | Today | `/dashboard/inbox` | IMPLEMENTED-UNVERIFIED — shared inbox; not a verified workload/priority view |
| 2 | Representation | `/dashboard/workbench` | IMPLEMENTED-UNVERIFIED — queue is now actor-scoped (U, P) |
| 3 | Members & Workplaces | `/dashboard/members` | IMPLEMENTED-UNVERIFIED — directory policy-scoped (U); no workplace/worksite engine (MISSING) |
| 4 | Communications | `/dashboard/correspondence` | IMPLEMENTED-UNVERIFIED — fails closed (U); thread grants MISSING |
| 5 | Documents & Evidence | `/dashboard/documents` | IMPLEMENTED-UNVERIFIED — visibility bypass removed on identified routes (U); provenance/legal hold NOT EXAMINED |
| 6 | Tasks & Deadlines | `/dashboard/priorities` | IMPLEMENTED-UNVERIFIED — deadline engine is `LIMITED` in the capability registry |
| 7 | Knowledge & Guidance | `/dashboard/clause-library` | IMPLEMENTED-UNVERIFIED — clause lookup only; no governed advisory AI |

## 4. P0 findings: reproduced at source, repaired, evidence

| Id | Finding | Repair | Evidence |
| --- | --- | --- | --- |
| P0-A | `GET /api/workbench/assigned` trusted a client `organizationId` (absent = all tenants) and returned member PII to any steward | Server-derived actor/org; mismatching `organizationId` → 403; `caseReadScope`; triage-only projection without case-resource authority | U |
| P0-A2 | `POST /api/workbench/assign` updated any claim by id across tenants, no policy, no assignee check | `case_assign` policy, read scope, assignee eligibility, RLS transaction, audit | U |
| P0-B | Steward and legacy aliases held `VIEW_ALL_CLAIMS`/`EDIT_ALL_CLAIMS`/`ASSIGN_CLAIMS` | Removed. **Regression check done:** repo-wide search found no code consumer outside `roles.ts` itself (only the `/admin/claims` route map and one admin nav entry, both admin-gated), so no workflow depended on them. Chief steward retains `ASSIGN_CLAIMS` | U |
| P0-B2 | **New.** Seven grievance/document/search routes used `hasMinRole('steward')` as a case-access bypass, so any steward read every grievance, its events, collaborators and every non-privileged document (including `lro_confidential`, `case_restricted`) in the organization | Replaced by `hasSupervisoryCaseRead` (`case_read_any`, i.e. chief steward and above) in `grievances/[id]`, `documents`, `related-documents`, `intelligence`, `access`, `documents/repository`(+`[id]`), `documents/[id]/download`, `search/universal` | U; document policy matrix U |
| P0-B3 | **New.** `GET /api/grievances` returned full rows (grievant name/email, description, confidentiality flags) for the whole organization to any steward | Case rows only for matters the actor created-while-assigned, owns, or is actively delegated; unassigned draft intakes as minimum metadata with `access:'triage'`; supervisory sees the queue | **P** (`grievance-list-scope.pglite.test.ts`) + U |
| P0-B4 | **New.** `PATCH /api/grievances/[id]/status` let any steward advance any grievance (the FSM checks role level only) | `canTransitionGrievance`: supervisory, primary owner, active `secondary_lro`, or disposition of an unassigned intake; denial audited | U |
| P0-B5 | **New.** `/api/grievances/[id]/access` let any steward grant anyone (incl. `canViewPrivateDocuments`) access to any grievance, never validated the grantee or the grievance's organization, and read `grievances` without an org filter | Delegation needs supervisory authority or primary ownership; grantee must be an active member of the organization; grievance must belong to it; org filter added | U |
| P0-B6 | **New.** `GET /api/claims/[id]/evidence` fell back to an organization-unscoped lookup and returned all claim updates (internal/admin/system) to any steward | Canonical pattern: `getCaseActor` + `findReadableCase` + `caseHistoryVisibility`; staff-only | U |
| P0-B7 | **New.** `POST /api/workflow/transition` fell back to an organization-unscoped `SELECT … FOR UPDATE` and had no assignment check | Always `caseReadScope(actor)` + `case_transition` policy; no organization fallback | U |
| P0-B8 | **New.** "Steward workload" card aggregated the whole organization | Actor-scoped unless supervisory | U |
| P0-C | `/api/members` was `minRole:'member'`; org-members routes returned the whole org to any steward | `directory-access.ts` policy applied to all three routes (see previous record) | U |
| P0-D | Correspondence `"default"` tenant fallback; read failure shown as empty queue | Fail closed; error + retry in UI | U |
| P0-E | Mandate lifecycle | See §5 | **P** |
| P0-F1 | **New.** A steward's working note posted from the workbench was saved **member-visible** (UI omits `isInternal`, server defaulted it to `false`) | Representative-authored notes default to staff-only; member visibility must be chosen explicitly | U |
| **P0-F2** | **OPEN.** `PATCH /api/cases/[caseId]/transition` writes a member-visible `status_change` whose `message` and `metadata` embed the representative's free-text `reason` | **Not repaired — the file is under concurrent edit by Member 2.1.** Required change: member-visible event carries only from/to status; write a second `claim_updates` row with `isInternal:true`, `visibilityScope:'staff'` holding the reason; remove `reason` from the member-visible `metadata`. Needs a test asserting `caseHistoryVisibility(member)` excludes the reason | — |

## 5. P0-E mandate lifecycle (PGlite)

`case-mandate-changes.pglite.test.ts` and `grievance-list-scope.pglite.test.ts` execute the real scope predicates against
PostgreSQL semantics:

| Scenario | Result |
| --- | --- |
| Reassignment `claims.assigned_to` A→B | A loses read immediately, B gains it |
| Representative demoted to member | Assignment-based access removed; own filed case remains |
| Same user id in another organization (multi-affiliation) | No access, including as chief steward |
| No assignee | Unreadable to stewards (absence of assignment grants nothing) |
| Collaborator assignment revoked / expired | Access ends on the next read (no cache layer in this path) |
| Representative created a grievance then it is reassigned | Creator access ends (`creator-access.ts`); a member-filer keeps their own view |

Role resolution (`getUserRoleInOrganization`) reads the active, non-deleted membership per request, so suspension or
removal revokes on the next request — **source-reviewed, not executed against a database here.**

**Not covered (MISSING):** recusal / conflict-of-interest, territory mandates (business agent, LIUNA), privileged-matter
restriction against supervisory readers, temporary delegation with effective dates, substitute coverage, successor
authorization. Chief steward and above still read every case in the organization (`caseReadScope`), and a business
agent's territory implies the same. Registered as `UE-REP-MANDATE-RECUSAL-DELEGATION` (`NOT_IMPLEMENTED`). Building this
requires a schema decision and stakeholder-validated policy per operating model; it was not simulated.

Also not examined: stale notification content and cached direct links after a mandate change.

## 6. Action-by-action proof matrix

All rows: no level-R evidence → none is "implemented-and-proven".

| # | Representative action | Server enforcement | Evidence | Classification |
| --- | --- | --- | --- | --- |
| 1 | See actor-scoped case queue | `caseReadScope` + projection | U, P | IMPLEMENTED-UNVERIFIED |
| 2 | See unassigned-intake triage metadata (grievances) | `grievanceTriageScope` | P, U | IMPLEMENTED-UNVERIFIED |
| 3 | Open grievance detail, events, documents, intelligence | supervisory / owner / collaborator / creator rule | U, P | IMPLEMENTED-UNVERIFIED |
| 4 | Assign case (workbench, cases) | `case_assign` + eligibility + audit | U (cases route has pre-existing PGlite predicate test) | IMPLEMENTED-UNVERIFIED |
| 5 | Self-assign | Not offered unless `case_assign`; intake conversion still makes the converter the owner | U | IMPLEMENTED-UNVERIFIED — protocol needs stakeholder validation per operating model |
| 6 | Add note (internal / member-visible) | `note_add_internal`; default internal | U | IMPLEMENTED-UNVERIFIED |
| 7 | Advance claim state | `case_transition` + read scope (`workflow/transition`); `cases/[id]/transition` (Member-owned) | U | IMPLEMENTED-UNVERIFIED; reason leak OPEN |
| 8 | Advance grievance state | matter authority + FSM | U | IMPLEMENTED-UNVERIFIED |
| 9 | Delegate / revoke collaborator access | supervisory or owner; grantee + org validation; audit | U | IMPLEMENTED-UNVERIFIED |
| 10 | Member directory lookup | `directory-access` policy | U | IMPLEMENTED-UNVERIFIED |
| 11 | Member profile detail, linked cases | not examined beyond directory list | — | NOT EXAMINED |
| 12 | Correspondence list / draft | org required, fail closed | U | IMPLEMENTED-UNVERIFIED |
| 13 | Correspondence approve / dispatch / delivery / receipt as distinct states | not examined | — | NOT EXAMINED |
| 14 | Correspondence thread participants / matter grants | no model | — | MISSING |
| 15 | Document list / download / search | label policy with supervisory flag | U | IMPLEMENTED-UNVERIFIED |
| 16 | Evidence export (claims) | readable case + visibility filter | U | IMPLEMENTED-UNVERIFIED |
| 17 | Evidence provenance, legal hold, retention | not examined | — | NOT EXAMINED |
| 18 | Tasks / deadlines / reminders / handover | registry: `LIMITED` | — | NOT EXAMINED here |
| 19 | Escalate to formal grievance | `case_transition` + read scope (existing) | existing tests | NOT RE-EXAMINED |
| 20 | Request senior review / authorize / record rationale | no distinct approval record found | — | MISSING |
| 21 | Resolution, closure, transfer with continuity | transition + assignment; handover per registry `LIMITED` | — | NOT EXAMINED end to end |
| 22 | Recusal, territory, privileged-matter, delegation | no model | — | MISSING |
| 23 | Member-visible projection of steward actions | notes fixed; transition reason leak OPEN | U | PARTIAL |
| 24 | WorkAid referral, acknowledgement, milestones | no code | — | MISSING (registered `NOT_IMPLEMENTED`, non-blocking) |
| 25 | EN/FR copy, mobile, accessibility, native browser | catalogs updated; nothing rendered | — | NOT EXECUTED |

## 7. R01–R24

None is OPERATIONAL. Touched domains are IMPLEMENTED-UNVERIFIED as above. R03–R06 (intake, assessment, triage, escalation) are
reached only through existing routes not re-examined; R10, R16, R17, R19–R24 are not examined; R18 is MISSING.

## 8. Institutional scenarios

Not executed. The policy layer distinguishes steward (level 1), chief steward / business agent (level 2, `case_assign`,
`case_read_any`), officer (3) and admin (4) but has no territory, bargaining-unit or operating-model configuration, so
CAPE LRO-led assignment, CUPE regional/National assistance, LIUNA territory denial and the small-local dual-mandate case
cannot be represented, let alone tested. Where the governing protocol is unknown it is left as a stakeholder-validation item.

## 9. WorkAid

No WorkAid, WSIB/WSIAT or Clio code exists in the app; no UI presents specialist progress. The WorkAid v0.3 contracts on
`agents/workaid-prep-20261023` were not imported. Prerequisites before any live progress is shown are recorded in
`UE-WORKAID-SPECIALIST-REFERRAL` (operational connector, referral authorization and member consent, secure transmission with
actual acknowledgement, acceptance or rejection, purpose-limited document exchange, revocation and closure; direct
engagement must not be visible by union membership alone).

## 10. Verification run

* Typecheck: `tsc --noEmit` exit 0, no diagnostics (10 GB heap).
* ESLint on changed areas: 0 errors (warnings are pre-existing `any`).
* Vitest: `lib`, `app/api`, `components` and the remaining source areas pass. Four suites were load-sensitive and pass in
  isolation: `static-priority-smoke` (calendar-sync), `member-query-importers`, and the two `*.postgres.test.ts` scripts.
  A single whole-package `vitest run` crashed the worker process (native exit), so the package was run in chunks.
* `pnpm validate:docs` exit 0 (re-run for this record). The full `pnpm lint`, `pnpm test:fast` and
  `pnpm governance:audit` gates were not run.

## 11. Blockers and next actions

1. **P0-F2 transition-reason leak** — apply the change in §4 inside Member 2.1's transition route.
2. **Mandate model** — recusal, territory, privileged-matter, delegation, succession: schema decision + policy sign-off.
3. **Runtime proof** — real PostgreSQL with the runtime role and RLS, Entra auth, and a native browser pass (desktop, mobile,
   EN/FR, keyboard/screen reader) on the exact candidate, with before/after data and audit rows.
4. **Correspondence** — thread participants/grants and distinct draft/approval/dispatch/delivery/receipt states.
5. **Senior review** — an approval record distinct from recommendation.
6. **Intake classification** — distinguish inquiry, request, accepted case, formal grievance; decide per operating model who may
   self-assign by converting an intake.
7. **Documents** — provenance, retention, legal hold; recheck after integrating Member 2.1's document work.
8. Integrate with Member 2.1 per §2 before any promotion.

## 12. Commit inventory

`571784d58`, `b9828f29c` on `agents/pasted-text-processing-7ac45129`; working tree clean after the record commit.
**Staging readiness: NO-GO.**
