# UE_OFFICER_EXECUTIVE_2_1_CONVERGENCE_DISPOSITION

Mission `UE-OFFICER-EXECUTIVE-2.1-CONVERGENCE` · canonical authority `UE-OFFICER-EXECUTIVE-CANONICAL-2.1` (FROZEN, design only).
Source baseline `0c994b968` · branch `agents/union-eyes-officer-executive-2-1-freeze`.

**Verdicts.** Design: FROZEN. Operational: NOT QUALIFIED. **Staging: NO-GO. Production: NO-GO.** `UE_SAAS_OPERATIONAL_READINESS` is unchanged at `NO_GO — RUNTIME_PROOF_REQUIRED` (file 25); Phase 3B has not been started.

Evidence vocabulary used throughout, never promoted across categories: `SOURCE_INSPECTED`, `TEST_PROVEN` (vitest in this worktree), `LOCAL_RUNTIME_PROVEN`, `NATIVE_STAGING_PROVEN`, `NOT_PROVEN`. **Nothing in this report is `LOCAL_RUNTIME_PROVEN` or `NATIVE_STAGING_PROVEN`.** No application server, database, browser or Playwright session was run, so journeys E01–E10 are `NOT_PROVEN` end to end.

## 1. Worktree and state

| Item | Value |
|---|---|
| Worktree | `C:\APPS\nzila-os.worktrees\union-eyes-officer-executive-2-1-freeze` |
| Branch | `agents/union-eyes-officer-executive-2-1-freeze` |
| Original HEAD | `0c994b968aed0657cca5b702954ba87252408245` (clean tree at start) |
| Final SHA / dirty state | recorded in the hand-off message; changes are a single local commit, **not pushed, no PR** |
| Isolation | Existing worktree reused. No other worktree touched. |

Concurrent agents observed (read-only inspection): `frozen-senior-representative-architecture` (case access, assignment, representation protocol; staged), `local-ue-navigation-validation` (member experience, messages, `role-experience.ts` member branch), `pasted-text-processing-7ac45129` (representative nav, `roles.ts`, `role-experience.ts` staff branch). See §14.

Incident, disclosed: during setup a PowerShell `Remove-Item '[[]locale]'` used a wildcard and deleted tracked files under `apps/union-eyes/app/[locale]`. Nothing there had been edited by this mission; all 374 files were restored with `git restore --source=HEAD -- ':(literal)apps/union-eyes/app/[locale]'` and `git status` confirmed zero deletions before work continued. Temporary `node_modules` junctions (gitignored) were used to run tests and were removed afterwards.

## 2. Seven-destination navigation (Slice A)

Source: `lib/executive/executive-navigation.ts`, wired into the `executive` branch of `lib/dashboard/role-experience.ts`.

| # | Destination | Target route | Server guard (verified in source) | Menu floor |
|---|---|---|---|---|
| 1 | Today | `/dashboard/executive` (**new**) | `requireUser` + `hasMinRole('officer')`, org from session | officer |
| 2 | Members & Service | `/dashboard/leadership` | new layout `requireDashboardAccess('officer')`; API `officer` | officer |
| 3 | Governance & Organization | `/dashboard/governance` | layout `steward`, page `officer`; introduction page, no operational results | officer |
| 4 | Bargaining & Collective Action | `/dashboard/bargaining` | `hasMinRole('bargaining_committee')` | officer |
| 5 | Finance & Resources | `/dashboard/finance` | layout now `secretary_treasurer` (was `requireUser` only) | secretary_treasurer |
| 6 | Communications & Relations | `/dashboard/correspondence` | `steward`; `canSign` needs `officer` | officer |
| 7 | Continuity & Intelligence | `/dashboard/continuity-intelligence` | `requireUser` only (org scoping of the graph **NOT_PROVEN**) | officer |

Changes of behaviour:

- `president`, `vice_president`, `secretary_treasurer`, **`officer`**, `national_officer` use one executive experience landing on Today. `officer` previously used the separate `governance` experience (competing home). `clc_executive`, `fed_executive`, `compliance_manager`, `security_manager` keep `governance`.
- Removed from the executive menu: Workspace hub, OCRA Intelligence overview, Operations Continuity, Outcomes ledger, Leadership-continuity label, Intelligence reports, Governance Trust & Oversight (marketing-style status page). They remain reachable by deep link where they resolved before (allow-list kept), except `/dashboard/workspace` and `/dashboard/operations`, which are no longer in the executive allow-list.
- The sidebar "Open Workspace orientation hub" cue no longer shows for experiences whose allow-list rejects the hub (it would have been a dead link).
- Labels live in `messages/{en,en-CA,fr,fr-CA,it,pt}.json` (`experienceNavigation`); French differs from English (`TEST_PROVEN`). `it`/`pt` carry English literals, as their other nav keys do.
- Account controls (`Profile & Settings`) remain secondary, group `Settings`.

Proof: `lib/executive/__tests__/executive-navigation.test.ts` — exactly seven destinations in order; every href resolves to an on-disk `page.tsx`; allow-list passes in and out of pilot mode; platform/casework prefixes denied; officer does not see Finance; every destination key present in all six catalogs. **TEST_PROVEN.** Native rendering, keyboard and screen-reader behaviour: **NOT_PROVEN**.

Not done: pre-existing `validate:ontology:nav` failure on the staff/governance `Workspace` group (baseline defect, owned by the Representative agent's nav rewrite). `Executive` was added to `ignoredGroups` so this mission does not add a second failure.

## 3. O01–O26 capability-to-engine coverage

Machine-readable: `lib/executive/capability-matrix.ts` (tested: exactly 26 ids, each mapped to a frozen destination, **none OPERATIONAL**, every gap stated). Dispositions:

| Id | Domain | Disposition | Decisive gap |
|---|---|---|---|
| O01 | Office, term, mandate, delegation | BLOCKED | no authoritative office/term/delegation store |
| O02 | Priorities and decisions | LIMITED | Today shows sourced service aggregates; no decision queue |
| O03 | Member-service oversight | LIMITED | aggregates with provenance; no intervention routing; not runtime proven |
| O04 | Accountability without file access | BLOCKED | executive roles still hold `VIEW_ALL_CLAIMS`; steward+ reads any grievance (Representative 2.2 owns) |
| O05 | Motions, decisions, execution | BLOCKED | no motion/decision store, quorum or decision-rule source; kernel is test-only |
| O06 | Meetings, quorum, minutes | LIMITED | committee meeting/minutes/action-item routes exist; quorum/notice unverified |
| O07 | Bylaws, policies, versions | LIMITED | records exist; not bound to decisions |
| O08 | Offices, committees, delegation | BLOCKED | committees only; no appointments or delegation instruments |
| O09 | Elections, ratifications | UNAVAILABLE | see §8 |
| O10 | Bargaining mandates | LIMITED | records exist; mandate authorization not separated |
| O11 | Agreement approval and signing | BLOCKED | a tentative agreement record is not ratification; no signing source |
| O12 | Collective action | UNAVAILABLE | no authorization chain; strike-fund dashboard now 501 |
| O13 | Budget and actuals | UNAVAILABLE | budget tables never created; finance dashboard is platform billing |
| O14 | Expenditure and segregation | BLOCKED | no expense or approval engine |
| O15 | Dues and funds | LIMITED | dues engine parked; deferred to Secretary-Treasurer persona |
| O16 | Membership governance, appeals | UNAVAILABLE | none found in the dependency set |
| O17 | Employer correspondence | LIMITED | role-label signing; sent is not receipt |
| O18 | Affiliations, federations | UNAVAILABLE | rollup parked; autonomy rules unverified |
| O19 | WorkAid and counsel | UNAVAILABLE | no live connector (see §10) |
| O20 | Conflicts, recusal, ethics | LIMITED | tables exist; recusal not enforced on executive actions |
| O21 | Risk, compliance, privacy | LIMITED | derived aggregates; no certification claimed |
| O22 | Reporting and evidence | LIMITED | metrics have provenance and truthful names; no decision evidence export |
| O23 | Vacancies and succession | BLOCKED | evaluator only; no successor mandate or handover |
| O24 | Institutional memory | LIMITED | surface parked, not in any nav; rationale not persisted |
| O25 | Human-reviewed OCRA | LIMITED | pages label output assistive; scope/freshness not proven here |
| O26 | Bilingual, accessible, mobile | LIMITED | copy parity tested; no browser, mobile or assistive run |

Per-capability fields the mission asks for (route, endpoint, engine, store, audit, notification, native evidence) are recorded in `sources`/`gap` only where a real surface exists; for BLOCKED/UNAVAILABLE rows they are intentionally absent rather than invented.

## 4. Officer-specific mandate and authorization matrix

Implemented as an evaluator, not as a grant: `lib/executive/mandate.ts` (`evaluateExecutiveAction`). Baseline authority for every consequential action is **none**; only a verified mandate (office + term, organization-bound) plus an explicit, bounded, unexpired delegation confers an action. `loadVerifiedMandates` returns an empty set because **no store exists**, so in production every mandate-gated action fails closed.

| Rule (contract ref) | Result |
|---|---|
| Title confers nothing (§I, §IV): President without delegation | denied `NO_DELEGATION` — TEST_PROVEN |
| Vice-President is not the President (§IV) | holds only delegations it was given — TEST_PROVEN |
| Acting officer needs delegation and expiry (§IV, Persona) | denied before start and after expiry — TEST_PROVEN |
| Former officer (§XIII) | denied after term end or revocation — TEST_PROVEN |
| Treasurer cannot approve own expenditure (§IV, §VII) | `SELF_APPROVAL`; unknown requester `REQUESTER_REQUIRED` — TEST_PROVEN |
| Delegation limit (§VII) | over-limit, missing amount, NaN, missing limit all denied — TEST_PROVEN |
| Adopting a decision / certifying an election is never an individual act (§V, §VI) | denied for President, VP, ST, board member, ED even with a delegation — TEST_PROVEN |
| Confidential matter (§IX) | needs a matter-level grant regardless of office — TEST_PROVEN |
| Multiple offices (§IV) | one declared capacity; powers are not merged — TEST_PROVEN |
| Wrong organization / unverified mandate / recusal | denied — TEST_PROVEN |

Not proven: that any route consults this evaluator (none does yet — `NOT_PROVEN`), and the role definitions in `lib/auth/roles.ts` are unchanged: `PRESIDENT` still holds `APPROVE_FINANCIAL`, `DELEGATE_AUTHORITY`, `SIGN_CBA`, `MANAGE_ELECTIONS`; `SECRETARY_TREASURER` holds `APPROVE_FINANCIAL`, `MANAGE_FINANCES` and `AUDIT_FINANCES` together (`SOURCE_INSPECTED`). Role definitions are shared with the Representative agents and were not edited.

Recording/Corresponding Secretary, Executive Director, Bargaining Chair, Committee Chair and Trustee have **no distinct role** in the role model; they cannot be distinguished at all today (`SOURCE_INSPECTED`). Stakeholder-validation dependency.

## 5. P0 findings, corrective changes, denial evidence

| # | Finding (reproduced from source) | Change | Evidence |
|---|---|---|---|
| P0-B1 | `GET /api/executive/dashboard` (`minRole: vice_president`) returned the five newest **raw grievance rows** of the organization — confidential matter content to an office with no matter-level grant | grievance query and import removed; response is aggregates + strategic goals only | `executive-p0-boundaries.route.test.ts` — response keys are exactly `metrics`,`strategicGoals`. TEST_PROVEN |
| P0-E1 | Executive metrics mislabelled: `pendingApprovals` = at-risk strategic goals; `upcomingMeetings` = grievance hearing dates; `monthlyBudget.spent/allocated` = employer **dues remittances**, with `allocated = max(expected, received)` inflating the denominator | renamed `atRiskStrategicGoals`, `grievanceMeetingsNext30Days`, `duesRemittances{expected,received}`; `max` removed; cache key bumped to `v3` | `dashboard-kpi-service.test.ts` updated; the old test only passed because of the `max` (expected was 50,000, shown as 100,001). TEST_PROVEN |
| P0-C1 | `ExecutiveDashboard` called the **removed** `/api/v2/executive/metrics`, then rendered the zero defaults as real metrics (`NaN% utilized` from 0/0); inert "Review Approvals"/"Financial Reports" buttons; `intelligence-shell` showed three static "Priority 1/2/3" boxes; `StrategicPlanningBoard` called another removed `/api/v2` route and defaulted missing status to `on-track` | rewritten to read `/api/executive/dashboard`, label what each number measures, show **Not available** on any failure, no inert buttons; static priorities removed; board renders recorded goals only | source diff. **NOT_PROVEN in a browser** |
| P0-C2 | `/api/strike-fund/dashboard` was `minRole: member` (page layout requires Secretary-Treasurer) and returned a constant `totalBalance: 0` | `secretary_treasurer` + 501 | route test. TEST_PROVEN |
| P0-C3 | Finance layout was `requireUser` only and 13 `/api/finance/*` handlers admitted any `officer` (billing, invoices, chargebacks, per-capita, allocation, exports) | layout and 13 handlers → `secretary_treasurer`; admin-only handlers untouched | route test asserts no `finance` handler uses an `officer` floor. TEST_PROVEN |
| P0-C4 | `/dashboard/leadership` is a client page with no server guard | new `leadership/layout.tsx` `requireDashboardAccess('officer')` | SOURCE_INSPECTED |
| P0-D1 | `POST /api/elections/[id]/vote` added arbitrary per-candidate counts to a global record — no electorate, voter authentication, duplicate protection, secrecy or tabulation | 501, no DB access | route test and static guard in `governance-platform-authority-allowlist-guard.test.ts`. TEST_PROVEN |

Not fixed, with owner (these remain **P1 blockers**, §15): executive-role case breadth in `roles.ts`; steward+ grievance read; `POST/PATCH /api/elections` accept caller-asserted `winners`, `verifiedBy`, `verificationDate`, `contestedResults`; the policy-approval route (`/api/governance/lifecycle/policies/[id]/approvals`, `minRole: admin`, system context) accepts the approver's **`actorRole` from the request body** and returns HTTP 200 with `{error}` on missing fields; steward-level callers can read `/api/dues/dashboard` and `/api/dues/exceptions`; `/api/dashboard/leadership` names individual stewards' workloads; `national_officer` (level 150) satisfies every organization `minRole` check; `coo`/`cto`/`customer_success_director` (Nzila platform roles) still share the executive experience.

## 6. Institutional decision lifecycle (Slice C)

Honest outcome: **no genuinely supportable end-to-end decision workflow exists** in the repository. There is no motion/decision table, no quorum or decision-rule source, no office/delegation store and no organization-scoped adoption record (`SOURCE_INSPECTED`). Committee meetings/minutes/action items persist, but cannot establish a valid executive decision. Building a store would require a schema, RLS census entry and governing-instrument verification — out of scope and explicitly a stakeholder dependency.

What was built instead is the **kernel the store must implement**: `lib/executive/decision-lifecycle.ts`, a pure transition model with eleven distinct states (proposed → authority identified → notice → quorum → adopted/rejected → execution assigned → executed → verified → communicated → closed). There is no `approve` operation: `ADOPTED` is only produced by tallying recorded votes against a quorum under a caller-supplied rule and governing-instrument reference. Adopted ≠ executed (needs the assigned owner and evidence); executed ≠ verified (independent verifier); closure retains outstanding obligations. 9 tests, **TEST_PROVEN as a model only**. It is not persisted, not exposed by any route and not evidence that any real decision has been valid. O05 stays BLOCKED.

## 7. Finance, governance, bargaining and member-service outcomes

- **Finance.** No expense or budget engine (`/api/financial/*` are deprecation stubs). Today states "no budget or expenditure-approval records exist" rather than showing a position. Delegation limits and self-approval denial are `TEST_PROVEN` in the evaluator only. No payment, transfer or bank write was attempted or is possible. Journey E06: honest blocked state; prerequisite = approval engine + delegation store.
- **Governance.** `/dashboard/governance` is an introduction page, explicitly "does not present operational results". Committees (meetings, minutes, action items) are the only persisting governance surface (`LIMITED`).
- **Bargaining.** Negotiations, proposals and tentative-agreement records exist; no ratification engine, so nothing may be shown as ratified or signed. E07: proposal / recommendation / ratification stages cannot be distinguished by the data model — `NOT_PROVEN`.
- **Member service.** Aggregates are organization-scoped with provenance. Executives get no case rows from the executive API. Direct access to unrelated cases by executive roles through the shared case paths is **not** closed (§5 not fixed; Representative owners). E03 intervention routing: not implemented.

## 8. Election scope and integrity disposition

`/api/elections*` operates on `council_elections`, a **global** (no `organization_id`) record table reachable only by `clc_staff`, `clc_executive` and `system_admin` under `withSystemContext` — Union Member Representative Council records at national level. It is a record-keeping surface, not a local-union election or secret-ballot engine, and was not replaced or given a local schema. The vote-increment endpoint is now 501. A separate voting/session engine exists (`voting_sessions`, `voter_eligibility`, `votes`, `/api/voting`, `/api/governance/elections/sessions`) with a recent identity/eligibility fix, but electorate qualification, ballot secrecy, independent tabulation and certification have **not** been established, so it is not advertised and is not in the executive navigation. **O09: UNAVAILABLE (local-union election execution).** Result certification by entry (`verifiedBy` as free text) remains open (§5).

## 9. Organizational authorization scenarios (design level)

No stakeholder sign-off, deployment or organization-specific rule verification is claimed; all verdicts below are `NOT_PROVEN` beyond the evaluator's generic rules.

| Scenario | What the current model can and cannot express |
|---|---|
| CAPE / ACEP | Elected leadership vs professional staff vs LRO oversight cannot be separated: no distinct roles, no delegation store. |
| CUPE local | President/Treasurer/board map to labels only; board collective action cannot be represented individually (kernel models it, nothing persists it). |
| CUPE regional / National | `national_officer` passes every organization role floor; summary-only oversight without raw local records is **not** enforced. |
| CLC | `clc_executive` stays in the `governance` experience; affiliate autonomy rules are unverified and cross-org rollup is parked. |
| LIUNA OPDC/CECOF-style | Separate bodies, business-agent supervision and counsel-restricted records have no representation. |
| Small volunteer local | Multiple offices: evaluator enforces one active capacity and independent approval; the documented alternative independent-review process is unknown and therefore unenforced. |

## 10. WorkAid executive boundary

Not implemented; **UNAVAILABLE**. No referral request, expenditure authorization, member-approved sharing scope, transmission, acknowledgment, acceptance/rejection, filing validity or outcome-release object exists in the executive dependency set, and no executive surface exposes WorkAid, Clio or professional-record data. Missing conditions: qualified live connector, referral state machine with WorkAid-owned acceptance, member information-sharing consent, union-side expenditure authorization (see O14). Dispatch, delivery and receipt must stay distinct events when built.

## 11. Leadership succession and revocation

`TEST_PROVEN` (evaluator): authority ends at term end or revocation; acting authority needs a bounded delegation; another person's mandate is ignored. `BLOCKED`: successor mandate, open-decision/approval/obligation carry-over, handover assignment and provider-side access revocation (no authoritative source). Role reassignment is not treated as succession anywhere. E09 `NOT_PROVEN`.

## 12. OCRA and reporting source integrity

- Executive metrics now name what they measure and expose `provenance` (sources, row counts, generatedAt, cache hit). Row sets are capped at 5,000 grievances / 10,000 members in the service; truncation is not signalled (`SOURCE_INSPECTED`, P1).
- Today reports **Not available** (never zero) when the aggregate source cannot be read, and never implies an empty decision queue.
- `/dashboard/governance-center` and `/dashboard/continuity-intelligence` declare assistive, human-reviewed output; organization scoping of the underlying graph and metric definitions are `NOT_PROVEN`. `/dashboard/trust` is marketing-style status content and was removed from the menu.
- No AI-generated output was given decision or approval powers.

## 13. English/French, mobile and accessibility

`TEST_PROVEN`: EN/FR copy parity for Today and all seven nav labels. `SOURCE_INSPECTED`: Today uses landmarks, `role="status"`/`"alert"`, text (not colour) state badges and link names that include the card title. **NOT_PROVEN:** desktop/mobile rendering, keyboard order, screen reader output, French in a browser, bottom-nav behaviour (`components/mobile/BottomNav.tsx` was not changed or checked), and any native staging pass.

## 14. Cross-agent ownership and integration dependencies

| Area | Owner | This mission's footprint |
|---|---|---|
| Executive nav, Today, matrix, mandate evaluator, decision kernel, executive metrics, executive API | **this mission** | new `lib/executive/*`, `components/executive/*`, `app/[locale]/dashboard/executive`, `leadership/layout.tsx` |
| `lib/dashboard/role-experience.ts` | shared (Member, Representative, this) | executive branch, two role sets, one filter line, one import; **expect merge conflicts** with `local-ue-navigation-validation` and `pasted-text-processing-7ac45129` |
| `lib/dashboard/dual-nav-honesty.ts` (+ tests), `components/__tests__/sidebar.test.tsx`, `e2e/helpers/role-fixtures.ts` | shared | executive expectations only |
| `messages/*.json` `experienceNavigation` | shared (Member edited the same block) | seven keys inserted before one anchor key |
| `lib/auth/roles.ts`, case access/assignment, grievance read paths | Representative 2.2 / Senior Representative 2.1 | **not touched** |
| `/api/finance/*`, finance layout, strike-fund dashboard | Secretary-Treasurer persona (next) | floors raised only; no logic change |
| `config/continuity-ontology-matrix.json` | platform | `Executive` added to `ignoredGroups` |
| `reports/route-registry.json` | generated | **stale** (strike-fund, finance floors, election vote); regenerating produced a 1,269-line unrelated diff, so it was reverted — integration owner should regenerate once on the merged baseline |

Required integration decisions: reconcile `role-experience.ts` hunks; schedule the mandate/delegation store (schema + RLS census) shared by Senior Representative SR01/05–07/13–21 and O01/O08/O14/O23; decide whether Nzila platform roles leave the executive experience.

## 15. Remaining P0/P1 blockers and responsible authority

| Blocker | Priority | Responsible |
|---|---|---|
| Executive roles hold `VIEW_ALL_CLAIMS`/`EDIT_ALL_CLAIMS`/`APPROVE_CLAIM`; steward+ reads any grievance in the organization | P0 | Representative 2.2 + Senior Representative 2.1 |
| No office/term/delegation store; mandate evaluator unconsumed by any route | P0 | platform schema owner + governing-instrument verification (stakeholders) |
| No decision/motion store, quorum or decision-rule source | P0 for any "decision" claim | governance owner + stakeholders |
| No expenditure/approval engine; `APPROVE_FINANCIAL` + `MANAGE_FINANCES` + `AUDIT_FINANCES` on one role | P0 for any payment claim | Secretary-Treasurer persona |
| Election: caller-asserted `verifiedBy`/`winners`; no qualified local engine | P0 for any election claim | election authority + stakeholders |
| Policy-approval route trusts body `actorRole` | P1 | governance owner |
| `national_officer` breadth; platform roles in executive experience; no distinct secretary/ED/chair/trustee roles | P1 | role model owners |
| Dues/exception reads at steward level; leadership view names stewards | P1 | Secretary-Treasurer / representation owners |
| KPI row caps unsignalled; registry stale; pre-existing ontology-nav `Workspace` failure | P1 | integration owner |
| WorkAid connector and referral boundary | P1 | WorkAid owner |
| Native browser, EN/FR, mobile, accessibility, connected journeys E01–E10 | gate | staging acceptance owner |

## 16. Test and tool evidence (all local, `TEST_PROVEN` unless noted)

Run from `apps/union-eyes` with the shared `node_modules`:

- `vitest run lib/executive lib/dashboard components/__tests__/sidebar.test.tsx components/workspace i18n lib/services/__tests__/dashboard-kpi-service.test.ts lib/reality lib/auth app/api/__tests__/finance app/api/__tests__/executive-p0-boundaries.route.test.ts app/api/governance` — all passing (final counts in the hand-off message).
- `tsc --noEmit`: one error in `packages/os-core/src/policy/authorize.ts` (`@nzila/platform-auth/entra/server` unresolved through the borrowed `node_modules`); none in files touched here.
- `eslint` on touched files: 0 errors; 4 warnings (existing `no-explicit-any`, and a `set-state-in-effect` hint matching the component's previous pattern).
- Not run: `pnpm lint`, `pnpm typecheck`, `pnpm test:fast`, `pnpm validate:docs`, `pnpm governance:audit` at repository level; Playwright suites; any server or database.

Actual release verdicts: **Staging NO-GO. Production NO-GO.**
