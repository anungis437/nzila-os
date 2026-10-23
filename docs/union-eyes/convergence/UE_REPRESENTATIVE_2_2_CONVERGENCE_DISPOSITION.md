# UE_REPRESENTATIVE_2_2_CONVERGENCE_DISPOSITION

**Mission:** UE-REP-2.2-CONVERGENCE · **Canonical authority:** UE-REPRESENTATIVE-CANONICAL-2.2 (FROZEN)
**Scope of this record:** Slices 1–2 (navigation, P0 authorization boundaries). Slices 3–5 not executed.

**Operational disposition:** NOT QUALIFIED. **Staging / production:** NO-GO. Nothing here is deployed-staging
proof; evidence is unit/route-level with mocked persistence only. `UE_SAAS_OPERATIONAL_READINESS` stays `NO_GO`
(file 25 §6 runtime proof queue untouched). Phase 3B was not started.

## 1. Source baseline

| Item | Value |
| --- | --- |
| Worktree | `C:/APPS/nzila-os.worktrees/pasted-text-processing-7ac45129` (isolated, clean at start) |
| Branch | `agents/pasted-text-processing-7ac45129` |
| Original SHA | `0c994b968aed0657cca5b702954ba87252408245` |
| Other worktrees | Not touched (Member 2.1 and other agents' checkouts were not read, edited, rebased or merged) |

## 2. Navigation (Slice 1) — steward / staff experience

Seven destinations, each mapped to an existing route (no new pages, no fabricated function). Profile & Settings stays a
secondary Settings-group entry. Legacy routes (`/dashboard/workspace`, `/dashboard/inbox?type=intake`,
`/dashboard/notifications`, `/dashboard/intelligence`) remain reachable by deep link; Workspace stays reachable through the
role-home hub cue.

| # | Destination | Route | Backing page | Disposition |
| --- | --- | --- | --- | --- |
| 1 | Today | `/dashboard/inbox` | shared inbox page | LIMITED — unified inbox, not a verified workload/priority view |
| 2 | Representation | `/dashboard/workbench` | workbench console (role home) | LIMITED — queue now actor-scoped (§3); lifecycle actions not runtime-proven |
| 3 | Members & Workplaces | `/dashboard/members` | members console | LIMITED — directory now policy-scoped (§3); no workplace/worksite engine |
| 4 | Communications | `/dashboard/correspondence` | correspondence dashboard | LIMITED — fails closed (§3); draft/approve/dispatch/receipt states not proven distinct end to end |
| 5 | Documents & Evidence | `/dashboard/documents` | documents page | LIMITED — not reviewed this slice; provenance/legal-hold unverified |
| 6 | Tasks & Deadlines | `/dashboard/priorities` | priorities console | LIMITED — deadline engine is `LIMITED` in the capability registry |
| 7 | Knowledge & Guidance | `/dashboard/clause-library` | clause library (steward-gated) | LIMITED — agreement/clause lookup only; no governed advisory AI, precedent link not in nav |

Role gate: Knowledge & Guidance is hidden below steward level, matching the page guard (`hasMinRole('steward')`).
Not done: member/executive/governance/admin navigation was intentionally unchanged.

## 3. P0 findings

| Id | Finding (reproduced at source) | Repair | Evidence |
| --- | --- | --- | --- |
| P0-A | `GET /api/workbench/assigned` used an optional client `organizationId` as its only scope (none → every tenant), returned `member_name/email/phone`, narrative, witnesses, attachments to any steward. | Actor/org/role derived server-side (`getCaseActor`); mismatching `organizationId` → 403; rows limited by `caseReadScope`; matters without case-resource authority (not assigned to / filed by actor) are reduced to triage metadata (`lib/cases/workbench-projection.ts`); response carries server-derived `capabilities.canAssign`. | `workbench-authorization.route.test.ts`, `workbench-projection.test.ts` |
| P0-A2 | `POST /api/workbench/assign` updated any claim by id across tenants, no `case_assign` policy, no assignee check, steward could self-assign. | Same `case_assign` policy, read scope, assignee eligibility, RLS transaction, audit with authenticated org as `/api/cases/[id]/assign`. | same test file |
| P0-A3 | Workbench UI offered "Assign to me" to every steward and swallowed assignment failures. | Button gated on `capabilities.canAssign`; denial shown; triage rows render a restricted notice with no contact data. | `workbench-console.test.tsx` |
| P0-B | Legacy `ROLE_PERMISSIONS` gave steward (and `union_rep`/`staff_rep`) `VIEW_ALL_CLAIMS`, `EDIT_ALL_CLAIMS`, `ASSIGN_CLAIMS`, contradicting `action-enforcer` (`case_assign` = level 2). | Removed from steward, `union_rep` (view/edit), `staff_rep` (view). Chief steward keeps `ASSIGN_CLAIMS`. No app route consumed these grants directly. | `roles.test.ts`, `role-access-flows.test.ts`, `permissions.test.ts` |
| P0-C | `GET /api/members` was `minRole: 'member'`: any member could list the org directory (email, phone, hire date, seniority, metadata) and cross organizations by membership. `/api/organization/members` and `/search` returned the whole org to any steward. | `lib/members/directory-access.ts`: member → denied; steward → self + members of claims assigned to them; chief steward/business agent → org directory without sensitive attributes; officer+ → full; only platform admins cross organizations. Applied to all three routes. | `members-directory-authorization.route.test.ts`, `organization-members*.route.test.ts` |
| P0-D | Correspondence page fell back to `organizationId = "default"`; `GET /api/correspondence` turned any read failure into an empty list; handlers used `organizationId!`. Dashboard client also showed failure as an empty queue. | Page redirects without an organization; API requires org/actor (403) and surfaces read failure as an error; client shows an alert with retry. | `correspondence-fail-closed.route.test.ts` |
| P0-E | Mandate revocation, reassignment, multi-affiliation, delegation, recusal, stale links/caches/notifications | **Not addressed — no engine verified.** | — |
| P0-F | Member-facing projections of steward operations | **Not addressed**; coordination with Member 2.1 not performed. | — |

## 4. Unresolved security / runtime blockers

* **Thread-level messaging and correspondence authorization is not implemented.** Correspondence listing is still
  organization-wide for any steward-level actor; only the failure/tenant-fallback defects were fixed.
* **Document/evidence access (P0-C documents) not reviewed.** Restricted/privileged document exposure by staff-level role is unverified.
* `bargaining/page.tsx` and `committees/[id]/page.tsx` carry the same `organizationId || "default"` fallback; out of the seven destinations, left untouched.
* Case-level reads for `case_read_any` roles (chief steward, business agent) are still organization-wide in `caseReadScope`; there is no
  territory, privileged-matter, conflict/recusal or delegation model to enforce the contract's mandate rules (§VI). Triage-only projection in the
  workbench is a mitigation, not that model.
* Multi-affiliated users can no longer read another organization's directory through `?organizationId=`; they must act in the active organization.
* Steward triage for unassigned intake has no delegation grant to key off, so stewards currently see only assigned/own matters.
* No database/RLS execution, browser, EN/FR visual, or mobile acceptance was run. Message catalogs gained keys in all six locales;
  `it`/`pt` wording is unreviewed translation.
* Full-suite timeout issues remain recorded qualification blockers; some heavy tests (`calendar-sync` smoke, `member-query-importers`) time out under parallel load and pass in isolation.

## 5. Not executed (Slices 3–5)

Journeys A–G, institutional scenario proofs (CAPE / CUPE / LIUNA / small local / specialist), WorkAid contextual boundary,
native browser acceptance with before/after data, and exact-candidate release evidence. WorkAid: **no integration exists in this
change; no live progress is shown or implied; no Clio/WSIB/WSIAT record is created.**

## 6. R01–R24 capability-to-engine matrix (this slice)

Only the domains touched are classified; the rest are `UNAVAILABLE` or unverified until their engines are examined.
OPERATIONAL requires runtime evidence — none exists, so no domain is classified OPERATIONAL.

| Domain | Disposition | Note |
| --- | --- | --- |
| R01 identity/mandates | LIMITED | role → policy role via `casePolicyRole`; no mandate/territory/delegation model |
| R02 daily workload | LIMITED | inbox/workbench queue actor-scoped; priority sources unverified |
| R07/R08 case lifecycle, assignment | LIMITED | `case_assign` policy now enforced on both assign routes; transfer/substitute not examined |
| R09 member relationships | LIMITED | case-context directory scoping |
| R11/R12 communications | LIMITED | tenant fallback removed, failure truthful; no thread grants |
| R13 evidence/records | UNAVAILABLE (unverified) | not reviewed |
| R14 tasks/deadlines | LIMITED | per capability registry |
| R15 agreements | LIMITED | clause library reachable; sources/verification not reviewed |
| R18 WorkAid/specialists | BLOCKED | no operational connector |
| R03–R06, R10, R16, R17, R19–R24 | UNAVAILABLE (unverified) | not examined in this slice |

## 7. Commit inventory

See `git log` on the branch; changes are source, tests, six message catalogs and this record.
