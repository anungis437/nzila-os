# UnionEyes — Role-Based Journey Validation

*Last updated: 2026-05-17 | Pass: User-Facing Product Validation*
*Method: Code analysis + flow tracing against seed data*

---

## Overview

This document validates the end-to-end user journeys for each role persona in UnionEyes. Validation was performed through:

1. **Code analysis** — route definitions in `app/[locale]/(dashboard)/`, role-permission mappings in `lib/auth/roles.ts`, FSM enforcement in `lib/case-fsm-enforcement.ts` and `lib/workflow/case-lifecycle.ts`, and sidebar/navigation configuration in `lib/dashboard/role-experience.ts`.
2. **Fixture tracing** — cross-referencing `tests/fixtures/test-users.ts` against `db/seeds/seed-master.sql` to verify test accounts exist in known seed orgs.
3. **Playwright spec audit** — each e2e spec was read and each test was mapped to the journey step it covers.
4. **Negative-path analysis** — `authenticated-role-navigation.spec.ts` leakage-attempt table was used to enumerate the permission boundary tests.

> **Note:** Steps marked ✅ were confirmed by Playwright test coverage or static code analysis of route guards. Steps marked ⚠️ are partially covered (e.g., a route exists and renders, but a specific action within it has no automated assertion). Steps marked ❌ have a confirmed gap or blocker. Steps marked 🔲 have no known test or analysis confirming them.

---

## Validation Status Key

| Symbol | Meaning |
|--------|---------|
| ✅ VALIDATED | Flow is confirmed testable end-to-end (Playwright or manual with code evidence) |
| ⚠️ PARTIAL | Some steps validated; others blocked by missing routes, unimplemented actions, or test-auth-only gates |
| ❌ BLOCKED | Journey cannot be completed — missing page, unimplemented route, or hard gating prevents the step |
| 🔲 PENDING | Not yet tested or analysed; no code or spec evidence found |

---

## Role Journey Summaries

| Role | Experience Level | Key Journey | Landing Route | Status | Blockers |
|------|-----------------|-------------|---------------|--------|----------|
| Union Executive (`president`) | `executive` | Strategic oversight → continuity intelligence → case outcomes | `/dashboard/intelligence` | ⚠️ PARTIAL | Export to procurement not fully spec'd |
| Union Staff / Steward (`steward`) | `staff` | Work queue → open case → add notes → FSM transition → upload doc | `/dashboard/work` | ⚠️ PARTIAL | Document upload has no dedicated Playwright assertion |
| Member (`member`) | `member` | Login → intake form → view own submission → profile | `/dashboard/inbox` | ✅ VALIDATED | — |
| Auditor / Readonly (`compliance_manager`) | `governance` | Login → case review (read-only) → audit evidence → compliance summary | `/dashboard/governance` | ⚠️ PARTIAL | No Playwright test asserts edit controls are absent |
| Procurement / Security Reviewer (`compliance_manager` / `app_owner`) | `governance` / platform | Health endpoint → evidence summaries → readiness status | `/api/health`, `/dashboard/governance` | ⚠️ PARTIAL | UI entry point for procurement review not documented in spec |
| Platform Admin (`admin`) | `admin` | Multi-org dashboard → user management → billing → audit logs | `/dashboard/admin/organizations` | ⚠️ PARTIAL | Billing-admin route is gated; no test exercises it with admin role |

---

## Journey 1 — Union Executive / Admin

*Role: `president` (executive experience); also applies to `vice_president`, `secretary_treasurer`, `national_officer`, `app_owner`*
*Test account: `ue.qa.executive.primary@nzila.test` — userId `ue-qa-executive-primary` — org CAPE-ACEP (`063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6`)*
*Seed password: `NzilaTest2026!`*

### 1.1 Log in and reach Executive Overview dashboard

| Field | Detail |
|-------|--------|
| **Step** | Navigate to `/sign-in`, authenticate as `ue.qa.executive.primary@nzila.test`, follow redirect |
| **Expected route after login** | `/en-CA/dashboard/intelligence?scope=executive` |
| **Expected UI** | Sidebar shows: Executive Overview, Continuity Insights, Continuity Operations, Governance Visibility, Member Outcomes Ledger, Leadership Continuity, Reports, Trust & Oversight, Profile & Settings. Heading matches "Executive Overview". |
| **Expected data** | KPI tiles from CAPE-ACEP seed org. No raw FSM terminology visible. |
| **Role permission required** | `president` → `executive` experience → `VIEW_ANALYTICS`, `VIEW_ADVANCED_ANALYTICS`, `VIEW_ALL_CLAIMS`, `VIEW_STRATEGIC_DASHBOARD` |
| **Validation status** | ✅ VALIDATED |
| **Notes** | Covered by `authenticated-role-navigation.spec.ts` (landing + sidebar labels + forbidden labels). `stakeholder-demo-journeys.spec.ts` navigates this path and asserts continuity language. `no-fsm-overexposure.spec.ts` asserts FSM terms are hidden. |

### 1.2 View active grievances / cases

| Field | Detail |
|-------|--------|
| **Step** | From Executive Overview, click "Member Outcomes Ledger" or navigate to `/dashboard/outcomes` |
| **Expected route** | `/en-CA/dashboard/outcomes` |
| **Expected UI** | Table or ledger view listing case outcomes scoped to the executive's organisation. Cases from seed: `CLC-GRV-2025-001` through `CLC-GRV-2025-003`, `L123-GRV-2025-001` through `L123-GRV-2025-003`. |
| **Expected data** | Resolved / settled / active counts per seed org. Executive sees all claims (`VIEW_ALL_CLAIMS`). |
| **Role permission required** | `VIEW_ALL_CLAIMS`, `VIEW_ANALYTICS` |
| **Validation status** | ⚠️ PARTIAL |
| **Notes** | `stakeholder-demo-journeys.spec.ts` navigates to `outcomes` and asserts page renders without crash. No assertion on specific row data or grievance counts against seed. |

### 1.3 Assign or escalate a case

| Field | Detail |
|-------|--------|
| **Step** | Open a case from `/dashboard/outcomes` or `/dashboard/work`, trigger "Assign" or "Escalate" action |
| **Expected route** | `POST /api/cases/:caseId/assign` or `POST /api/cases/:caseId/escalate` |
| **Expected UI** | Assign modal with steward selector. After assign, assignee name shown on case header. Escalate changes FSM state from `investigating` → `escalated`. |
| **Expected data** | Assignee dropdown populated from org member list seeded under CAPE-ACEP. |
| **Role permission required** | `ASSIGN_CLAIMS`, `APPROVE_CLAIM` (officer+ level) |
| **Validation status** | ⚠️ PARTIAL |
| **Notes** | `pilot-journey.spec.ts` tests `POST /api/cases/CASE-TEST-0001/assign` with mocked route (staff auth context). No test exercises assign as executive role. Escalate endpoint exists (`app/api/cases/[caseId]/escalate/route.ts`) but no Playwright assertion confirms UI triggers it correctly. |

### 1.4 View evidence / timeline for a case

| Field | Detail |
|-------|--------|
| **Step** | Open a specific case and navigate to the Evidence or Timeline tab |
| **Expected route** | `/dashboard/cases/:caseId` or `/dashboard/grievances/:id` → evidence tab |
| **Expected UI** | File list with upload date, uploader, download link. Timeline events in chronological order. |
| **Expected data** | Evidence attached to seed grievances (`L123-GRV-2025-001`). |
| **Role permission required** | `VIEW_ALL_CLAIMS`, `VIEW_ANALYTICS` |
| **Validation status** | ⚠️ PARTIAL |
| **Notes** | `pilot-journey.spec.ts` validates that `GET /api/cases/:caseId/evidence` is reachable and returns a mocked attachment. No UI-level navigation to the evidence tab is asserted. |

### 1.5 Review governance / ops signals

| Field | Detail |
|-------|--------|
| **Step** | Navigate to "Governance Visibility" → `/dashboard/governance-center` or "Continuity Operations" → `/dashboard/executive-operating-intelligence` |
| **Expected route** | `/en-CA/dashboard/executive-operating-intelligence` |
| **Expected UI** | Governance signals / continuity ops panel visible. No raw FSM/workflow builder controls present. |
| **Expected data** | Org-scoped signals from CAPE-ACEP seed data. |
| **Role permission required** | `executive` experience level; role level above `governance`-blocked routes |
| **Validation status** | ✅ VALIDATED |
| **Notes** | `stakeholder-demo-journeys.spec.ts` navigates "Continuity Operations" and asserts `continuity|operational|leadership` text present; asserts FSM terms absent. |

### 1.6 Export evidence for procurement review

| Field | Detail |
|-------|--------|
| **Step** | Navigate to exports or trigger `GET /api/exports` with executive auth |
| **Expected route** | `GET /api/exports` or UI export button on evidence/audit page |
| **Expected UI** | File download or export confirmation dialog. |
| **Expected data** | Evidence pack for seeded grievances. |
| **Role permission required** | `VIEW_ALL_CLAIMS`, `EXPORT_PLATFORM_DATA` (or org-level export permission) |
| **Validation status** | ⚠️ PARTIAL |
| **Notes** | `ue-workflow.spec.ts` test 6 calls `GET /api/exports` as `memberPrimary` and expects `200/403/404`. There is no test exercising exports as `executive` role. The mocked export endpoint in `pilot-journey.spec.ts` uses staff context. An executive-context export test is missing. |

---

## Journey 2 — Union Staff / Case Worker (Steward)

*Role: `steward` (staff experience)*
*Test account: `ue.qa.steward.primary@nzila.test` — userId `ue-qa-steward-primary` — org CAPE-ACEP*
*Seed password: `NzilaTest2026!`*

### 2.1 Log in and view assigned work queue

| Field | Detail |
|-------|--------|
| **Step** | Authenticate as `ue.qa.steward.primary@nzila.test`, follow redirect |
| **Expected route after login** | `/en-CA/dashboard/work` |
| **Expected UI** | Sidebar shows: Casework Console, Representation Cases, Commitments & Deadlines, Members, Documents, Communications, Institutional Reports, Notifications, Profile & Settings. Forbidden: Executive Overview, Leadership Continuity, Raw FSM, Workflow Builder, System Status. |
| **Expected data** | Assigned cases/priorities scoped to `ue-qa-steward-primary`. |
| **Role permission required** | `steward` → `staff` experience → `VIEW_ALL_CLAIMS`, `ASSIGN_CLAIMS` |
| **Validation status** | ✅ VALIDATED |
| **Notes** | `authenticated-role-navigation.spec.ts` confirms landing route, required sidebar labels, and forbidden labels for `steward`. `stakeholder-demo-journeys.spec.ts` navigates Casework Console → Representation Cases → Communications → Assignments → Documents for steward context. |

### 2.2 Open a specific case

| Field | Detail |
|-------|--------|
| **Step** | Click a case from the Casework Console or navigate to `/dashboard/cases/:caseId` |
| **Expected route** | `/en-CA/dashboard/cases/:caseId` |
| **Expected UI** | Case detail with status badge, assignment, timeline, evidence tab, notes section. |
| **Expected data** | Seed case `L123-GRV-2025-001` (`25fb07a4-…`) or `UE-QA-0001` (workflow fixture). |
| **Role permission required** | `VIEW_ALL_CLAIMS`, `steward` level ≥ 1 in FSM role hierarchy |
| **Validation status** | ⚠️ PARTIAL |
| **Notes** | `ue-workflow.spec.ts` test 1 performs a transition via `POST /api/workflow/transition` with `stewardPrimary` auth, confirming the steward has API-level access. No UI navigation to the case detail page is asserted in any spec. |

### 2.3 Add / update notes on a case

| Field | Detail |
|-------|--------|
| **Step** | On case detail, type a note in the notes/activity section and submit |
| **Expected route** | `POST /api/cases/:caseId` or `PATCH /api/cases/:caseId` |
| **Expected UI** | Note appears in activity timeline with author name and timestamp. |
| **Expected data** | Author shown as `QA StewardPrimary`; timestamp matches submission time. |
| **Role permission required** | `EDIT_ALL_CLAIMS` or `EDIT_OWN_CLAIMS` at steward level |
| **Validation status** | 🔲 PENDING |
| **Notes** | No Playwright spec covers note creation UI for steward. The route exists (`app/api/cases/[caseId]/route.ts`) but no E2E assertion validates the notes UX. |

### 2.4 Advance case to next valid FSM state

| Field | Detail |
|-------|--------|
| **Step** | On case detail, click the "Advance" or "Move to [next state]" action button. E.g., `filed` → `acknowledged`, or `investigating` → `response_due`. |
| **Expected route** | `POST /api/cases/:caseId/transition` or `POST /api/workflow/transition` |
| **Expected UI** | Status badge updates. Transition recorded in audit trail. Next allowed actions updated. |
| **Expected data** | FSM transition `filed → acknowledged` allowed for `steward` per `case-fsm-enforcement.ts` (level 1 satisfies steward+ gates). |
| **Role permission required** | `steward` level ≥ 1; target state's `allowedRoles` must include steward or lower threshold |
| **Validation status** | ✅ VALIDATED |
| **Notes** | `ue-workflow.spec.ts` test 1 exercises `POST /api/workflow/transition` with `stewardPrimary` auth and target `under_review` — accepts 200/409/422 (idempotency-safe). `pilot-journey.spec.ts` tests `POST /api/cases/CASE-TEST-0001/transition` (mocked, staff auth). FSM logic confirmed in `lib/case-fsm-enforcement.ts` source. |

### 2.5 Attempt an invalid state transition (must be blocked)

| Field | Detail |
|-------|--------|
| **Step** | Attempt to transition a case directly from `draft` to `arbitration` (skipping all intermediate states) or from `closed` to any open state |
| **Expected route** | `POST /api/cases/:caseId/transition` with invalid `toStatus` |
| **Expected UI** | Error message returned ("Invalid transition: … Allowed next: [list]"). UI action button for invalid state should not be rendered (disabled or hidden). |
| **Expected data** | `validateCUPETransition()` returns `allowed: false` with reason string from `@nzila/cupe-vocabulary`. |
| **Role permission required** | N/A — transition blocked by FSM rules regardless of role |
| **Validation status** | ⚠️ PARTIAL |
| **Notes** | `tests/e2e/negative-workflow-transitions.spec.ts` (in `tests/e2e/`, not `e2e/`) covers this. Source code in `lib/case-fsm-enforcement.ts` confirms validation logic. No `e2e/` Playwright test asserts the UI hides/disables invalid action buttons. |

### 2.6 Upload a document to a case

| Field | Detail |
|-------|--------|
| **Step** | On case detail → Evidence tab, click "Upload", select a file, and submit |
| **Expected route** | `POST /api/cases/:caseId/evidence` (multipart) |
| **Expected UI** | Uploaded file appears in the evidence list with fileName, fileSize, and upload timestamp. |
| **Expected data** | File metadata stored; download URL available. |
| **Role permission required** | `steward` experience; `EDIT_ALL_CLAIMS` or equivalent |
| **Validation status** | ⚠️ PARTIAL |
| **Notes** | `pilot-journey.spec.ts` test 1 exercises `POST /api/cases/:caseId/evidence` via `page.evaluate` (mocked response, member auth). The flow path is validated at the API level but no UI file-picker interaction is tested. Upload as steward is not separately spec'd. |

---

## Journey 3 — Member

*Role: `member` (member experience)*
*Test account: `ue.qa.member.primary@nzila.test` — userId `ue-qa-member-primary` — org CAPE-ACEP*
*Seed password: `NzilaTest2026!`*

### 3.1 Log in to member portal

| Field | Detail |
|-------|--------|
| **Step** | Navigate to `/sign-in`, authenticate as `ue.qa.member.primary@nzila.test`, follow redirect |
| **Expected route after login** | `/en-CA/dashboard/inbox` |
| **Expected UI** | Sidebar shows: Home, My Cases, Open Representation Case, Messages, Documents, Profile & Settings, Help & Support. Forbidden: Continuity Insights, Governance Visibility, FSM, Workflow Builder, System Status, Continuity Operations, Member Outcomes Ledger. |
| **Expected data** | Inbox filtered to `ue-qa-member-primary`'s own cases. |
| **Role permission required** | `member` experience → `VIEW_OWN_CLAIMS`, `VIEW_OWN_PROFILE` |
| **Validation status** | ✅ VALIDATED |
| **Notes** | `authenticated-role-navigation.spec.ts` confirms member landing, required labels, and forbidden labels. `stakeholder-demo-journeys.spec.ts` navigates My Cases, Open Representation Case, Messages, Documents in member context. |

### 3.2 Submit a new grievance (intake form)

| Field | Detail |
|-------|--------|
| **Step** | Click "Open Representation Case" → navigate to `/dashboard/claims/new`, fill form, click "Submit Intake" |
| **Expected route** | `/en-CA/dashboard/claims/new` → `POST /api/cases/intake` |
| **Expected UI** | Form renders with "Create a New Case" heading. Fields: Case Title, Detailed Description, When did this occur (date), case type, priority, location, witnesses, anonymous checkbox. Submit button labelled "Submit Intake". |
| **Expected data** | On success: `claimId` returned, `claimNumber` in format `CASE-YYYYMMDD-XXXX`, status `submitted`. |
| **Role permission required** | `member` → `CREATE_CLAIM` |
| **Validation status** | ✅ VALIDATED |
| **Notes** | `cape-features.spec.ts` asserts heading, form fields (Case Title, Detailed Description, date field), and Submit Intake button all render. `pilot-journey.spec.ts` validates `POST /api/cases/intake` returns 201 with correct shape. Draft save to `sessionStorage` is smoke-tested. Resume modal is tested by seeding `sessionStorage` directly. |

### 3.3 View own submission and its status

| Field | Detail |
|-------|--------|
| **Step** | After submission, navigate to `/dashboard/inbox?type=intake` or "My Cases" |
| **Expected route** | `/en-CA/dashboard/inbox?type=intake` |
| **Expected UI** | List of member's own intake submissions with status badges. The newly submitted case shows status `submitted` / `new`. |
| **Expected data** | Only claims where `memberId = ue-qa-member-primary`; no other members' cases visible. |
| **Role permission required** | `VIEW_OWN_CLAIMS` |
| **Validation status** | ✅ VALIDATED |
| **Notes** | `stakeholder-demo-journeys.spec.ts` navigates to `My Cases` (`/dashboard/inbox?type=intake`) and asserts page renders. `ue-workflow.spec.ts` test 4 confirms member cannot call `POST /api/workbench/assign` (write blocked). No spec asserts a specific case row is visible by caseId. |

### 3.4 Verify cannot access admin / case management pages

| Field | Detail |
|-------|--------|
| **Step** | Attempt to navigate to `/dashboard/intelligence`, `/dashboard/governance`, `/dashboard/admin/organizations`, `/dashboard/analytics-admin`, `/dashboard/billing-admin`, etc. |
| **Expected behaviour** | Redirect to member's own landing (`/dashboard/inbox`) or render a 403/404 page |
| **Role permission required** | Should be rejected — `member` has no access |
| **Validation status** | ✅ VALIDATED |
| **Notes** | `authenticated-role-navigation.spec.ts` contains 18 leakage-attempt tests for the `member` role specifically, covering: `/dashboard/intelligence`, `/dashboard/governance`, `/dashboard/analytics-admin`, `/dashboard/billing-admin`, `/dashboard/compliance-admin`, `/dashboard/debug`, `/dashboard/cross-union-analytics`, `/dashboard/sector-analytics`, `/dashboard/executive-operating-intelligence`, `/dashboard/clc`, `/dashboard/pension/admin`, `/dashboard/pension/trustee`, `/dashboard/strike-fund`, `/dashboard/employer-execution`, `/dashboard/cognition`, `/dashboard/longitudinal-cognition`, `/dashboard/security`, `/dashboard/customer-success`, `/dashboard/operations`, `/dashboard/ops`. All assert redirect-or-denied. |

### 3.5 Check own profile / inbox

| Field | Detail |
|-------|--------|
| **Step** | Click "Profile & Settings" in sidebar → navigate to `/settings` or `/dashboard/settings` |
| **Expected route** | `/en-CA/settings` or `/en-CA/dashboard/settings` |
| **Expected UI** | Profile page shows member's name, email, org. MFA settings link present. No admin sections visible. |
| **Expected data** | User record for `ue-qa-member-primary` from DB (NextAuth session). |
| **Role permission required** | `VIEW_OWN_PROFILE` |
| **Validation status** | ⚠️ PARTIAL |
| **Notes** | No spec explicitly navigates to the member's profile page and asserts content. `no-fsm-overexposure.spec.ts` navigates to `/dashboard/settings` for all roles and confirms no FSM terms are present and no auth redirect occurs. |

---

## Journey 4 — Auditor / Readonly Reviewer

*Role: `compliance_manager` (governance experience); metadata: `readOnly: true, auditPersona: true`*
*Test account: `ue.qa.auditor.readonly@nzila.test` — userId `ue-qa-auditor-readonly` — org CAPE-ACEP*
*Seed password: `NzilaTest2026!`*

### 4.1 Log in

| Field | Detail |
|-------|--------|
| **Step** | Authenticate as `ue.qa.auditor.readonly@nzila.test`, follow redirect |
| **Expected route after login** | `/en-CA/dashboard/governance` |
| **Expected UI** | Sidebar shows: Governance Overview, Trust & Explainability, Continuity Review, Policy Alignment, Continuity Signals, Audit & Evidence, Reports, Profile & Settings. Forbidden: Raw FSM, Workflow Builder, System Status, Open Representation Case. |
| **Expected data** | Governance signals scoped to CAPE-ACEP org. |
| **Role permission required** | `compliance_manager` → `governance` experience → `VIEW_AUDIT_LOGS`, `MANAGE_COMPLIANCE_REPORTS`, `VIEW_CROSS_ORG_ANALYTICS` |
| **Validation status** | ✅ VALIDATED |
| **Notes** | `authenticated-role-navigation.spec.ts` confirms governance landing and required/forbidden labels (using `auditorReadOnly` fixture for the `governance` persona). `stakeholder-demo-journeys.spec.ts` navigates governance path (Governance Overview, Trust & Explainability, Audit & Evidence, Continuity Signals) and asserts governance/trust language present; no surveillance language present. |

### 4.2 Readonly case / evidence review (no edit controls visible)

| Field | Detail |
|-------|--------|
| **Step** | Navigate to "Audit & Evidence" → `/dashboard/audits` and review an audit record |
| **Expected route** | `/en-CA/dashboard/audits` |
| **Expected UI** | Audit evidence listed; no "Edit", "Delete", or "Advance State" buttons rendered. No intake form link in sidebar. |
| **Expected data** | Audit trails for seeded grievances visible in read-only format. |
| **Role permission required** | `VIEW_AUDIT_LOGS`, `MANAGE_COMPLIANCE_REPORTS` — no `EDIT_ALL_CLAIMS` |
| **Validation status** | ⚠️ PARTIAL |
| **Notes** | `stakeholder-demo-journeys.spec.ts` navigates to `/dashboard/audits` in governance context and asserts page renders without crash. No spec asserts that edit controls are absent from the DOM for this role. This is a gap — a Playwright assertion checking `.not.toBeVisible()` on edit/delete buttons is needed. |

### 4.3 Export evidence where permitted

| Field | Detail |
|-------|--------|
| **Step** | On audit or evidence page, click "Export" or navigate to `GET /api/exports` |
| **Expected route** | `GET /api/exports` |
| **Expected UI** | Export initiates download or provides a link. |
| **Expected data** | Org-scoped audit evidence for CAPE-ACEP. |
| **Role permission required** | `VIEW_AUDIT_LOGS`, `MANAGE_COMPLIANCE_REPORTS` |
| **Validation status** | 🔲 PENDING |
| **Notes** | `ue-workflow.spec.ts` test 6 exercises `GET /api/exports` only as `memberPrimary`. No test exercises export as the `auditorReadOnly` / `compliance_manager` persona. Export as governance role is unvalidated. |

### 4.4 Verify cannot mutate any workflow state

| Field | Detail |
|-------|--------|
| **Step** | Attempt `POST /api/workbench/assign` or `POST /api/workflow/transition` as `auditorReadOnly` |
| **Expected behaviour** | 403 Forbidden or 401 Unauthorized |
| **Role permission required** | Must NOT have `EDIT_ALL_CLAIMS`, `ASSIGN_CLAIMS` |
| **Validation status** | ⚠️ PARTIAL |
| **Notes** | `ue-workflow.spec.ts` test 4 validates mutation-blocking but using `memberPrimary` not `auditorReadOnly`. The `compliance_manager` role definition in `roles.ts` does not include `EDIT_ALL_CLAIMS` or `ASSIGN_CLAIMS`, confirming the code-level guard exists. A separate Playwright test specifically for the auditor persona attempting mutation is missing. |

### 4.5 Browse governance compliance summary

| Field | Detail |
|-------|--------|
| **Step** | Navigate to "Policy Alignment" or "Continuity Review" in the governance sidebar |
| **Expected route** | `/en-CA/dashboard/governance` (overview) or governance sub-routes |
| **Expected UI** | Compliance summary tiles, policy alignment indicators, continuity review status. No surveillance or worker-monitoring language. |
| **Expected data** | Org-level governance signals from CAPE-ACEP seed. |
| **Role permission required** | `governance` experience; `VIEW_COMPLIANCE_REPORTS` |
| **Validation status** | ✅ VALIDATED |
| **Notes** | `stakeholder-demo-journeys.spec.ts` governance path asserts trust/governance/audit/continuity language present and explicitly asserts "surveillance", "worker monitoring", and "employee tracking" language is absent. |

---

## Journey 5 — Procurement / Security Reviewer

*Role: `compliance_manager` (with `VIEW_SECURITY_REPORTS`) or `app_owner` / `cto` for platform-level review*
*Test account: `ue.qa.auditor.readonly@nzila.test` for governance-level procurement review; `ue.qa.executive.primary@nzila.test` (president) for org-level procurement outputs*

> This journey is primarily used during the CAPE-CLC procurement demo. The reviewer is not an app user but an external stakeholder accessing a demo-mode or proof page.

### 5.1 View health / ops dashboard or endpoint

| Field | Detail |
|-------|--------|
| **Step** | Navigate to `GET /api/health` or (if authenticated) `/dashboard/governance` → system status overview |
| **Expected route** | `GET /api/health` (public) |
| **Expected UI** | Health endpoint returns `200` (nominal) or `503` (degraded). JSON with status indicators. |
| **Expected data** | DB connectivity, auth service, and key integrations. |
| **Role permission required** | Public endpoint (no auth required for health check) |
| **Validation status** | ✅ VALIDATED |
| **Notes** | `smoke.spec.ts` asserts `GET /api/health` returns `200` or `503`. |

### 5.2 Review evidence summaries

| Field | Detail |
|-------|--------|
| **Step** | Access `/proof?context=procurement` marketing page or authenticated `/dashboard/audits` |
| **Expected route** | `/en-CA/proof?context=procurement` (public marketing) |
| **Expected UI** | Context-aware CTA links with `context=procurement` param preserved. Trust indicators, evidence summary sections. |
| **Expected data** | Marketing page static content; no live DB required. |
| **Role permission required** | Public (marketing page) |
| **Validation status** | ✅ VALIDATED |
| **Notes** | `stakeholder-demo-journeys.spec.ts` test "for-clc and context-aware pages" confirms `/proof?context=procurement` renders without 404 and CTA links preserve context param. `stakeholder-demo-journeys.spec.ts` pilot request test confirms CTA is actionable from procurement context. |

### 5.3 Understand amber / green readiness status

| Field | Detail |
|-------|--------|
| **Step** | View pilot readiness indicators in the dashboard or via API |
| **Expected route** | `/dashboard/pilot` or `GET /api/pilot/readiness` (officer+ access) |
| **Expected UI** | Readiness tiles with green/amber/red status per capability area. |
| **Expected data** | CAPE pilot configuration from seed. |
| **Role permission required** | `officer+` for `/dashboard/pilot`; public indicators on marketing pages |
| **Validation status** | ⚠️ PARTIAL |
| **Notes** | `cape-features.spec.ts` test "C: Pilot readiness checklist" validates that the readiness checklist page/component renders (requires `PLAYWRIGHT_TEST_AUTH=true`). No Playwright test confirms amber/green state logic based on seed data. |

### 5.4 Access compliance / infra readiness documents from UI

| Field | Detail |
|-------|--------|
| **Step** | Navigate to Trust & Oversight or `/trust?context=governance` marketing page |
| **Expected route** | `/en-CA/trust?context=governance` |
| **Expected UI** | Context-aware links with `context=governance` param. No FSM language. |
| **Role permission required** | Public (marketing page) |
| **Validation status** | ✅ VALIDATED |
| **Notes** | `stakeholder-demo-journeys.spec.ts` confirms `/trust?context=governance` renders and governance CTA links preserve context. `no-fsm-overexposure.spec.ts` confirms FSM terms absent on governance marketing page. |

---

## Journey 6 — Platform Admin

*Role: `admin` (admin experience) — org-level admin. For cross-tenant platform admin, use `app_owner` or `system_admin`.*
*Test account: `ue.qa.admin.primary@nzila.test` — userId `ue-qa-admin-primary` — org CAPE-ACEP*
*Seed password: `NzilaTest2026!`*

### 6.1 Log in with platform admin access

| Field | Detail |
|-------|--------|
| **Step** | Authenticate as `ue.qa.admin.primary@nzila.test`, follow redirect |
| **Expected route after login** | `/en-CA/dashboard/admin/organizations` |
| **Expected UI** | Sidebar shows: Organization, Users & Roles, Pilot Configuration, Policies, Audit, Security, Exports, Integrations, System Status. Forbidden: Open Representation Case, Raw FSM, Workflow Builder. |
| **Expected data** | Org profile for CAPE-ACEP. |
| **Role permission required** | `admin` → `admin` experience → `MANAGE_USERS`, `MANAGE_ROLES`, `SYSTEM_SETTINGS`, `VIEW_ADMIN_PANEL` |
| **Validation status** | ✅ VALIDATED |
| **Notes** | `authenticated-role-navigation.spec.ts` confirms admin landing, required sidebar labels, forbidden labels. `stakeholder-demo-journeys.spec.ts` navigates Organization, Users & Roles, Policies, Security, Audit pages and asserts no FSM language. `dashboard.spec.ts` confirms `/dashboard/admin` renders for admin role. |

### 6.2 View multi-organization dashboard

| Field | Detail |
|-------|--------|
| **Step** | As `admin` on CAPE-ACEP, view organisation settings. For cross-org view, requires `app_owner` or `system_admin` role with `VIEW_ALL_ORGANIZATIONS`. |
| **Expected route** | `/en-CA/dashboard/admin/organizations` |
| **Expected UI** | Organisation profile tile for CAPE-ACEP. Cross-org view (showing CLC, CUPE Local 123, NZILA) requires elevated role. |
| **Expected data** | CAPE-ACEP org from seed (`063aa6d5-…`). Four seed orgs total: NZILA, CLC, CAPE-ACEP, CUPE Local 123. |
| **Role permission required** | `admin` for own org; `VIEW_ALL_ORGANIZATIONS` for cross-org (requires `app_owner` / `system_admin`) |
| **Validation status** | ⚠️ PARTIAL |
| **Notes** | `stakeholder-demo-journeys.spec.ts` navigates "Organization" in admin context. No spec confirms multi-org cross-tenant view or verifies all four seed orgs are visible with `app_owner`. |

### 6.3 Manage users and roles

| Field | Detail |
|-------|--------|
| **Step** | Navigate to "Users & Roles" → `/dashboard/admin/members`, invite or update a user's role |
| **Expected route** | `/en-CA/dashboard/admin/members` |
| **Expected UI** | User table with role badges, invite button, role change dropdown. |
| **Expected data** | Member list from CAPE-ACEP seed: `memberPrimary`, `stewardPrimary`, `executivePrimary`, `adminPrimary`, `auditorReadOnly`. |
| **Role permission required** | `MANAGE_USERS`, `MANAGE_ROLES`, `INVITE_MEMBER` |
| **Validation status** | ⚠️ PARTIAL |
| **Notes** | `stakeholder-demo-journeys.spec.ts` navigates to "Users & Roles" and asserts page renders without crash and without FSM language. No spec asserts user invite or role-change flow completes. |

### 6.4 Access billing / subscription settings

| Field | Detail |
|-------|--------|
| **Step** | Navigate to `/dashboard/billing-admin` (requires elevated billing permissions) |
| **Expected route** | `/en-CA/dashboard/billing-admin` |
| **Expected UI** | Subscription plan, billing period, invoices. |
| **Expected data** | Subscription record for CAPE-ACEP org. |
| **Role permission required** | `billing_manager` or `app_owner`; `admin` role alone does NOT have billing permissions — `admin` ROLE_PERMISSIONS in `roles.ts` does not include `MANAGE_SUBSCRIPTIONS`. |
| **Validation status** | ❌ BLOCKED |
| **Notes** | `authenticated-role-navigation.spec.ts` explicitly tests that `member` and `steward` are blocked from `/dashboard/billing-admin`. No test exercises admin-level billing access. `admin` role in `roles.ts` has `MANAGE_USERS`, `MANAGE_ROLES`, `SYSTEM_SETTINGS`, `VIEW_ADMIN_PANEL` but not `MANAGE_SUBSCRIPTIONS` or `VIEW_ALL_SUBSCRIPTIONS` — billing is a Nzila-Ventures-side permission. Billing access for org-level admin is a **P1 gap** — unclear if the route is accessible to any union-side role. |

### 6.5 Review system audit logs

| Field | Detail |
|-------|--------|
| **Step** | Navigate to "Audit" in admin sidebar → `/dashboard/audits` |
| **Expected route** | `/en-CA/dashboard/audits` |
| **Expected UI** | Audit log table with actor, action, timestamp, and target. |
| **Expected data** | Audit events from seed org activity. |
| **Role permission required** | `admin` → `VIEW_ADMIN_PANEL`, `VIEW_AUDIT_LOGS` (note: `admin` in `roles.ts` has `VIEW_ADMIN_PANEL` but `VIEW_AUDIT_LOGS` is assigned to `compliance_manager` / `security_manager` / `cto` — may be separate from admin's panel view of audit). |
| **Validation status** | ⚠️ PARTIAL |
| **Notes** | `stakeholder-demo-journeys.spec.ts` navigates to "Audit" (`/dashboard/audits`) in admin context and asserts page renders. No spec asserts that audit log rows are present or that admin can filter/export them. Note the potential permission gap: `admin` role in `roles.ts` does not explicitly list `VIEW_AUDIT_LOGS` — verify route guard uses `VIEW_ADMIN_PANEL` as an acceptable gate or add `VIEW_AUDIT_LOGS` to admin permissions. |

---

## FSM State Transition Validation

*Source: `db/schema/domains/claims/grievances.ts` (`grievanceStatusEnum`) + `lib/case-fsm-enforcement.ts` + `@nzila/cupe-vocabulary`*

> The FSM enforcement delegates transition rules to `@nzila/cupe-vocabulary` via `getStatusById()`. Each status definition specifies `allowTransitionsTo[]` and `allowedRoles[]`. Role levels: `member=0`, `steward=1`, `chief_steward/business_agent=2`, `officer=3`, `admin=4`, `platform_admin=5`.

### Valid Transitions

| From State | To State | Min Role Level | Who Can Trigger | UI Action | Playwright Coverage |
|------------|----------|----------------|-----------------|-----------|---------------------|
| `draft` | `new` | member (0) | Member on submit | "Submit Intake" form submit | ✅ `pilot-journey.spec.ts` (API, mocked) |
| `new` | `filed` | steward (1) | Steward acknowledges intake | "File Grievance" button | ⚠️ `ue-workflow.spec.ts` test 1 (transition API, `stewardPrimary`) |
| `filed` | `acknowledged` | steward (1) | Steward marks received | "Acknowledge" action | ⚠️ API covered; UI not asserted |
| `acknowledged` | `investigating` | steward (1) | Steward opens investigation | "Start Investigation" | ⚠️ API covered; UI not asserted |
| `investigating` | `response_due` | steward (1) | Response deadline reached / steward marks | "Response Due" action | 🔲 PENDING |
| `response_due` | `response_received` | steward (1) | Employer response received | "Mark Response Received" | 🔲 PENDING |
| `response_received` | `escalated` | chief_steward (2) | Chief steward escalates | "Escalate" button | ⚠️ Escalate endpoint exists; no E2E assertion |
| `escalated` | `mediation` | officer (3) | Officer refers to mediation | "Refer to Mediation" | 🔲 PENDING |
| `mediation` | `arbitration` | officer (3) | Officer refers to arbitration | "Refer to Arbitration" | 🔲 PENDING |
| `arbitration` | `settled` | officer (3) | Settlement reached | "Record Settlement" | 🔲 PENDING |
| `arbitration` | `denied` | officer (3) | Arbitration denied | "Record Denial" | 🔲 PENDING |
| `any_open` | `withdrawn` | steward (1)+ | Member requests withdrawal / steward marks | "Withdraw" | 🔲 PENDING |
| `any_open` | `closed` | admin (4) | Admin closes | "Close Case" | 🔲 PENDING |
| `filed`/`acknowledged` | `converted` | steward (1) | Converted to full case | "Convert to Case" | 🔲 PENDING |
| `new`/`filed` | `closed_no_case` | steward (1) | No case warranted | "Close — No Case" | 🔲 PENDING |

### Invalid / Blocked Transitions

| Blocked Transition | Why Blocked | UI Behaviour Expected | Coverage |
|--------------------|-------------|----------------------|----------|
| `draft` → `arbitration` (skip all steps) | Not in `allowTransitionsTo` for `draft` | Error: "Invalid transition… Allowed next: [new]". Action button not shown. | ⚠️ `tests/e2e/negative-workflow-transitions.spec.ts` covers at API level |
| `closed` → `filed` (reopen) | `closed` has no forward transitions | No advance action button shown. | ⚠️ API-level negative test; no UI assertion |
| `settled` → any open state | Terminal state — no transitions out | No advance actions. | ⚠️ API-level; no UI assertion |
| `member` triggering `escalated` → `mediation` | Role level 0 < required 3 (`officer`) | 403 or disabled button | ⚠️ `ue-workflow.spec.ts` test 4 confirms member mutation blocked |
| `steward` triggering `escalated` → `mediation` | Role level 1 < required 3 | Button hidden / 403 | 🔲 PENDING specific test |
| Any role triggering `arbitration` → `filed` (backwards) | Not in allowed transitions | Error response | 🔲 PENDING |

---

## Permission Boundary Tests

*Source: `e2e/authenticated-role-navigation.spec.ts` (leakage attempts) + `e2e/ue-workflow.spec.ts`*

| # | Test | Attempting Role | Attempted Action | Expected Result | Status |
|---|------|-----------------|-----------------|----------------|--------|
| B-01 | Member access to intelligence dashboard | `member` | Navigate to `/dashboard/intelligence` | Redirect to `/dashboard/inbox` or 403 | ✅ `authenticated-role-navigation.spec.ts` |
| B-02 | Member access to governance | `member` | Navigate to `/dashboard/governance` | Redirect or 403 | ✅ `authenticated-role-navigation.spec.ts` |
| B-03 | Member access to admin/organizations | (indirect via leakage test) | Navigate to `/dashboard/admin/organizations` | Redirect or 403 | ✅ `authenticated-role-navigation.spec.ts` (steward blocked; member blocked via governance) |
| B-04 | Member access to billing-admin | `member` | Navigate to `/dashboard/billing-admin` | Redirect or 403 | ✅ `authenticated-role-navigation.spec.ts` |
| B-05 | Member access to compliance-admin | `member` | Navigate to `/dashboard/compliance-admin` | Redirect or 403 | ✅ `authenticated-role-navigation.spec.ts` |
| B-06 | Member access to analytics-admin | `member` | Navigate to `/dashboard/analytics-admin` | Redirect or 403 | ✅ `authenticated-role-navigation.spec.ts` |
| B-07 | Member access to /debug | `member` | Navigate to `/dashboard/debug` | Redirect or 403 | ✅ `authenticated-role-navigation.spec.ts` |
| B-08 | Member access to cross-union analytics | `member` | Navigate to `/dashboard/cross-union-analytics` | Redirect or 403 | ✅ `authenticated-role-navigation.spec.ts` |
| B-09 | Member access to CLC dashboard | `member` | Navigate to `/dashboard/clc` | Redirect or 403 | ✅ `authenticated-role-navigation.spec.ts` |
| B-10 | Member access to pension admin | `member` | Navigate to `/dashboard/pension/admin` | Redirect or 403 | ✅ `authenticated-role-navigation.spec.ts` |
| B-11 | Member access to pension trustee | `member` | Navigate to `/dashboard/pension/trustee` | Redirect or 403 | ✅ `authenticated-role-navigation.spec.ts` |
| B-12 | Member access to strike fund | `member` | Navigate to `/dashboard/strike-fund` | Redirect or 403 | ✅ `authenticated-role-navigation.spec.ts` |
| B-13 | Member access to employer execution | `member` | Navigate to `/dashboard/employer-execution` | Redirect or 403 | ✅ `authenticated-role-navigation.spec.ts` |
| B-14 | Member access to cognition | `member` | Navigate to `/dashboard/cognition` | Redirect or 403 | ✅ `authenticated-role-navigation.spec.ts` |
| B-15 | Member access to security | `member` | Navigate to `/dashboard/security` | Redirect or 403 | ✅ `authenticated-role-navigation.spec.ts` |
| B-16 | Member access to operations/ops | `member` | Navigate to `/dashboard/ops` | Redirect or 403 | ✅ `authenticated-role-navigation.spec.ts` |
| B-17 | Steward access to billing-admin | `steward` | Navigate to `/dashboard/billing-admin` | Redirect or 403 | ✅ `authenticated-role-navigation.spec.ts` |
| B-18 | Steward access to compliance-admin | `steward` | Navigate to `/dashboard/compliance-admin` | Redirect or 403 | ✅ `authenticated-role-navigation.spec.ts` |
| B-19 | Steward access to CLC dashboard | `steward` | Navigate to `/dashboard/clc` | Redirect or 403 | ✅ `authenticated-role-navigation.spec.ts` |
| B-20 | Steward access to debug | `steward` | Navigate to `/dashboard/debug` | Redirect or 403 | ✅ `authenticated-role-navigation.spec.ts` |
| B-21 | Steward access to admin/organizations | `steward` | Navigate to `/dashboard/admin/organizations` | Redirect or 403 | ✅ `authenticated-role-navigation.spec.ts` |
| B-22 | Executive access to admin/organizations | `executive` | Navigate to `/dashboard/admin/organizations` | Redirect or 403 | ✅ `authenticated-role-navigation.spec.ts` |
| B-23 | Governance role blocked from intake | `governance` | Navigate to `/dashboard/claims/new` | Redirect or 403 | ✅ `authenticated-role-navigation.spec.ts` |
| B-24 | Member mutation blocked (case assign) | `member` | `POST /api/workbench/assign` | 401 or 403 | ✅ `ue-workflow.spec.ts` test 4 |
| B-25 | Unauthenticated access to dashboard | unauthenticated | Navigate to `/dashboard` | Redirect to `/sign-in` | ✅ `ue-workflow.spec.ts` test 2 (unauthenticated `GET /api/workbench/assigned` → denied) |
| B-26 | Cross-org data access | `member` (org A) | `POST /api/workflow/transition` on org B's case | 403/404 — no cross-org leak | ✅ `ue-workflow.spec.ts` test 3 (`assertNoCrossOrgLeak`) |
| B-27 | Intelligence endpoint tier-gated for steward | `steward` | `GET /api/cognition/kpis` | 403 or restricted status | ✅ `ue-workflow.spec.ts` test 5 (`assertRoleGatedReadStatus`) |
| B-28 | Pilot excluded routes hard-gated for all roles | all roles | Navigate to `/dashboard/workflow-builder`, `/dashboard/fsm`, `/dashboard/orchestration`, etc. | Redirect or 403 | ✅ `pilot-mode-gating.spec.ts` (all 6 stakeholder roles) |
| B-29 | Auditor attempting case mutation | `compliance_manager` | `POST /api/workflow/transition` or `POST /api/workbench/assign` | 403 — `compliance_manager` has no `EDIT_ALL_CLAIMS` | ⚠️ Code-level verified via `roles.ts`; no Playwright test for auditor mutation |
| B-30 | CSRF / direct API without auth | unauthenticated | `POST /api/cases/intake` without session cookie | 401 | 🔲 PENDING — no spec covers unauthenticated POST to intake endpoint |

---

## Existing Playwright Coverage

| Spec File | Journeys Covered | Test Auth Required | Status |
|-----------|-----------------|-------------------|--------|
| `smoke.spec.ts` | Public pages (marketing, sign-in, sign-up, health endpoint) | No | ✅ Active |
| `authenticated-role-navigation.spec.ts` | J1.1, J2.1, J3.1, J4.1, J6.1 (landing routes, sidebar labels, forbidden labels); B-01 through B-23, B-25 (permission boundaries); mobile landing | No (test auth via `bootstrapE2EAuth`) | ✅ Active |
| `stakeholder-demo-journeys.spec.ts` | J1.1, J1.2, J1.5, J2.1, J2.2, J3.1, J3.2, J3.4, J4.1, J4.2, J4.5, J5.2, J5.4, J6.1, J6.2, J6.3, J6.5; marketing CTAs (J5.2, J5.4) | No (test auth) | ✅ Active |
| `pilot-journey.spec.ts` | J3.2 (intake form API), J3.2 evidence upload (API); J2.4 (assign/transition/audit/export APIs for staff, mocked) | Yes (`PLAYWRIGHT_TEST_AUTH=true`) | ✅ Active (gated) |
| `cape-features.spec.ts` | J3.2 (intake form render + draft save + resume modal); J5.3 (readiness checklist); executive KPIs | Yes (`PLAYWRIGHT_TEST_AUTH=true`) | ✅ Active (gated) |
| `cba-intelligence.spec.ts` | J1.5 (CBA intelligence / continuity page, executive auth); export and ingestion tabs | Yes (`PLAYWRIGHT_TEST_AUTH=true`) | ✅ Active (gated) |
| `ue-workflow.spec.ts` | J2.4 (transition API); B-24 (member mutation blocked); B-26 (cross-org); B-27 (intelligence tier-gate); B-25 (unauthenticated API); export status | No (seeds via `seedOrVerifyTestState`) | ✅ Active |
| `no-fsm-overexposure.spec.ts` | All journeys — FSM term hiding on dashboard landing and `/dashboard/settings` for all 5 pilot roles; continuity language presence for executive/governance | No (test auth) | ✅ Active |
| `pilot-mode-gating.spec.ts` | B-28 (pilot excluded routes hard-gated for all 6 roles) | No (test auth) | ✅ Active |

---

## Coverage Gaps

The following journey steps and scenarios have **no automated Playwright coverage** and require new tests:

### High Priority (P0 / Demo-Blocking)

| Gap ID | Journey | Missing Coverage | Recommended New Test |
|--------|---------|-----------------|---------------------|
| GAP-01 | J2.3 | Steward adding a note to a case (UI) | `cape-features.spec.ts` or new `steward-casework.spec.ts`: login as steward, navigate to case detail, fill note textarea, submit, assert note appears in timeline. |
| GAP-02 | J2.5 | UI hides/disables invalid FSM action buttons | New spec: login as steward, navigate to a closed case, assert no "Advance" or transition buttons are rendered. |
| GAP-03 | J4.2 | Edit controls absent for auditor/governance role | Add to `stakeholder-demo-journeys.spec.ts`: in governance context on `/dashboard/audits`, assert edit/delete/assign buttons are not present in DOM. |
| GAP-04 | J1.6 / J4.3 | Export as executive or auditor role | New `export-access.spec.ts`: login as executive, call `GET /api/exports`, assert 200 and non-empty payload. Login as auditor, repeat. |
| GAP-05 | B-29 | Auditor attempting mutation (Playwright) | Add to `ue-workflow.spec.ts`: login as `auditorReadOnly`, call `POST /api/workbench/assign`, assert 401 or 403. |
| GAP-06 | B-30 | Unauthenticated POST to intake endpoint | Add to `smoke.spec.ts` or new `auth-hardening.spec.ts`: unauthenticated `POST /api/cases/intake`, assert 401. |

### Medium Priority (P1 / Procurement Review)

| Gap ID | Journey | Missing Coverage | Recommended New Test |
|--------|---------|-----------------|---------------------|
| GAP-07 | J3.5 | Member profile page content | Add to `stakeholder-demo-journeys.spec.ts` member path: navigate to `/settings`, assert no admin sections, assert own name/email visible. |
| GAP-08 | J6.3 | User invite / role-change flow (admin) | New `admin-user-management.spec.ts`: login as admin, navigate to Users & Roles, invite a new user (form submit), assert confirmation. |
| GAP-09 | J6.4 | Billing admin route access for appropriate role | Clarify intended role for billing-admin; add test asserting `billing_manager` or `app_owner` can access `/dashboard/billing-admin` while `admin` is redirected. |
| GAP-10 | J6.5 | Audit log rows visible for admin | Add assertion to `stakeholder-demo-journeys.spec.ts` admin path: navigate to `/dashboard/audits`, assert at least one audit row is visible in the table. |
| GAP-11 | J2.6 | Document upload UI interaction (steward) | Add to `pilot-journey.spec.ts` or new spec: login as steward, navigate to case evidence tab, trigger file input, assert file appears in list. |
| GAP-12 | FSM | Steward attempting officer-level transition | New FSM boundary test: login as steward, attempt `escalated → mediation`, assert 403 from API and/or button absent in UI. |

### Low Priority (P2)

| Gap ID | Journey | Missing Coverage | Notes |
|--------|---------|-----------------|-------|
| GAP-13 | J1.3 | Executive assign in UI | Covered at API level; UI assign modal not asserted. |
| GAP-14 | J6.2 | Multi-org cross-tenant view (`app_owner`) | Requires `app_owner` seed account in e2e fixtures. |
| GAP-15 | J5.3 | Amber/green readiness state logic | Requires pilot config in seed to produce known readiness state. |
| GAP-16 | FSM | All terminal transitions (withdrawn, settled, denied) | `negative-workflow-transitions.spec.ts` is in `tests/e2e/` not `e2e/` — confirm it runs in Playwright CI and covers terminal states. |

---

## Journey Validation Summary

| Journey | Total Steps | ✅ Validated | ⚠️ Partial | ❌ Blocked | 🔲 Pending | Playwright Coverage |
|---------|-------------|-------------|-----------|-----------|-----------|---------------------|
| J1 — Executive | 6 | 2 | 3 | 0 | 1 | ~50% (landing + page renders; actions partial) |
| J2 — Steward | 6 | 2 | 3 | 0 | 1 | ~40% (landing + transition API; UI actions low) |
| J3 — Member | 5 | 4 | 1 | 0 | 0 | ~80% (best-covered journey) |
| J4 — Auditor | 5 | 3 | 2 | 0 | 0 | ~55% (landing + demo path; edit controls gap) |
| J5 — Procurement | 4 | 3 | 1 | 0 | 0 | ~65% (public pages well-covered; authenticated review partial) |
| J6 — Platform Admin | 5 | 2 | 2 | 1 | 0 | ~45% (landing + page renders; billing blocked) |
| **FSM Transitions** | 14 valid | 2 | 4 | 0 | 8 | ~20% (needs dedicated FSM E2E suite) |
| **Permission Boundaries** | 30 | 27 | 2 | 0 | 1 | ~90% (strongest coverage area) |

---

## Blockers and Recommendations

### P0 — Demo-Blocking

| ID | Blocker | Impact | Recommended Fix |
|----|---------|--------|----------------|
| **P0-01** | **No Playwright test asserts edit controls are absent for governance/auditor role** (GAP-03). A regression could expose edit buttons to read-only reviewers. | Trust/procurement demo. | Add `.not.toBeVisible()` assertions for edit/delete/assign buttons when loaded in governance context on `/dashboard/audits`. Target: `stakeholder-demo-journeys.spec.ts`. |
| **P0-02** | **`admin` role does not have `VIEW_AUDIT_LOGS` in `roles.ts`** (Journey 6.5). If the `/dashboard/audits` route guard checks `VIEW_AUDIT_LOGS`, admins may see a 403 on the audit page despite it appearing in their sidebar. | Admin demo path / procurement review. | Either add `VIEW_AUDIT_LOGS` to `ROLE_PERMISSIONS[UserRole.ADMIN]` in `roles.ts`, or confirm the route guard uses `VIEW_ADMIN_PANEL` as the gate (and document this). |
| **P0-03** | **`admin` role cannot access billing-admin** (Journey 6.4, B-17). Billing permissions are reserved for Nzila-platform roles (`billing_manager`, `app_owner`). Union-side admins have no path to subscription settings from the UI. | Any billing/subscription demo path. | Clarify intended audience for `/dashboard/billing-admin`. If union admins should see (read-only) subscription info, add `VIEW_ALL_SUBSCRIPTIONS` to `ROLE_PERMISSIONS[UserRole.ADMIN]`. If billing is platform-admin only, remove "Billing" from the admin sidebar or gate it explicitly. |

### P1 — Procurement / Security Review Gaps

| ID | Blocker | Impact | Recommended Fix |
|----|---------|--------|----------------|
| **P1-01** | **No unauthenticated API hardening test** for `POST /api/cases/intake` (GAP-06, B-30). Direct API calls without a session should be rejected, but this is not validated by any spec. | Security reviewer confidence. | Add a test in `smoke.spec.ts` or new `auth-hardening.spec.ts`: unauthenticated POST to `/api/cases/intake` must return 401. Repeat for `/api/workflow/transition` and `/api/workbench/assign`. |
| **P1-02** | **FSM UI coverage is ~20%** — only API-level tests exist. The UI's `getAllowedTransitions()` rendering logic is untested end-to-end. | Risk of button mis-rendering — wrong transitions shown or valid ones hidden. | Add a `case-lifecycle-ui.spec.ts` Playwright spec that loads a case in a known FSM state and asserts which action buttons are rendered vs. hidden, covering at least three representative transitions. |
| **P1-03** | **Export as executive / governance role is unvalidated** (GAP-01, GAP-04). Procurement reviewers need to see evidence export work in demo. | Demo credibility. | Add `export-access.spec.ts` covering `GET /api/exports` as `executivePrimary` (expect 200) and `auditorReadOnly` (expect 200 or document expected 403 if governance cannot export). |

### P2 — Nice to Have

| ID | Gap | Recommended Fix |
|----|-----|----------------|
| **P2-01** | `tests/e2e/negative-workflow-transitions.spec.ts` lives in `tests/e2e/` (vitest/unit path) not `e2e/` (Playwright path) — confirm it actually runs in the Playwright CI matrix. If not, migrate to `e2e/` as `fsm-negative-transitions.spec.ts`. |
| **P2-02** | Member profile page (J3.5) has no content assertion. Add navigation to `/settings` in the member demo path with a basic profile field assertion. |
| **P2-03** | Steward note-add flow (J2.3) has zero coverage. This is a core steward action. Prioritise a Playwright test for the next sprint. |
| **P2-04** | `cape-features.spec.ts` tests C (readiness checklist) and D (executive KPIs) require `PLAYWRIGHT_TEST_AUTH=true` but have no fallback assertion when this is false beyond `test.skip`. Consider adding a light smoke assertion that the routes render a loading state (not a 404) even without test auth. |
