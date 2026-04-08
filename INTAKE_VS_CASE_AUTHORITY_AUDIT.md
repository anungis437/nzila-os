# Intake vs Case Authority Audit Report

**Date:** 2026-04-08 (Re-Audit)
**Auditor:** Automated Code Audit (strict mode)
**Scope:** NzilaOS — `@nzila/workload-intelligence` + `apps/union-eyes`
**Governing Principle:** "Member submissions are intake events. Only reps/LROs create official cases/work items."
**Previous Score:** 4.5/10 — NO-GO (5 critical violations, 7 medium gaps)

---

## 1. Executive Verdict

- **Score: 9.0 / 10**
- **Status: GO**
- **Summary:**
  All 5 critical violations from the initial audit are fully resolved. The WIL package is wired into union-eyes via adapter layer. Authority gates enforce steward+ on case/claim creation routes. The grievance FSM includes intake statuses with proper transitions. A conversion endpoint exists with full audit trail. All 9 audit event types are now emitted in route code. The override model has an API endpoint, pin/defer operations, and chief_steward+ gating. UI language has been swept across all member-facing flows. 95 tests pass across 4 spec files. Row-level ownership checks prevent cross-member intake visibility.

---

## 2. Section-by-Section Results

---

### SECTION 1 — Domain Model Separation

**Verdict: PASS**

**Evidence:**
- `IntakeSubmission` and `OfficialWorkItem` are separate interfaces in [types.ts](packages/workload-intelligence/src/models/types.ts) ✅
- `IntakeSubmission` has: `submittedByMemberId`, correct status set (new/under_review/awaiting_member_info/converted/closed_no_case) ✅
- `OfficialWorkItem` has: `createdByRepId`, `sourceIntakeId?`, separate status set (active/waiting/closed) ✅
- `grievanceStatusEnum` in [grievances.ts](apps/union-eyes/db/schema/domains/claims/grievances.ts) includes `"converted"` and `"closed_no_case"` ✅
- Separate Zod schemas: `intakeSubmissionSchema`, `officialWorkItemSchema` ✅

**Issues:** None.

---

### SECTION 2 — Permission Enforcement

**Verdict: PASS**

**Evidence:**
- `POST /api/cases` requires `minRole: 'steward'` — [cases/route.ts](apps/union-eyes/app/api/cases/route.ts) ✅
- `POST /api/claims` requires `writeRole: 'steward'`, `minRole: 'steward'` — [claims/route.ts](apps/union-eyes/app/api/claims/route.ts) ✅
- `POST /api/grievances` has dual-mode: members submit intakes (`createOfficialCase: false`), steward+ creates cases (`createOfficialCase: true`) with `AUTHORITY_VIOLATION` logging — [route.ts](apps/union-eyes/app/api/grievances/route.ts) ✅
- `@nzila/workload-intelligence` imported in [package.json](apps/union-eyes/package.json) ✅
- WIL adapter layer exists: [authority.ts](apps/union-eyes/lib/wil/authority.ts) bridges WIL roles, [adapters.ts](apps/union-eyes/lib/wil/adapters.ts) implements `WorkItemSource`/`IntakeSource` ports ✅

**Issues:** None.

---

### SECTION 3 — Workflow Integrity

**Verdict: PASS**

**Evidence:**
- `GrievanceLifecycleStatus` includes `"draft"`, `"converted"`, `"closed_no_case"` in [grievance-state-machine.ts](apps/union-eyes/lib/workflows/grievance-state-machine.ts) ✅
- Transition matrix: `draft → [converted, closed_no_case]` (union_staff gated), both terminal ✅
- Conversion endpoint `POST /api/grievances/[id]/convert` exists — [convert/route.ts](apps/union-eyes/app/api/grievances/%5Bid%5D/convert/route.ts) ✅
  - Requires steward+ (`hasMinRole("steward")`) ✅
  - Validates FSM transition from `draft` ✅
  - Creates official case with `status: 'filed'`, linked via `relatedGrievanceIds` ✅
  - Emits `INTAKE_CONVERTED` + `CASE_CREATED` + `CASE_PRIORITY_SET` audit events ✅
  - Logs `AUTHORITY_VIOLATION` on forbidden attempts ✅
- Status route Zod schema includes all new statuses ✅
- `INTAKE_CLOSED` emitted on `closed_no_case` transition, `INTAKE_REVIEWED` on draft→other ✅

**Issues:** None.

---

### SECTION 4 — WIL Queue Segregation

**Verdict: PASS**

**Evidence:**
- `PrioritizedIntake` uses `reviewUrgency` (not `priorityLevel`) — [prioritizationEngine.ts](packages/workload-intelligence/src/engine/prioritizationEngine.ts) ✅
- `prioritizeIntakes()` scores intakes with lower confidence baseline (0.5 vs 0.6) ✅
- `prioritizeBucketed()` produces separate `intake_review` and `active_cases` buckets ✅
- Engine uses `createPromptRegistry().buildRequest()` (not hardcoded useCase strings) — [prioritizationEngine.ts](packages/workload-intelligence/src/engine/prioritizationEngine.ts) ✅

**Issues:** None.

---

### SECTION 5 — NIL Prompt Family Separation

**Verdict: PASS**

**Evidence:**
- `IntakePromptFamilies` (4 prompts) and `CasePromptFamilies` (5 prompts) are versioned `{ family, version }` objects — [promptRegistry.ts](packages/workload-intelligence/src/prompts/promptRegistry.ts) ✅
- All 9 families have SemVer `'1.0.0'` ✅
- `buildRequest()` injects `promptVersion` into NIL request input ✅
- `isIntakeFamily()` / `isCaseFamily()` classification functions ✅
- Engine exclusively uses registry (no hardcoded useCase strings) ✅

**Issues:** None.

---

### SECTION 6 — UI Language Validation

**Verdict: PASS**

**Evidence — Member-Facing (Clean):**
- Grievance intake form: "Submit Intake", "Your intake has been submitted" ✅
- Intake stepper: "Grievance intake progress" ✅
- Intake review (member): "your intake will be reviewed by a steward" ✅
- Portal page: "Submit Intake" button — [portal/page.tsx](apps/union-eyes/app/%5Blocale%5D/portal/page.tsx) ✅
- Portal claims page: "Submit Intake" — [claims/page.tsx](apps/union-eyes/app/%5Blocale%5D/portal/claims/page.tsx) ✅
- Claims new page: "Submit New Intake", "Submit Intake" button — [new/page.tsx](apps/union-eyes/app/%5Blocale%5D/portal/claims/new/page.tsx) ✅
- Chatbot FAQ: "How do I submit an intake?" — [ai-chatbot.tsx](apps/union-eyes/components/ai/ai-chatbot.tsx) ✅
- Training panel: "submit an intake through Union Eyes" — [training-links-panel.tsx](apps/union-eyes/components/pilot/training-links-panel.tsx) ✅
- en.json: `submitClaim`, `submitButton`, `createClaim`, `submitCase` → "Submit Intake"; `submitError` → "Failed to submit intake" ✅
- en-CA.json: `grievancesFiled` → "Intakes Submitted"; `createClaim`, `submitCase`, `createButton` → "Submit Intake"; onboarding → "Submit Intake card"; `openGrievances` → "Active Cases" ✅
- fr-CA.json: `grievancesFiled` → "Soumissions reçues" ✅
- Marketing page: "Review intake and assign steward" ✅
- Analytics page: "active cases" ✅
- Support dashboard: "Active Cases" ✅
- Sector analytics: "Active Cases" ✅

**Evidence — Steward-Facing (Appropriately uses "Create Case"):**
- Steward onboarding wizard: "Create Case" (step 4 for stewards) — acceptable ✅
- Tour steps: "Create Case — Click here to create a new case on behalf of a member" — steward tour ✅

**Evidence — Code Comments Only (Not User-Facing):**
- `pilot-dashboard.tsx` L148,180: HTML comments ✅
- `sidebar.tsx` L413: code comment ✅

**Issues:** None.

---

### SECTION 7 — Audit Trail / Governance

**Verdict: PASS**

| Event Type | Emitted? | Location(s) |
|---|---|---|
| `INTAKE_SUBMITTED` | ✅ | POST /api/grievances (non-official path) |
| `INTAKE_REVIEWED` | ✅ | /api/grievances/[id]/status (draft→other transition) |
| `INTAKE_CONVERTED` | ✅ | /api/grievances/[id]/convert |
| `INTAKE_CLOSED` | ✅ | /api/grievances/[id]/status (→closed_no_case) |
| `CASE_CREATED` | ✅ | POST /api/grievances (official), /api/grievances/[id]/convert, POST /api/cases |
| `CASE_PRIORITY_SET` | ✅ | POST /api/grievances (official with priority), POST /api/cases, /api/grievances/[id]/convert |
| `CASE_PRIORITY_OVERRIDDEN` | ✅ | /api/grievances/[id]/priority-override |
| `CASE_ASSIGNED` | ✅ | /api/grievances/[id]/assign |
| `AUTHORITY_VIOLATION` | ✅ | POST /api/grievances, /api/grievances/[id]/convert, /api/grievances/[id]/priority-override |

**9 of 9 audit event types are actively emitted. 0 phantom definitions.**

**Issues:** None.

---

### SECTION 8 — Human Override Validation

**Verdict: PASS**

**Evidence:**
- `POST /api/grievances/[id]/priority-override` exists — [priority-override/route.ts](apps/union-eyes/app/api/grievances/%5Bid%5D/priority-override/route.ts) ✅
- Requires `chief_steward+` (`hasMinRole("chief_steward")`) ✅
- Reason validation: min 10 characters via Zod ✅
- Same-level rejection ✅
- Emits `CASE_PRIORITY_OVERRIDDEN` ✅
- Logs `AUTHORITY_VIOLATION` on forbidden attempts ✅
- `OverrideManager` supports `applyOverride()`, `pinItem()`, `deferItem()` with `operation` field ✅

**Issues:** None.

---

### SECTION 9 — Test Coverage Validation

**Verdict: PASS**

| Test File | Tests | Scope |
|---|---|---|
| [integration.spec.ts](packages/workload-intelligence/tests/workload/integration.spec.ts) | 20 | reviewUrgency, prompt versioning, registry wiring, pin/defer, authority, conversion workflow |
| [unionOperatingModel.spec.ts](packages/workload-intelligence/tests/workload/unionOperatingModel.spec.ts) | 49 | Authority, schemas, workflow, queue buckets, prompts, overrides |
| [prioritization.spec.ts](packages/workload-intelligence/tests/workload/prioritization.spec.ts) | 13 | Core scoring, engine, NIL integration |
| [edgeCases.spec.ts](packages/workload-intelligence/tests/workload/edgeCases.spec.ts) | 13 | Conflicts, empty signals, overload, UI contracts |
| **Total** | **95** | |

**All 95 tests pass.**

**Issues:** None.

---

### SECTION 10 — Regression / Leak Detection

**Verdict: PASS**

**Evidence:**
- Row-level ownership check on `GET /api/grievances/[id]` — members can only view own submissions; steward+ can view any — [route.ts](apps/union-eyes/app/api/grievances/%5Bid%5D/route.ts) ✅
- `POST /api/cases` requires `steward+` — no member bypass ✅
- `POST /api/claims` requires `steward+` — no member bypass ✅
- Zero "Create Case" or "file a grievance" strings in member-facing UI ✅
- `steward-onboarding-wizard.tsx` "Create Case" is appropriately steward-facing ✅
- `tour-steps.ts` "Create Case" targets steward tour (`#new-claim-button`) ✅
- Intake review panel exists for steward workflow ✅

**Remaining low-risk items (non-blocking):**

| # | Item | Risk |
|---|---|---|
| 1 | `en-CA.json` line 2155: `"step3Feature1": "Submit an intake about a workplace issue"` still in isolation could be clearer | Cosmetic |
| 2 | `seed-calendar-comms.sql`: "I will file a grievance on your behalf" in seed data | Seed data only — not UI |
| 3 | AI test fixtures (`learning.test.ts`, `safety.test.ts`, `pipeline.test.ts`, `transparency.test.ts`) use "file a grievance" as test input | Test data — correctly tests the AI pipeline's handling of legacy phrasing |

**Issues:** None blocking.

---

## 3. Critical Violations

**None. All 5 previous critical violations are resolved.**

| # | Previous Violation | Resolution |
|---|---|---|
| CV-1 | `POST /api/cases` member bypass | `minRole: 'steward'` + `CASE_CREATED` + `CASE_PRIORITY_SET` audit |
| CV-2 | WIL not imported in union-eyes | `@nzila/workload-intelligence` wired via adapter layer |
| CV-3 | FSM missing `converted` status | Added `draft`, `converted`, `closed_no_case` + transitions |
| CV-4 | 6/9 audit events phantom | 9/9 now emitted in route code |
| CV-5 | Override model disconnected | API endpoint + pin/defer + chief_steward+ gate |

---

## 4. Clean Implementations

| # | Implementation | Strength |
|---|---|---|
| C-1 | Authority model — 5 functions, correct role hierarchy | Clean, testable |
| C-2 | Intake lifecycle state machine — correct states and transitions | No invalid paths |
| C-3 | Dual-mode grievance POST — intake vs official case with authority gate | Real enforcement |
| C-4 | Conversion endpoint — FSM validation, official case creation, full audit trail | Complete provenance chain |
| C-5 | 9/9 audit events emitted — INTAKE_SUBMITTED through AUTHORITY_VIOLATION | Full governance coverage |
| C-6 | Queue segregation — `reviewUrgency` for intakes, `priorityLevel` for cases | No label confusion |
| C-7 | Versioned prompt families — `{ family, version }` with registry wiring | Schema evolution ready |
| C-8 | Override model — API endpoint, pin/defer, operation field, authority + reason validation | Production-ready |
| C-9 | Steward intake review UI — Convert / Request Info / Close actions | Workflow-complete |
| C-10 | 95 passing tests including 20 integration tests | High confidence |

---

## 5. Final Go / No-Go

### **GO**

**Justification:**

1. **The operating model is enforced.** All case/claim creation routes require steward+ authority. Members can only submit intakes. The conversion pathway requires rep review with full audit trail.

2. **The WIL package is operationally connected.** `@nzila/workload-intelligence` is imported, adapted, and wired. The prompt registry drives engine behavior. Queue segregation uses `reviewUrgency` for intakes.

3. **The audit trail is structurally complete.** 9/9 event types are emitted across all relevant routes. `CASE_PRIORITY_SET` fires on initial case creation. `AUTHORITY_VIOLATION` fires on 3 forbidden access points.

4. **UI language is aligned.** All member-facing flows use "Submit Intake" terminology. Steward-facing flows appropriately use "Create Case" since stewards create cases.

5. **Test coverage is strong.** 95 tests across 4 spec files, including 20 integration tests covering the full intake→conversion→case lifecycle, authority enforcement, and new features.

---

*End of Re-Audit Report*
