# Union Eyes — Workflow Realignment Report

> **Phases 0–9 Complete** | Generated 2026-04-08
>
> *"UE must become a workflow system, not a feature system."*

---

## 1. Routes Removed

**Total route files deleted: 624**

### Phase 0+1 — Security + Hard Cleanup (14 files)

| Removed Route | Reason |
|---|---|
| `/api/v1/claims` | Legacy v1 endpoint |
| `/api/v1/reports/membership` | Misnamed — CRUD on claims masquerading as membership report |
| `/api/v2/v1/claims` | v2 mirror of legacy v1 |
| `/api/v2/v1/reports/membership` | v2 mirror of legacy v1 |
| `/api/cba/[id]` | Consolidated under `/api/cbas` |
| `/api/cba/clauses/compare` | Moved to `/api/clause-library/compare` |
| `/api/cba/footnotes/[clauseId]` | Merged into CBA detail |
| `/api/cba/precedents` | Moved to `/api/precedents` |
| `/api/cba/search` | Duplicate of `/api/cbas` |
| `/api/messaging/preferences` | Merged into notifications |
| `/api/organization/current` | Merged into `/api/org` |
| `/api/organization/switch` | Dead stub — no logic |
| `/api/payments/webhooks/stripe` | Consolidated into `/api/payments/webhooks` |
| `/api/user/status` | Replaced by session endpoint |

### Phase 2 — Financial Surface Consolidation (38 files)

| Removed Route | Reason |
|---|---|
| `/api/financial/reports/aged-receivables` | Consolidated into billing reports |
| `/api/financial/reports/balance-sheet` | Consolidated into billing reports |
| `/api/financial/reports/cash-flow` | Consolidated into billing reports |
| `/api/financial/reports/income-statement` | Consolidated into billing reports |
| `/api/v2/billing/*` (8 files) | v2 mirror — identical copy of root billing |
| `/api/v2/dues/*` (16 files) | v2 mirror — identical copy of root dues |
| `/api/v2/financial/*` (6 files) | v2 mirror — identical copy of root financial |
| `/api/v2/payments/*` (4 files) | v2 mirror — identical copy of root payments |

### Phase 4 — API Duplicate Consolidation (4 files)

| Removed Route | Reason |
|---|---|
| `/api/messaging/campaigns` | Duplicate of `/api/messages` — same DB table |
| `/api/messaging/campaigns/[id]` | Duplicate of `/api/messages/[id]` |
| `/api/messaging/campaigns/[id]/send` | Merged into messages workflow |
| `/api/strike-fund/applications` | Merged into `/api/strike/fund` |

### Phase 9 — v2 Mirror Wholesale Deprecation (568 files)

All remaining `/api/v2/*` routes removed. These were wholesale copies of root API routes operating on the same tables with identical auth. A catch-all deprecation handler now intercepts v2 traffic, returns RFC 8594 `Deprecation` + `Sunset` headers, and logs usage.

---

## 2. Routes Merged (Mapping)

| Deprecated Path | Canonical Path | Phase |
|---|---|---|
| `/api/v1/*` | `/api/*` | 1 |
| `/api/v2/*` (568 routes) | `/api/*` (strip `/v2` prefix) | 9 |
| `/api/cba/search` | `/api/cbas` | 1 |
| `/api/cba/[id]` | `/api/cbas/[id]` | 1 |
| `/api/cba/precedents` | `/api/precedents` | 1 |
| `/api/cba/clauses/compare` | `/api/clause-library/compare` | 1 |
| `/api/organization/switch` | `/api/org/switch` | 1 |
| `/api/organization/current` | `/api/org` | 1 |
| `/api/payments/webhooks/stripe` | `/api/payments/webhooks` | 1 |
| `/api/messaging/preferences` | `/api/notifications/preferences` | 1 |
| `/api/user/status` | `/api/auth/session` | 1 |
| `/api/financial/reports/*` | `/api/billing/reports` | 2 |
| `/api/messaging/campaigns/*` | `/api/messages/*` | 4 |
| `/api/strike-fund/applications` | `/api/strike/fund` | 4 |
| `/api/financial/budgets` | `/api/billing/reports` | 9 |

Full mapping available at runtime: `GET /api/deprecations`

---

## 3. Unified FSM Model

**Before:** 4 parallel FSMs with overlapping states and conflicting vocabulary:

| FSM | States | Location |
|---|---|---|
| Case Workflow | 10 states | `lib/services/case-workflow-fsm.ts` |
| Claim Workflow | 8 states | `lib/services/claim-workflow-fsm.ts` ⚠️ deprecated |
| Grievance State Machine | 10 states (2 paths) | `lib/workflows/grievance-state-machine.ts` ⚠️ deprecated |
| Case FSM Enforcement | 14 states (CUPE vocab) | `lib/case-fsm-enforcement.ts` ⚠️ deprecated |

**After:** Single unified lifecycle (`lib/workflow/case-lifecycle.ts`):

```
draft → submitted → triage → investigation → negotiation
                                    ↓ (docs needed)
                              pending_docs
                                    ↓
                 negotiation → mediation → arbitration → resolved → closed
```

**10 states** with meta-fields replacing sub-states:
- `resolution_type`: `'settled'` | `'denied'` | `'withdrawn'` — replaces separate resolved/rejected/withdrawn states
- `assigned_to`: steward/officer assignment — replaces `'assigned'` state
- `intake_outcome`: `'converted'` | `'closed_no_case'` — replaces intake-only states

**Transition enforcement:** Role-based permission, signal-aware blocking, SLA compliance, required documentation checks, minimum time-in-state.

**State Bridge** (`lib/workflow/state-bridge.ts`): Bidirectional mapping between all 4 legacy FSMs and the unified lifecycle for gradual migration.

---

## 4. Navigation Structure

**10 sidebar sections** with role-based progressive disclosure:

### Platform Tier (Nzila operators)

| Section | Items | Roles |
|---|---|---|
| **Nzila Platform** | Platform Home, Operations, Customer Success, Support, Analytics, Billing, Integrations, Security, Content | `app_owner`, `coo`, `cto`, platform staff |
| **Administration** | Organizations, Governance, Members, Rewards, Reports, Compliance, Sector Analytics, Data Sources, Pilot | `app_owner`, `coo`, `cto`, platform staff |

### Organization Tier (Union users)

| Section | Items | Roles |
|---|---|---|
| **Your Union** | Dashboard, My Cases, New Case, Messages, Rewards, AI Assistant | All union roles |
| **Participation** | Communications, Education, Voting, Agreements, Calendar | All union roles |
| **Casework** | Case Queue, Deadlines, Grievances, Bargaining, H&S, Dispatch, Organizing, Targets, Alerts | Steward+ |
| **Intelligence** | Insights, CBA Intelligence, Precedents, Clause Library, AI Insights, Movement Insights, Cross-Union, Leadership, Executive | Steward+ / Leadership |
| **Finance** | Dues, Pension, Financial Mgmt, Billing, Strike Fund, Dues Admin, Pension Admin, Trustee Portal | All union (view) / Leadership (manage) |
| **Manage** | Members, Stewards, Governance, Audits, Structure | Steward+ / Admin |

### Federation/CLC Tier

| Section | Items | Roles |
|---|---|---|
| **Federation/CLC Services** | Cross-Union Analytics, Precedents, Clause Library, Affiliates, Compliance, Sector Analytics | CLC/Federation roles |
| **CLC National** | Dashboard, Affiliates, Staff, Compliance, Intelligence | `clc_staff`, `clc_executive` |
| **Provincial Federation** | Dashboard, Affiliates, Remittance Tracking | `fed_staff`, `fed_executive` |

### System Tier

| Section | Items | Roles |
|---|---|---|
| **System** | Admin, Preferences | All roles |

**Key design:** Sections use `defaultOpen: false` for non-primary groups (Intelligence, Finance, Manage) to reduce cognitive load. CBA Intelligence conditional on org type.

---

## 5. RBAC Authority Model

### 8-Tier Role Hierarchy (39 roles)

```
Tier 1 — Nzila (Platform Operations)
  app_owner, coo, cto, platform_lead, customer_success_director,
  support_manager, data_analytics_manager, billing_manager,
  integration_manager, compliance_manager, security_manager,
  support_agent, data_analyst, billing_specialist,
  integration_specialist, content_manager, training_coordinator

Tier 2 — System Admin
  system_admin

Tier 3 — CLC National
  clc_executive, clc_staff

Tier 4 — Federation
  fed_executive, fed_staff

Tier 5 — Union National
  national_officer

Tier 6 — Local Union Executive
  president, vice_president, secretary_treasurer, chief_steward, officer

Tier 7 — Representatives
  steward, bargaining_committee, health_safety_rep

Tier 8 — Base
  member, guest
```

### API Auth Wrappers

| Wrapper | Status | Usage |
|---|---|---|
| `withApi` | **Active** — unified framework | ~150+ routes |
| `crudRoutes` | **Active** — CRUD factory | ~300+ routes |
| `withRoleAuth` | ⚠️ Deprecated (Phase 7) | ~80 routes |
| `withApiAuth` | ⚠️ Deprecated (Phase 7) | ~60 routes |
| `withOrganizationAuth` | ⚠️ Deprecated (Phase 7) | ~40 routes |
| `withAdminAuth` | ⚠️ Deprecated (Phase 7) | ~30 routes |

### Entitlement Gates (8 modules)

| Module | Gated Routes |
|---|---|
| `governance_suite` | Governance (board packets, policies, elections, reserved matters) |
| `grievance_case_suite` | Case management, export, intake |
| `financial_intelligence_suite` | Billing, dues, financial reports, members/dues |
| `ai_advanced_insights` | AI analysis, advanced insights |
| `allocation_engine` | Resource allocation |
| `transaction_fees` | Payment processing |
| `commercial_reporting` | CBA intelligence, commercial reports |
| `export_suite` | Data export |

### Audit Logging Coverage (Phase 8)

| Surface | Audit Function | Coverage |
|---|---|---|
| Governance mutations | `auditDataMutation()` | ✅ All 4 governance POST handlers |
| CBA intelligence mutations | `auditDataMutation()` | ✅ Sources POST |
| Case intake | `auditDataMutation()` | ✅ Intake POST |
| Member list access (PII) | `auditDataAccess()` | ✅ Members GET |
| Case export | `auditCaseExport()` | ✅ Custom audit function |
| Deprecated route access | `logDeprecatedAccess()` | ✅ All v2 + budget stubs |

---

## 6. Cleanup % Reduction

### Route Surface

| Metric | Before | After | Δ |
|---|---|---|---|
| Total route files | 1,342 | 718 | **−624 (−46.5%)** |
| v2 mirror routes | 604 | 1 (catch-all) | **−603 (−99.8%)** |
| v1 legacy routes | 2 | 0 | **−2 (−100%)** |
| Duplicate/dead stubs | 18 | 0 | **−18 (−100%)** |

### Code Changes Across All Phases

| Phase | Files | Insertions | Deletions | Net |
|---|---|---|---|---|
| 0+1 Security + Cleanup | 27 | +175 | −493 | −318 |
| 2 Financial Consolidation | 47 | +175 | −1,040 | −865 |
| 3 FSM Unification | 6 | +592 | 0 | +592 |
| 4 API Dedup | 8 | +11 | −216 | −205 |
| 5 Navigation Redesign | 5 | +68 | −39 | +29 |
| 6 Portal Consolidation | 12 | +57 | −2,676 | −2,619 |
| 7 RBAC Realignment | 12 | +129 | −251 | −122 |
| 8 Audit Logging | 7 | +96 | −39 | +57 |
| 9 Deprecation System | 572 | +160 | −~18,000 | **−~17,840** |
| **Total** | **~696** | **~1,463** | **~22,754** | **−~21,291** |

### Architectural Reduction

| Dimension | Before | After |
|---|---|---|
| FSM implementations | 4 (conflicting) | 1 (unified) |
| API auth wrappers | 5 (inconsistent) | 2 (`withApi` + `crudRoutes`) |
| Financial API prefixes | 6 (`billing`, `dues`, `finance`, `financial`, `payments`, `stripe`) | 3 (`billing`, `dues`, `payments`) |
| API versioning schemes | 3 (`/v1`, `/v2`, root) | 1 (root only) |
| Deprecated auth wrappers | 0 (unmarked) | 4 (marked `@deprecated`) |
| Entitlement-gated routes | Partial | Comprehensive |
| Audit-logged mutations | Case intake only | All governance + CBA + PII access |
| Cron routes with auth | 4/10 | 10/10 |

---

## 7. Risk Items Remaining

### HIGH

| # | Risk | Mitigation |
|---|---|---|
| 1 | **210 legacy-wrapper routes** still use deprecated `withRoleAuth`/`withApiAuth`/`withOrganizationAuth`/`withAdminAuth` | Migrate incrementally to `withApi` — deprecated wrappers are functional, just not unified |
| 2 | **`/api/metrics/operational`** uses legacy `requireApiAuth()` + service-key pattern | Migrate to `withApi({ auth: { cron: true } })` or proper service auth |
| 3 | **Sidebar overloaded** for officer+ roles (38+ items) | Target: workflow-first 7-section layout (Inbox, Work, Priorities, Intelligence, Outcomes, Knowledge, Admin) — would be a new feature |

### MEDIUM

| # | Risk | Mitigation |
|---|---|---|
| 4 | **3 deprecated FSMs** still exist in codebase | State bridge provides backward compat; remove after all consumers migrate to `case-lifecycle.ts` |
| 5 | **Portal/Dashboard overlap** — 7 pages duplicated | Portal pages consolidated in Phase 6 but some dashboard equivalents remain |
| 6 | **`/api/messaging/templates`** — operational but addressed same domain as deleted campaigns | Monitor usage — may be candidate for future consolidation |
| 7 | **Contact/pilot/test-auth** — unauthenticated routes | Public by design (contact form, pilot application, auth testing) — document and monitor |

### LOW

| # | Risk | Mitigation |
|---|---|---|
| 8 | **Old CLERK_* env vars** on Container Apps | Unused — clean up when convenient |
| 9 | **Sunset date (2026-07-07)** for v2 catch-all | Remove catch-all after sunset; monitor `api.deprecated_access` audit entries for remaining consumers |
| 10 | **Schema deprecations** (`clc-per-capita`, `organization-members`) | Already marked `@deprecated` in JSDoc — remove after migration verified |

---

## Commit Chain

```
efa37c3a  (baseline)
    ↓
fb2af5d9  Phase 0+1 — Security + Hard Cleanup
    ↓
c3b19859  Phase 2 — Financial Surface Consolidation
    ↓
db7d997e  Phase 3 — Workflow FSM Unification
    ↓
2eea2dae  Phase 4 — API Duplicate Consolidation
    ↓
2d96573c  Phase 5 — Navigation Redesign
    ↓
490cf254  Phase 6 — Portal Consolidation
    ↓
f359f436  Phase 7 — RBAC Realignment
    ↓
cc1278f9  Phase 8 — Governance Audit Logging & Entitlement Gates
    ↓
[pending]  Phase 9 — Deprecation System + Phase 10 Output
```

---

*Union Eyes is now a workflow system.*
