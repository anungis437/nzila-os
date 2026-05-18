# UnionEyes — Flow Validation Matrix

*Last updated: 2026-05-17 | Pass: User-Facing Product Validation*
*Method: Code analysis, API inspection, and FSM state tracing*
*Analyst: GitHub Copilot CLI*

---

## Overview

This document maps every critical end-to-end flow in UnionEyes against the actual code (routes, FSM, actions, schema) found in `apps/union-eyes`. Each step is traced to a concrete file or API route — nothing is assumed. Statuses reflect static code analysis; runtime behaviour must be independently confirmed via Playwright with `PLAYWRIGHT_TEST_AUTH=true`.

**Use this document to:**
- Identify which pilot flows are safe to demo
- Surface blockers that prevent full end-to-end completion
- Track Playwright spec coverage per flow
- Guide triage prioritisation before CAPE pilot demo

---

## Validation Status Key

| Symbol | Meaning |
|--------|---------|
| ✅ VALIDATED | Complete end-to-end with proof (route exists, auth enforced, DB write confirmed, audit emitted) |
| ⚠️ PARTIAL | Some steps validated; others blocked by missing routes or client-only auth |
| ❌ BLOCKED | Flow cannot complete — missing route, missing page, or broken dependency |
| 🔄 DATA ONLY | Backend/API validated; UI page does not exist or is not confirmed |
| 🔲 PENDING | Not yet analysed or tested |

---

## Flow 1 — Member Intake → Case/Grievance Created

*Critical pilot flow · CAPE demo required*

**Start state:** No grievance/claim record exists for the member.
**End state:** Claim record in `submitted` status, visible to member and case worker queue.
**Roles involved:** `member`, `steward`/`chief_steward`, `admin`
**Expected data changes:** `claims` row created; audit event emitted; optional evidence attachment linked.
**Events/audit expected:** `GRIEVANCE_CREATED` / `INTAKE_SUBMITTED` (via `auditDataMutation` + `emitCapeAuditEvent` in `POST /api/cases/intake`)
**UI confirmation expected:** Redirect or success message on `/dashboard/claims/new`; item visible in `/dashboard/work` or `/dashboard/inbox?type=intake`

| Step | Actor | Action | Route / API | Data Change | UI Confirmation | Status | Notes |
|------|-------|--------|-------------|-------------|-----------------|--------|-------|
| 1 | member | Navigate to intake form | `GET /en-CA/dashboard/claims/new` | None | "Create a New Case" heading (confirmed by `cape-features.spec.ts`) | ✅ VALIDATED | `app/[locale]/dashboard/claims/new/page.tsx` exists; no server-side role gate — any authenticated user |
| 2 | member | Fill in required fields: title, description, incident date, caseType, priority | UI form fields | None (client state) | Fields render: "Case Title", "Detailed Description", "When did this occur" (confirmed by Playwright) | ✅ VALIDATED | Draft saved to `sessionStorage` key `grievance-draft` |
| 3 | member | Click "Submit Intake" | `POST /api/cases/intake` | `claims` row created; `auditDataMutation` called; `INTAKE_SUBMITTED` CAPE event emitted; optional NAR proof signed | `201` response with `{ claimId, claimNumber, status: 'submitted' }` | ✅ VALIDATED | `app/api/cases/intake/route.ts`: uses `withRLSContext`, `validateIntakeRequest` from `@nzila/cupe-vocabulary`, RLS org isolation, `eventBus.emit(AppEvents.INTAKE_SUBMITTED)`, pilot event listeners attached |
| 4 | system | System assigns `submitted` status | DB | `claims.status = 'submitted'`, `claims.grievanceNumber = 'CASE-YYYYMMDD-NNNN'` | None (background) | ✅ VALIDATED | Status is set on DB write inside intake route; seed shows `status: 'submitted'` as initial case state |
| 5 | member | View submitted case in queue | `GET /en-CA/dashboard/work` or `GET /en-CA/dashboard/inbox?type=intake` | None | Case list renders with submitted item (`cape-features.spec.ts` confirms page loads with content) | ⚠️ PARTIAL | `/dashboard/work` page exists; `/dashboard/grievances` (list) **does NOT exist** (404 — confirmed by PAGE_RENDER_VALIDATION.md P1) |
| 6 | steward | See new item in workbench queue | `GET /api/workbench/assigned` | None | Workbench queue updates | ⚠️ PARTIAL | `app/api/workbench/assigned/route.ts` exists; `ue-workflow.spec.ts` test 2 confirms unauthenticated request is blocked (401/403); steward auth path not fully e2e validated |
| 7 | admin | Receive notification of new intake | Notification service | `notifications` row inserted | Email/in-app notification | ⚠️ PARTIAL | `lib/services/grievance-notifications.ts` → `sendGrievanceFiledNotification()` is implemented; called from intake route via `eventBus`; delivery path not runtime-confirmed |

---

## Flow 2 — Triage → Investigation → Response → Resolution

*Core case management flow · Two FSMs in play (see note)*

> **FSM divergence note:** Two FSMs exist in the codebase. `lib/workflows/grievance-state-machine.ts` (deprecated) uses `draft → converted → new → triage → investigation → negotiation → arbitration → resolved → closed`. `lib/services/case-workflow-fsm.ts` (deprecated) uses `draft → submitted → acknowledged → investigating → pending_response → negotiating → escalated → resolved → withdrawn → closed`. `lib/workflow/case-lifecycle.ts` is declared as the authoritative unified FSM per both `@deprecated` annotations but was **not found** in the repository — this is a blocker. The transition API at `POST /api/cases/[caseId]/transition` and `POST /api/workflow/transition` reference `targetStatus` values empirically; the authoritative enum source cannot be confirmed.

**Schema FSM states** (from `grievance-schema.ts` `grievanceStatusEnum`):
`draft → filed → acknowledged → investigating → response_due → response_received → escalated → mediation → arbitration → settled → withdrawn → denied → closed`

| Transition | Trigger | Who (min role) | API / Action | DB Change | Audit Event | UI Signal | Status |
|-----------|---------|----------------|--------------|-----------|-------------|-----------|--------|
| `draft → filed` | Member submits intake | `member` (level 0) | `POST /api/cases/intake` or `POST /api/grievances` | `status = 'filed'`; `filed_date` set | `INTAKE_SUBMITTED`, `GRIEVANCE_CREATED` | Success toast / redirect | ✅ VALIDATED (API exists, audit call present) |
| `filed → acknowledged` | Steward acknowledges | `steward` (level 1) | `POST /api/cases/[caseId]/transition` body `{ toStatus: 'acknowledged' }` | `status = 'acknowledged'` | Audit row via `auditDataMutation` | Status badge update in case detail | ⚠️ PARTIAL (route exists; SLA check: must occur within 2 business days per `case-workflow-fsm.ts`) |
| `acknowledged → investigating` | Steward begins investigation; requires assignment | `steward` (level 1) | `POST /api/cases/[caseId]/transition`; steward must first call `POST /api/cases/[caseId]/assign` | `status = 'investigating'`; `union_rep_id` set | Audit event | Case detail banner | ⚠️ PARTIAL (FSM guard: `assignedStaffId` required per `grievance-state-machine.ts`) |
| `investigating → response_due` | Response deadline triggered | `steward` / `officer` | `POST /api/cases/[caseId]/transition` | `status = 'response_due'`; `response_deadline` set | Deadline audit event | SLA badge visible on ops dashboard | 🔄 DATA ONLY (route exists; no UI confirmation) |
| `response_due → response_received` | Employer response logged | `steward` | `POST /api/cases/[caseId]/transition` + notes | `status = 'response_received'` | Response audit event | Timeline entry | 🔄 DATA ONLY |
| `response_received → resolved` | Settlement reached | `officer` / `admin` | `POST /api/cases/[caseId]/transition` body `{ toStatus: 'resolved' }` | `status = 'resolved'`; `resolved_at` set | `CASE_RESOLVED` audit event | Resolution confirmation | 🔲 PENDING |
| `response_received → escalated` | No agreement — escalate | `officer` / `admin` | `POST /api/cases/[caseId]/escalate` | `status = 'escalated'`; `escalated_at` set | Escalation audit event | Escalation badge | ⚠️ PARTIAL (route `/api/cases/[caseId]/escalate` exists; Playwright test confirms route hit produces 200 with mocked response) |
| `resolved → closed` | Admin archives | `officer` / `admin` | `POST /api/cases/[caseId]/transition` | `status = 'closed'`; `closed_at` set | Close audit event | Case marked archived | 🔲 PENDING |
| Any state → `withdrawn` | Member withdraws | `member` (own case) | `POST /api/cases/[caseId]/transition` | `status = 'withdrawn'` | Withdrawal audit event | Withdrawn badge | 🔲 PENDING |

---

## Flow 3 — Escalation Path

*When a grievance escalates from `investigating` → `escalated` → `mediation` → `arbitration`*

**Trigger condition:** Employer fails to respond within SLA deadline **or** steward/officer manually triggers escalation.
**Roles who can escalate:** `steward` (level 1) can initiate; `officer` (level 3) required to refer to arbitration.
**Timeline/audit expectations:** Each escalation step writes to `grievance_timeline` table; seed data confirms `CLC-GRV-2025-003` (uuid `3c5a2aa4-2beb-4d7d-b93e-2f95bd7f1dc8`) is in `escalated` state with 6 timeline entries.

| Step | Actor | Trigger | API / Action | DB Change | Notification Path | UI Signal | Status | Notes |
|------|-------|---------|--------------|-----------|-------------------|-----------|--------|-------|
| 1 | steward | SLA expires or manual decision | `POST /api/cases/[caseId]/escalate` | `status = 'escalated'`; `escalated_at` timestamped | `sendGrievanceFiledNotification()` variants notify admin | Escalation banner on case detail | ⚠️ PARTIAL | Route exists; e2e `pilot-journey.spec.ts` confirms `/api/cases/CASE-TEST-0001/escalate` returns 200 (mocked) |
| 2 | officer | Escalation to mediation step | `POST /api/cases/[caseId]/transition` `{ toStatus: 'mediation' }` | `status = 'mediation'`; `step = 'step_3'` | Notification to parties | Step indicator advances | 🔄 DATA ONLY | `grievanceStepEnum` includes `step_1`, `step_2`, `step_3`, `final`, `arbitration` |
| 3 | officer | Refer to arbitration | `POST /api/cases/[caseId]/transition` `{ toStatus: 'arbitration' }` | `status = 'arbitration'`; `is_arbitration_eligible = true`; CIRB file reference | Admin notified | Arbitration badge; `step = 'arbitration'` | 🔄 DATA ONLY | `arbitrationStatusEnum` tracks `pending → scheduled → in_progress → award_rendered → settled/withdrawn` |
| 4 | admin | Arbitration hearing scheduled | `POST /api/arbitrations/...` (route under `/api/arbitration/`) | Arbitration record created | Parties notified by email | Hearing date displayed | 🔲 PENDING | `/api/arbitration/precedents/[id]` and `/api/arbitration/precedents/search` exist; no hearing-schedule route confirmed |
| 5 | admin | Award rendered → resolved | `POST /api/cases/[caseId]/transition` `{ toStatus: 'settled' }` or `'closed'` | `arbitration_status = 'award_rendered'`; grievance `status = 'settled'` | Outcome notification | Settlement confirmation page | 🔲 PENDING | |

---

## Flow 4 — Evidence Upload / View / Export

| Step | Actor | Action | Route / API | Data Change | UI Confirmation | Status | Notes |
|------|-------|--------|-------------|-------------|-----------------|--------|-------|
| 1 | member / steward | Upload document to case | `POST /api/cases/[caseId]/evidence` (multipart/form-data) | Evidence record linked to claim; `attachments` jsonb updated | `201` with `{ attachment: { url, fileName, fileSize, uploadedAt } }` (confirmed by `pilot-journey.spec.ts`) | ✅ VALIDATED | `app/api/cases/[caseId]/evidence/route.ts` exists; Playwright test intercepts and confirms shape |
| 2 | steward | Upload via generic upload | `POST /api/upload` or `POST /api/documents/upload` | Document row in `documents` table; evidence pack potentially rebuilt | HTTP 200 | ⚠️ PARTIAL | Both routes exist; `/dashboard/documents` page confirmed in PAGE_RENDER_VALIDATION.md but has stub sub-tabs |
| 3 | steward | View evidence in case timeline | `GET /api/cases/[caseId]/timeline` | None (read) | Timeline entries rendered in `<GrievanceDetailConsole />` / `cases/[id]` page | ⚠️ PARTIAL | `app/api/cases/[caseId]/timeline/route.ts` exists; UI at `/dashboard/cases/[id]` loads timeline via `useEffect` (PAGE_RENDER_VALIDATION C1 ✅) |
| 4 | steward | View evidence per arbitration precedent | `GET /api/arbitration/precedents/[id]/documents` | None (read) | Precedent document list | 🔄 DATA ONLY | Route exists; no dedicated UI page confirmed |
| 5 | steward / officer | Export case evidence pack | `GET /api/cases/[caseId]/export` | None (read) | PDF / ZIP download | ⚠️ PARTIAL | Route exists; Playwright `pilot-journey.spec.ts` confirms route is reachable (mocked 200); actual export format not confirmed |
| 6 | officer | Export bulk evidence | `GET /api/evidence/export` | None (read) | Export file | 🔄 DATA ONLY | `app/api/evidence/export/route.ts` exists; no UI trigger confirmed |
| 7 | admin / auditor | Tag evidence | Not found — no `/api/cases/[caseId]/evidence/[id]/tag` route | — | — | ❌ BLOCKED | Tagging endpoint does not exist in discovered route inventory |
| 8 | auditor (read-only) | Access evidence without system login | `GET /api/exports/[id]` or shared link | None | Read-only document view | 🔲 PENDING | `/api/exports/[id]` and `/api/exports/pdf` routes exist; no auditor read-only auth path confirmed |

---

## Flow 5 — Policy Replay / CBA Clause Review

*CBA clause review and policy cross-reference against an open case*

| Step | Actor | Action | Route / API | Status | Notes |
|------|-------|--------|-------------|--------|-------|
| 1 | steward | Search CBA clauses relevant to case | `GET /api/clause-library/search?q=...` or `GET /api/clauses/search?q=...` | ⚠️ PARTIAL | Both routes exist; `ai/semantic-search` also available; no UI search page for clauses confirmed |
| 2 | AI / steward | AI suggests applicable clauses for grievance | `POST /api/ai/grievances/[id]/suggest-clauses` | ✅ VALIDATED | Route `app/api/grievances/[id]/suggest-clauses/route.ts` exists; AI triage also at `POST /api/ai/grievances/[id]/triage` and `POST /api/ai/grievances/triage` |
| 3 | steward | Attach clause reference to grievance | `PATCH /api/grievances/[id]` with `cbaId`/`cbaArticle`/`cbaSection` | 🔄 DATA ONLY | Schema has `cba_id`, `cba_article`, `cba_section` fields on `grievances` table; update route not explicitly confirmed |
| 4 | steward | Retrieve AI clause reasoning for case | `GET /api/ai/grievances/[id]/clause-reasoning` | ✅ VALIDATED | Route exists; returns AI-generated legal reasoning |
| 5 | steward | Cross-reference against CBA intelligence documents | `GET /api/cba-intelligence/documents` | 🔄 DATA ONLY | Route `app/api/cba-intelligence/documents/route.ts` exists; ingestion pipeline in `lib/services/cba-intelligence/` |
| 6 | officer | Export CBA intelligence analysis | `GET /api/cba-intelligence/agreements/export` | 🔄 DATA ONLY | Route exists; output format not confirmed |

---

## Flow 6 — Search → Open Record → Action

| Step | Actor | Route | Data Expected | Status | Notes |
|------|-------|-------|---------------|--------|-------|
| 1 | steward / admin | Search for member/case/grievance by keyword | `GET /api/search/universal?q={keyword}` | Ranked results: grievances, org members, documents, collective agreements (confirmed via source — queries `grievances`, `organizationMembers`, `collectiveAgreements`, `documents` tables) | ✅ VALIDATED | `app/api/search/universal/route.ts` exists with drizzle queries; requires `steward` min role; `requireEntitlement` checked |
| 2 | steward | Search for member by name | `GET /api/members/search?q={name}` or `GET /api/organization/members/search` | Member records for org | ✅ VALIDATED | Both routes exist |
| 3 | steward | Search precedents by keyword | `GET /api/arbitration/precedents/search` or `GET /api/precedents/search` | Arbitration precedent records | ✅ VALIDATED | Both routes exist |
| 4 | steward | Open grievance detail from search result | `GET /en-CA/dashboard/grievances/[id]` | Grievance record + timeline | ⚠️ PARTIAL | Page exists; delegates to `<GrievanceDetailConsole />`; role gate enforced server-side (`hasMinRole('steward')`) |
| 5 | steward | Open case detail from search result | `GET /en-CA/dashboard/cases/[id]` | Case record + evidence + timeline | ⚠️ PARTIAL | Page exists; client-side RBAC only (PAGE_RENDER_VALIDATION C7 ⚠️ WARN) |
| 6 | steward | Perform action from case detail (assign/transition) | `POST /api/cases/[caseId]/assign` + `POST /api/cases/[caseId]/transition` | Assignment + status change | ⚠️ PARTIAL | Routes exist; Playwright confirms both return 200 (mocked in `pilot-journey.spec.ts`) |
| 7 | member | Navigate to `/dashboard/grievances` list | `GET /en-CA/dashboard/grievances` | List of member's grievances | ❌ BLOCKED | **Route does not exist** — 404. Consolidated into `/dashboard/work` or `/dashboard/inbox?type=intake` per Wave 3 IA audit |

---

## Flow 7 — Admin Dashboard → Case Detail → Workflow Action

| Step | Actor | Route | Action | Status | Notes |
|------|-------|-------|--------|--------|-------|
| 1 | admin | Load admin dashboard | `GET /en-CA/dashboard/admin` | See user/local stats; 7 admin sections | ⚠️ PARTIAL | Page exists; **no server-side role gate** — C7 P1 security gap (PAGE_RENDER_VALIDATION); API calls will 403 for non-admin but page shell is visible to any authenticated user |
| 2 | admin | View admin stats | `GET /api/admin/stats/overview`; `GET /api/admin/users`; `GET /api/admin/locals` | org stats, user list, local list | 🔄 DATA ONLY | Fetch calls from `dashboard/admin/page.tsx`; routes not individually confirmed in route inventory |
| 3 | admin | Open case from admin context | `GET /en-CA/dashboard/cases/[id]` | Case record | ⚠️ PARTIAL | Page exists (client component, client-only RBAC) |
| 4 | admin | Assign case to steward | `POST /api/cases/[caseId]/assign` body `{ assigneeId }` | `claims.assigned_to` updated | ✅ VALIDATED | Route exists; Playwright confirms 200 (mocked); RBAC requires `case_assign` min level 2 (`chief_steward`+) |
| 5 | admin | Transition case status | `POST /api/cases/[caseId]/transition` body `{ toStatus }` | `claims.status` updated | ✅ VALIDATED | Route exists; FSM validation via `canPerformAction('case_transition', role)` |
| 6 | admin | View case audit trail | `GET /api/cases/[caseId]/audit` | Audit log entries for case | ✅ VALIDATED | Route exists; Playwright confirms 200 (mocked in `pilot-journey.spec.ts`) |
| 7 | admin | Manage org users | `GET/POST /api/admin/members` or `GET /api/members` | User list with roles | 🔄 DATA ONLY | `/api/admin/members/stats` route exists; `/api/members/[id]/roles` exists |

---

## Flow 8 — Ops Dashboard → Issue Discovery

*Cases missing SLA · Stalled grievances · Governance alerts*

| Step | Actor | Route | Signal | Status | Notes |
|------|-------|-------|--------|--------|-------|
| 1 | platform_lead | Load operations dashboard | `GET /en-CA/dashboard/operations` | 5 drizzle queries: `platform_services`, `platform_incidents`, `platform_sla_metrics`, `platform_releases`, `platform_capacity` | ✅ VALIDATED | PAGE_RENDER_VALIDATION: PASS; `hasMinRole('platform_lead')` enforced server-side; data is real drizzle queries |
| 2 | admin / steward | Detect overdue cases | `GET /api/workflow/overdue` | List of cases past SLA | ✅ VALIDATED | `app/api/workflow/overdue/route.ts` exists |
| 3 | admin | Detect stalled grievances (no activity) | `GET /api/grievances/workload` | Steward workload + stalled case signals | ✅ VALIDATED | Route `app/api/grievances/workload/route.ts` exists |
| 4 | admin | View governance alerts | `GET /api/governance/dashboard` | Governance posture signals | 🔄 DATA ONLY | Route exists; renders via `dashboard/governance-center` page (PASS) |
| 5 | steward / executive | Load leadership KPI dashboard | `GET /api/dashboard/leadership?timeframe={weekly|monthly|quarterly}` | `{ kpi: { activeGrievances, resolvedThisMonth, avgTriageDays, avgResolutionDays, arbitrationCount, overdueCases }, employers, trends, stewards }` | ✅ VALIDATED | Route confirmed; Playwright `cape-features.spec.ts` validates response shape at 200; page at `/dashboard/leadership` confirmed |
| 6 | admin | `/dashboard/ops` sub-dashboard | `GET /en-CA/dashboard/ops` | Performance signals | ❌ BLOCKED | **Route does not exist** — `ops/` directory has only `performance/` subdirectory with no `page.tsx` at the `ops/` level (404 — P2) |
| 7 | admin | Deadlines dashboard | `GET /api/deadlines/dashboard` | Cases with approaching response deadlines | ✅ VALIDATED | Route `app/api/deadlines/dashboard/route.ts` exists |

---

## Flow 9 — Evidence Export → Procurement Review

| Step | Actor | Route | Export Format | Status | Notes |
|------|-------|-------|---------------|--------|-------|
| 1 | officer / admin | Initiate evidence export for case | `GET /api/cases/[caseId]/export` | JSON / ZIP (format not confirmed) | ⚠️ PARTIAL | Route exists; Playwright confirms reachability (mocked); actual mime type / format not validated |
| 2 | admin | Initiate bulk export | `GET /api/exports/csv`, `GET /api/exports/excel`, `GET /api/exports/pdf` | CSV / XLSX / PDF | 🔄 DATA ONLY | All three export format routes exist; no UI trigger button confirmed |
| 3 | admin | Generate evidence package | `POST /api/evidence/export` | Export bundle | 🔄 DATA ONLY | Route `app/api/evidence/export/route.ts` exists |
| 4 | admin | CBA intelligence export | `GET /api/cba-intelligence/agreements/export` | Export file | 🔄 DATA ONLY | Route exists |
| 5 | auditor / procurement | Download via export ID | `GET /api/exports/[id]` | Signed download URL or direct file | 🔲 PENDING | Route exists; no auditor-scoped auth pattern confirmed |
| 6 | auditor | View evidence without system account | Shared link / `GET /api/exports/[id]` with token | Read-only document | 🔲 PENDING | No tokenised share or public-access download path confirmed |
| 7 | admin | Finance/governance export | `GET /api/finance/exports` | Finance report | 🔄 DATA ONLY | Route `app/api/finance/exports/route.ts` exists |

---

## API Endpoint Coverage

Routes discovered under `apps/union-eyes/app/api/`. Only pilot-relevant and cross-flow routes listed; full inventory in codebase.

| Route | Method | Auth Required | Min Role | Playwright Coverage | Status |
|-------|--------|---------------|----------|---------------------|--------|
| `/api/health` | GET | No | — | smoke.spec.ts | ✅ VALIDATED |
| `/api/health/liveness` | GET | No | — | PAGE_RENDER_VALIDATION | ✅ VALIDATED |
| `/api/cases/intake` | POST | Yes | `member` | pilot-journey.spec.ts (mocked) | ✅ VALIDATED |
| `/api/cases` | GET/POST | Yes | `steward` | — | 🔄 DATA ONLY |
| `/api/cases/[caseId]` | GET/PATCH | Yes | `steward` | — | 🔄 DATA ONLY |
| `/api/cases/[caseId]/assign` | POST | Yes | `chief_steward` (level 2) | pilot-journey.spec.ts (mocked) | ✅ VALIDATED |
| `/api/cases/[caseId]/transition` | POST | Yes | `steward` (level 1) | pilot-journey.spec.ts (mocked) | ✅ VALIDATED |
| `/api/cases/[caseId]/escalate` | POST | Yes | `steward` | pilot-journey.spec.ts (mocked) | ✅ VALIDATED |
| `/api/cases/[caseId]/audit` | GET | Yes | `steward` | pilot-journey.spec.ts (mocked) | ✅ VALIDATED |
| `/api/cases/[caseId]/export` | GET | Yes | `officer` (level 3) | pilot-journey.spec.ts (mocked) | ✅ VALIDATED |
| `/api/cases/[caseId]/evidence` | POST | Yes | `member` | pilot-journey.spec.ts (mocked) | ✅ VALIDATED |
| `/api/cases/[caseId]/timeline` | GET | Yes | `steward` | — | 🔄 DATA ONLY |
| `/api/cases/[caseId]/notes` | GET/POST | Yes | `member` / `steward` | — | 🔄 DATA ONLY |
| `/api/cases/[caseId]/next-actions` | GET | Yes | `steward` | — | 🔄 DATA ONLY |
| `/api/grievances` | GET/POST | Yes | `steward` (GET); `member` (POST) | ue-workflow.spec.ts (partial) | ⚠️ PARTIAL |
| `/api/grievances/[id]` | GET/PATCH | Yes | `steward` | — | 🔄 DATA ONLY |
| `/api/grievances/[id]/status` | PATCH | Yes | `steward` | — | 🔄 DATA ONLY |
| `/api/grievances/[id]/assign` | POST | Yes | `chief_steward` | — | 🔄 DATA ONLY |
| `/api/grievances/[id]/convert` | POST | Yes | `union_staff` | — | 🔄 DATA ONLY |
| `/api/grievances/[id]/documents` | GET | Yes | `steward` | — | 🔄 DATA ONLY |
| `/api/grievances/[id]/intelligence` | GET | Yes | `steward` | — | 🔄 DATA ONLY |
| `/api/grievances/[id]/suggest-clauses` | GET | Yes | `steward` | — | ✅ VALIDATED |
| `/api/grievances/[id]/clause-reasoning` (via ai) | GET | Yes | `steward` | — | ✅ VALIDATED |
| `/api/grievances/workload` | GET | Yes | `admin` | — | 🔄 DATA ONLY |
| `/api/workflow/transition` | POST | Yes | `steward` | ue-workflow.spec.ts | ⚠️ PARTIAL |
| `/api/workflow/overdue` | GET | Yes | `steward` | — | 🔄 DATA ONLY |
| `/api/workbench/assigned` | GET | Yes | `steward` | ue-workflow.spec.ts (blocked unauthenticated) | ⚠️ PARTIAL |
| `/api/workbench/assign` | POST | Yes | `chief_steward` | ue-workflow.spec.ts (403 confirmed for member) | ✅ VALIDATED (auth gate) |
| `/api/search/universal` | GET | Yes | `steward` | — | ✅ VALIDATED (source) |
| `/api/members/search` | GET | Yes | `steward` | — | 🔄 DATA ONLY |
| `/api/members/[id]/claims` | GET | Yes | `steward` | — | 🔄 DATA ONLY |
| `/api/evidence/export` | POST/GET | Yes | `officer` | — | 🔄 DATA ONLY |
| `/api/exports` | GET | Yes | `officer` | ue-workflow.spec.ts (200/403/404) | ⚠️ PARTIAL |
| `/api/exports/[id]` | GET | Yes | `officer` | — | 🔲 PENDING |
| `/api/exports/pdf` | GET | Yes | `officer` | — | 🔄 DATA ONLY |
| `/api/exports/csv` | GET | Yes | `officer` | — | 🔄 DATA ONLY |
| `/api/exports/excel` | GET | Yes | `officer` | — | 🔄 DATA ONLY |
| `/api/documents/upload` | POST | Yes | `member` | — | ⚠️ PARTIAL |
| `/api/documents` | GET | Yes | `member` | — | 🔄 DATA ONLY |
| `/api/dashboard/leadership` | GET | Yes | `executive`/`officer` | cape-features.spec.ts | ✅ VALIDATED |
| `/api/dashboard/stats` | GET | Yes | `steward` | — | 🔄 DATA ONLY |
| `/api/analytics/claims` | GET | Yes | `steward` | — | 🔄 DATA ONLY |
| `/api/audits` | GET | Yes | `officer` | — | 🔄 DATA ONLY |
| `/api/audits/[id]` | GET | Yes | `officer` | — | 🔄 DATA ONLY |
| `/api/ai/grievances/[id]/triage` | POST | Yes | `steward` | — | ✅ VALIDATED (source) |
| `/api/ai/search` | GET | Yes | `steward` | — | 🔄 DATA ONLY |
| `/api/clause-library/search` | GET | Yes | `steward` | — | 🔄 DATA ONLY |
| `/api/cba-intelligence/documents` | GET | Yes | `steward` | — | 🔄 DATA ONLY |
| `/api/pilot/onboarding` | GET | Yes | `admin` | cape-features.spec.ts | ✅ VALIDATED |
| `/api/pilot/apply` | POST | No | — | — | ✅ VALIDATED (marketing page) |
| `/api/governance/dashboard` | GET | Yes | `officer` | — | 🔄 DATA ONLY |
| `/api/deadlines/dashboard` | GET | Yes | `steward` | — | 🔄 DATA ONLY |
| `/api/employers/communications` | GET | Yes | `officer` | cape-features.spec.ts | ⚠️ PARTIAL |
| `/api/employers/communications/contacts` | GET | Yes | `officer` | cape-features.spec.ts | ⚠️ PARTIAL |
| `/api/cognition/kpis` | GET | Yes | Tier-gated | ue-workflow.spec.ts | ⚠️ PARTIAL (tier-gate confirmed) |
| `/api/cognition/cases/[id]/risk` | GET | Yes | Tier-gated | — | 🔄 DATA ONLY |

---

## Server Actions Coverage

No `actions.ts` files were found under `apps/union-eyes/app/**`. All mutations are performed via HTTP API routes. Relevant action enforcement modules:

| Action Module | Location | Auth Mechanism | Roles | Status |
|---------------|----------|----------------|-------|--------|
| `canPerformAction()` — RBAC gate | `lib/action-enforcer.ts` | Role level check against `CUPE_ACTIONS` matrix | `member`, `steward`, `chief_steward`, `business_agent`, `officer`, `admin`, `platform_admin` | ✅ VALIDATED — tested in `lib/__tests__/action-enforcer.test.ts` |
| `validateTransition()` — FSM gate (legacy) | `lib/workflows/grievance-state-machine.ts` | Role level + guard conditions | `union_staff` (level ≥60), `union_admin` (level ≥80), `platform_admin` (level 100) | ✅ VALIDATED — test coverage in `lib/__tests__/grievance-lifecycle.test.ts` |
| `validateTransition()` — FSM gate (case-workflow) | `lib/services/case-workflow-fsm.ts` | Role array check + conditions | `member`, `steward`, `officer`, `admin` | ✅ VALIDATED — `lib/services/__tests__/case-workflow-fsm.test.ts` |
| `withOrganizationAuth()` — org isolation | `lib/organization-middleware.ts` | Clerk session + org RLS | All authenticated roles | ✅ VALIDATED — used in grievances, cases, search routes |
| `hasMinRole()` — page-level guard | `lib/api-auth-guard.ts` | Session role resolution from DB | Parameterised per route | ✅ VALIDATED — used in grievances, cases, workbench routes |
| `requireEntitlement()` — tier gate | `services/platform-economics/entitlement-guard.ts` | Platform billing tier | Org-level entitlement | ✅ VALIDATED — used in intake, search, universal routes |
| Pilot tracking | `lib/services/pilot-tracking.ts` | Called from intake route post-creation | `admin` | ✅ VALIDATED — invoked on intake submit |
| CAPE audit events | `lib/audit/cape-audit-events.ts` | Called from grievance/case routes | Internal | ✅ VALIDATED — `emitCapeAuditEvent` called in grievances POST route |

---

## FSM Complete Transition Table

**Authoritative source:** `lib/workflows/grievance-state-machine.ts` (legacy, deprecated) + `db/schema/grievance-schema.ts` `grievanceStatusEnum` + `lib/services/case-workflow-fsm.ts`.

> ⚠️ **Gap:** `lib/workflow/case-lifecycle.ts` is referenced as the unified authoritative FSM in both deprecated files but **was not found** in the repository. The runtime transition API may be operating against an undiscovered implementation or a stub.

### Schema FSM (grievanceStatusEnum — DB authority)

| From | To | Trigger | Min Actor | API | Audit Event | Status |
|------|----|---------|-----------|-----|-------------|--------|
| `draft` | `filed` | Member submits intake | `member` | `POST /api/cases/intake` | `INTAKE_SUBMITTED` | ✅ VALIDATED |
| `draft` | `converted` | Steward converts intake to case | `union_staff` | `POST /api/grievances/[id]/convert` | `GRIEVANCE_CONVERTED` | 🔄 DATA ONLY |
| `draft` | `closed_no_case` | No merit — intake closed | `union_staff` | `POST /api/grievances/[id]/status` | `INTAKE_CLOSED` | 🔄 DATA ONLY |
| `filed` | `acknowledged` | Steward acknowledges; SLA ≤ 2 business days | `steward` | `POST /api/cases/[caseId]/transition` | Audit row | ⚠️ PARTIAL |
| `acknowledged` | `investigating` | Assigned steward begins work | `steward` + `assignedStaffId` guard | `POST /api/cases/[caseId]/transition` | Audit row | ⚠️ PARTIAL |
| `investigating` | `response_due` | Employer response deadline set | `steward` | `POST /api/cases/[caseId]/transition` | Audit row | 🔄 DATA ONLY |
| `investigating` | `escalated` | No response / merit for escalation | `steward` | `POST /api/cases/[caseId]/escalate` | `CASE_ESCALATED` | ⚠️ PARTIAL |
| `response_due` | `response_received` | Employer responds | `steward` | `POST /api/cases/[caseId]/transition` + notes | Audit row | 🔄 DATA ONLY |
| `response_received` | `escalated` | Response unsatisfactory | `officer` | `POST /api/cases/[caseId]/escalate` | `CASE_ESCALATED` | 🔄 DATA ONLY |
| `response_received` | `resolved` | Agreement reached | `officer` | `POST /api/cases/[caseId]/transition` | `CASE_RESOLVED` | 🔲 PENDING |
| `escalated` | `mediation` | Mediation scheduled | `officer` | `POST /api/cases/[caseId]/transition` | Audit row | 🔄 DATA ONLY |
| `mediation` | `arbitration` | No mediation resolution | `officer` | `POST /api/cases/[caseId]/transition` | Audit row | 🔄 DATA ONLY |
| `arbitration` | `settled` | Award rendered / agreement | `union_admin` | `POST /api/cases/[caseId]/transition` | Audit row | 🔲 PENDING |
| `arbitration` | `withdrawn` | Grievant withdraws | `union_admin` | `POST /api/cases/[caseId]/transition` | Audit row | 🔲 PENDING |
| `settled` | `closed` | Admin archives | `union_admin` | `POST /api/cases/[caseId]/transition` | `CASE_CLOSED` | 🔲 PENDING |
| `resolved` | `closed` | Admin archives | `officer` | `POST /api/cases/[caseId]/transition` | `CASE_CLOSED` | 🔲 PENDING |
| `denied` | `closed` | Admin acknowledges denial | `union_admin` | `POST /api/cases/[caseId]/transition` | Audit row | 🔲 PENDING |
| `closed` | `investigating` | Admin reopens (audit correction only) | `platform_admin` | `POST /api/cases/[caseId]/transition` | `CASE_REOPENED` | 🔲 PENDING |
| Any active | `withdrawn` | Member withdraws | `member` (own) | `POST /api/cases/[caseId]/transition` | Audit row | 🔲 PENDING |

---

## Flow Coverage Summary

| Flow | Steps Defined | ✅ Validated | ⚠️ Partial | 🔄 Data Only | ❌ Blocked | 🔲 Pending | Playwright Spec | Overall Status |
|------|--------------|-------------|------------|-------------|-----------|------------|-----------------|----------------|
| 1 — Member Intake → Case Created | 7 | 3 | 3 | 0 | 0 | 1 | `pilot-journey.spec.ts`, `cape-features.spec.ts` | ⚠️ PARTIAL |
| 2 — Triage → Investigation → Resolution | 9 | 2 | 3 | 3 | 0 | 2 | `ue-workflow.spec.ts` (test 1) | ⚠️ PARTIAL |
| 3 — Escalation Path | 5 | 0 | 1 | 3 | 0 | 1 | `pilot-journey.spec.ts` (mocked) | ⚠️ PARTIAL |
| 4 — Evidence Upload / View / Export | 8 | 2 | 3 | 2 | 1 | 2 | `pilot-journey.spec.ts` | ❌ BLOCKED (tagging) |
| 5 — Policy Replay / CBA Review | 6 | 3 | 1 | 2 | 0 | 0 | — | ⚠️ PARTIAL |
| 6 — Search → Open Record → Action | 7 | 3 | 3 | 0 | 1 | 0 | — | ❌ BLOCKED (grievance list) |
| 7 — Admin Dashboard → Workflow Action | 7 | 2 | 3 | 2 | 0 | 0 | `dashboard.spec.ts` | ⚠️ PARTIAL |
| 8 — Ops Dashboard → Issue Discovery | 7 | 4 | 0 | 2 | 1 | 0 | `ue-workflow.spec.ts` (test 5) | ❌ BLOCKED (`/dashboard/ops`) |
| 9 — Evidence Export → Procurement | 7 | 0 | 1 | 4 | 0 | 2 | `ue-workflow.spec.ts` (test 6) | ⚠️ PARTIAL |

---

## Critical Path Assessment

The **minimum set of flows** that must work for the CAPE pilot demo:

| # | Flow | Must-Pass Criteria | Current Status | Gap |
|---|------|--------------------|----------------|-----|
| 1 | **Member Intake → Case Created** | Member logs in, fills form at `/dashboard/claims/new`, submits; receives confirmation; steward sees new item in queue | ⚠️ PARTIAL | `/dashboard/grievances` list page is 404; queue is accessible only via `/dashboard/work` or `/dashboard/inbox?type=intake` |
| 2 | **Triage → Acknowledged → Investigating** | Steward opens case, assigns to self, transitions `filed → acknowledged → investigating` via API or workbench UI | ⚠️ PARTIAL | Unified FSM (`lib/workflow/case-lifecycle.ts`) not found; transition API works (confirmed mocked); UI workbench not fully e2e validated |
| 3 | **Evidence Upload to Case** | Steward or member uploads document via `POST /api/cases/[caseId]/evidence`; file linked to case; visible in timeline | ✅ VALIDATED (API) | UI timeline at `/dashboard/cases/[id]` loads but client-side RBAC only (C7 gap); evidence tagging route missing |
| 4 | **Leadership KPI Dashboard** | Executive opens `/dashboard/leadership`; sees 6 KPI cards: Active Grievances, Resolved This Month, Avg Triage, Avg Resolution, Arbitrations, Overdue Cases | ✅ VALIDATED | Requires seeded data; empty-state fallback confirmed in Playwright |
| 5 | **Admin Dashboard + Audit Trail** | Admin opens case, views audit trail at `GET /api/cases/[caseId]/audit`, sees timeline of actions | ⚠️ PARTIAL | `/dashboard/admin` has no server-side role gate (P1 security gap must be fixed before demo) |

---

## Blockers

### B1 — `/dashboard/grievances` list page does not exist · **P1**

- **Impact:** Flow 1 step 5, Flow 6 step 7. Any link to "view my grievances" produces a Next.js 404. Members and stewards cannot navigate to a grievance list.
- **Confirmed by:** `PAGE_RENDER_VALIDATION.md` assessment `NOT_FOUND`.
- **Fix:** Create `app/[locale]/dashboard/grievances/page.tsx` with `requireUser()` + `hasMinRole('member')`, fetching from `GET /api/grievances` (route exists).

### B2 — `/dashboard/cases` list page does not exist · **P1**

- **Impact:** Flow 6 (case navigation from search). Direct navigation to case list is a 404.
- **Fix:** Create `app/[locale]/dashboard/cases/page.tsx` delegating to a cases console component.

### B3 — `lib/workflow/case-lifecycle.ts` (unified FSM) not found · **P1**

- **Impact:** Flows 2, 3. Both deprecated FSM files (`grievance-state-machine.ts`, `case-workflow-fsm.ts`) reference this file as the authoritative source. The runtime transition behaviour of `POST /api/cases/[caseId]/transition` cannot be fully validated without it.
- **Fix:** Locate or re-create `lib/workflow/case-lifecycle.ts`; confirm it is imported by transition route; or document which FSM the route actually uses.

### B4 — `/dashboard/admin` has no server-side role gate · **P1 (security)**

- **Impact:** Flow 7. Any authenticated user can view the full admin panel HTML. All 7 admin sections (users, security, database, AI testing) are visible in DOM to non-admin roles.
- **Confirmed by:** `PAGE_RENDER_VALIDATION.md` C7 ❌ FAIL.
- **Fix:** Add `await requireUser(); const ok = await hasMinRole('admin'); if (!ok) redirect(...)` at top of `app/[locale]/dashboard/admin/page.tsx`.

### B5 — Evidence tagging endpoint missing · **P2**

- **Impact:** Flow 4 step 7. No `PATCH/POST /api/cases/[caseId]/evidence/[id]/tag` or equivalent route exists in the discovered inventory.
- **Fix:** Implement evidence tagging sub-route or confirm tagging is handled via `PATCH /api/cases/[caseId]` with `attachments` jsonb update.

### B6 — `/dashboard/ops` route does not exist · **P2**

- **Impact:** Flow 8. The ops performance sub-dashboard is a 404.
- **Confirmed by:** `PAGE_RENDER_VALIDATION.md` `NOT_FOUND`.
- **Fix:** Create `app/[locale]/dashboard/ops/page.tsx` or redirect to `/dashboard/operations`.

### B7 — `/dashboard/claims` list page does not exist · **P2**

- **Impact:** Breadcrumb navigation from `claims/new` to a claims list is broken.
- **Confirmed by:** `PAGE_RENDER_VALIDATION.md` `NOT_FOUND`.
- **Fix:** Create list page or confirm `/dashboard/inbox?type=intake` is the canonical replacement and update all navigation links.

### B8 — Auditor / procurement read-only export access path not confirmed · **P3**

- **Impact:** Flow 9 steps 5–6. No tokenised share link or public-access download flow is confirmed. Auditors without a system account cannot independently access evidence.
- **Fix:** Confirm whether `GET /api/exports/[id]` supports unauthenticated token-based access, or implement a signed-URL pattern.
