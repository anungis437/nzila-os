# UnionEyes — Workflow Realignment Discovery Audit

> **Date**: 2026-04-09  
> **Scope**: `apps/union-eyes/` — read-only inspection  
> **Codebase HEAD**: `efa37c3a` (main)  
> **Purpose**: Produce the exact information needed to redesign UE around workflow-first architecture, endpoint cleanup, role-aware navigation, authority-based access control, and progressive disclosure from local → federation → CLC.

---

## Section 1 — API Surface Inventory

### 1.1 Route Count Summary

| Metric | Count |
|--------|-------|
| Total `route.ts` files | ~1,340 |
| Unique API path prefixes (top-level) | ~130+ |
| Root `/api/` routes | ~730 |
| `/api/v2/` mirror routes | ~604 |
| `/api/v1/` legacy routes | 2 |
| Cron routes (`/api/cron/`) | 10 |

### 1.2 Auth Wrapper Distribution

| Wrapper | Approx. Routes | Description |
|---------|---------------|-------------|
| `crudRoutes` | ~300+ | Auto-generated CRUD with org-scoping |
| `withApi` | ~150+ | Modern wrapper, entitlement-aware |
| `withRoleAuth` | ~80+ | Role enforcement |
| `withApiAuth` | ~60+ | Basic auth required |
| `withOrganizationAuth` | ~40+ | Org-aware auth |
| `withAdminAuth` | ~30+ | Admin-only |
| `requireApiAuth` | ~20+ | Custom auth |
| `auth()` | ~15+ | NextAuth direct |
| `CRON_SECRET` | ~5 | Background jobs (proper) |
| `withApi({ auth: { required: false } })` | ~5 | Cron stubs (NO AUTH) |
| None | ~5+ | Bare exports |

### 1.3 Routes by Business Domain

| Domain | Approx. Routes | Key Prefixes |
|--------|---------------|-------------|
| Claims / Cases / Grievances | 30+ | `/api/claims`, `/api/cases`, `/api/grievances` |
| CBA & Intelligence | 25+ | `/api/cba`, `/api/cbas`, `/api/cba-intelligence` |
| Bargaining & Contracts | 20+ | `/api/bargaining`, `/api/bargaining-notes`, `/api/contracts` |
| Arbitration & Precedents | 10+ | `/api/arbitration` |
| Dues & Remittances | 30+ | `/api/dues`, `/api/admin/dues`, `/api/admin/clc/remittances` |
| Billing & Finance | 20+ | `/api/billing`, `/api/finance`, `/api/financial` |
| Payments & Stripe | 10+ | `/api/payments`, `/api/stripe` |
| Pension & Benefits | 10+ | `/api/pension`, `/api/ai/pension` |
| Analytics | 30+ | `/api/analytics/*` |
| AI / Intelligence | 15+ | `/api/ai/*` |
| Voting & Elections | 10+ | `/api/voting`, `/api/elections` |
| Members & Users | 20+ | `/api/members`, `/api/users`, `/api/admin/users`, `/api/admin/members` |
| Organizations | 15+ | `/api/organizations`, `/api/org`, `/api/organization`, `/api/admin/organizations` |
| Documents & Content | 15+ | `/api/documents`, `/api/content` |
| Communications | 15+ | `/api/communications`, `/api/messages`, `/api/messaging` |
| Notifications & Alerts | 15+ | `/api/notifications`, `/api/admin/alerts` |
| Compliance & Audits | 10+ | `/api/audits`, `/api/compliance` |
| Admin & System | 25+ | `/api/admin/*` |
| Workflow | 5+ | `/api/workflow`, `/api/workbench` |
| Health / Safety | 10+ | `/api/health-safety`, `/api/wcb` |
| PKI / Signatures | 10+ | `/api/admin/pki` |
| Cron / Background | 10+ | `/api/cron/*` |
| Misc | 30+ | breaks, worksites, consent, chatbot, voice, calendar-sync, cope, dispatch, carbon, emergency |

### 1.4 Decision-Layer Classification

| Layer | Route Examples | Count |
|-------|---------------|-------|
| **Signal Ingestion** | `/api/claims` POST, `/api/grievances` POST, `/api/dispatch/requests` POST, `/api/pilot/apply` POST | ~20 |
| **Decision Creation** | `/api/workflow/transition` POST, `/api/ai/grievances/triage` POST, `/api/ai/classify` POST, `/api/workbench/assign` POST | ~15 |
| **Execution** | `/api/dues/calculate` POST, `/api/billing/send-invoice` POST, `/api/voting/sessions/[id]/vote` POST, `/api/payments` POST | ~40 |
| **Intelligence** | `/api/analytics/*` GET, `/api/ai/insights/*` GET, `/api/cba-intelligence/*`, `/api/movement-insights` GET | ~60 |
| **Feedback** | `/api/satisfaction/*`, `/api/communications/track/*`, `/api/notifications` GET | ~15 |
| **Support/Admin** | `/api/admin/*`, `/api/settings/*`, `/api/vocabulary/*`, `/api/health`, `/api/cron/*` | ~80 |
| **CRUD (unclassified)** | Most `crudRoutes` scaffolded routes | ~500+ |

### 1.5 Entitlement-Gated Routes

| Entitlement | Routes | Purpose |
|-------------|--------|---------|
| `commercial_reporting` | ~15 | CBA Intelligence pipeline |
| `financial_intelligence_suite` | ~20 | Analytics, billing, financial reports |
| `ai_advanced_insights` | ~5 | AI classify, employer risk |
| `grievance_case_suite` | ~5 | Grievance detail access |

---

## Section 2 — Page / UI Surface Inventory

### 2.1 Page Count Summary

| Group | Count | Auth Level |
|-------|-------|------------|
| Auth pages (sign-in/up) | 2 | Public |
| Marketing pages | 10+ | Public |
| Member Portal | 10 | `auth()` — userId required |
| Dashboard pages | 70+ | `requireUser()` + role checks |
| Mobile pages | 3 | `requireUser()` |
| Other (surveys, api-docs, docs) | 5 | Mixed |
| **Total** | **~100+** | — |

### 2.2 Pages by Audience Tier

| Tier | Pages | Roles | Example Routes |
|------|-------|-------|---------------|
| **Public** | ~12 | none | `/pricing`, `/story`, `/legal/*`, `/contact`, `/status` |
| **All Members** | ~15 | `member+` | `/portal/*`, `/dashboard/claims`, `/dashboard/pension`, `/dashboard/dues`, `/dashboard/voting` |
| **Representatives** | ~12 | `steward+` | `/dashboard/workbench`, `/dashboard/members`, `/dashboard/precedents`, `/dashboard/clause-library` |
| **Leadership** | ~15 | `officer+` | `/dashboard/executive`, `/dashboard/bargaining`, `/dashboard/financial`, `/dashboard/organizing` |
| **Exec / Admin** | ~10 | `president+`, `admin`, `system_admin` | `/dashboard/governance`, `/dashboard/audits`, `/dashboard/structure`, `/dashboard/settings` |
| **CLC / Federation** | ~5 | `clc_executive`, `fed_executive` | `/dashboard/clc`, `/dashboard/cross-union-analytics`, `/dashboard/movement-insights` |
| **Platform (Nzila)** | ~15 | `NZILA_ROLES` (18 roles) | `/dashboard/operations`, `/dashboard/customer-success`, `/dashboard/billing-admin`, `/dashboard/security` |

### 2.3 Member Portal vs Dashboard Overlap

| Function | Portal Route | Dashboard Route | Status |
|----------|-------------|-----------------|--------|
| My Cases | `/portal/claims` | `/dashboard/claims` | **DUPLICATE** — same function, different layout |
| Documents | `/portal/documents` | (no dashboard equivalent) | Portal only |
| Dues | `/portal/dues` | `/dashboard/dues` | **DUPLICATE** |
| Messages | `/portal/messages` | `/dashboard/messages` | **DUPLICATE** |
| Profile | `/portal/profile` | `/dashboard/profile` | **DUPLICATE** |
| Settings | `/portal/settings` | `/dashboard/settings` | Different scope (personal vs org) |
| Notifications | `/portal/notifications` | `/dashboard/notifications` | Different (personal vs alert mgmt) |

### 2.4 Dashboard Distribution

```
/dashboard (hub - role classifier)
├── Platform Operations (Nzila) ────── 8 pages
├── Administration ─────────────────── 10 pages
├── Union Member ────────────────────── 10 pages
├── Representative Tools ────────────── 12 pages
├── Leadership ──────────────────────── 15 pages
├── CLC / Federation ────────────────── 5 pages
├── Executive ───────────────────────── 4 pages
├── Specialized Committees ──────────── 2 pages
├── Settings / Profile ──────────────── 6 pages
└── Misc (pilot, mobile, reports) ──── 5 pages
```

---

## Section 3 — RBAC / Authority Model Audit

### 3.1 Complete Role Hierarchy

```
Tier 1 — Nzila Ventures (Platform Operations)
  300  app_owner (CEO)
  295  coo
  290  cto
  270  platform_lead
  260  customer_success_director
  250  support_manager
  240  data_analytics_manager
  235  billing_manager
  230  integration_manager
  225  compliance_manager
  220  security_manager
  218  support_agent
  215  data_analyst
  212  billing_specialist
  210  integration_specialist
  208  content_manager
  205  training_coordinator

Tier 2 — System / Cross-Org
  200  system_admin

Tier 3 — CLC National / Federation
  190  clc_executive
  180  clc_staff
  170  fed_executive
  160  fed_staff

Tier 4 — Union National
  150  national_officer

Tier 5 — Local Union
  140  president
  135  vice_president
  130  secretary_treasurer
  120  chief_steward
  110  officer

Tier 6 — Representatives
   50  steward
   45  bargaining_committee

Tier 7 — Specialized
   30  health_safety_rep

Tier 8 — Base
   20  member

Legacy (deprecated): guest, congress_staff→clc_staff, federation_staff→fed_staff, union_rep→steward, staff_rep→steward
```

### 3.2 Permission Categories (~100+ permissions)

| Category | Count | Examples |
|----------|-------|---------|
| App Operations | 15 | platform_health, incident_management, release_management, capacity_planning, sla_monitoring |
| Customer Success | 6 | customer_health, churn_prevention, onboarding_management |
| Support | 6 | ticket_management, agent_assignment, knowledge_base |
| Data & Analytics | 6 | cross_org_analytics, platform_analytics, custom_reports |
| Billing | 6 | subscription_management, invoicing, revenue_reporting |
| Integration | 6 | api_key_management, webhook_management, partner_integrations |
| Compliance | 6 | audit_logs, compliance_reports, gdpr_management |
| Security | 6 | security_alerts, access_audit, threat_monitoring |
| Content | 6 | template_management, training_management |
| Strategic | 5 | executive_dashboard, strategic_roadmap, partnership_management |
| Union Application | 40+ | claims, members, voting, cba, financial, governance, h&s, analytics |

### 3.3 Page Visibility Matrix by Role Group

| Section | member | steward | officer | president | admin | clc | nzila |
|---------|--------|---------|---------|-----------|-------|-----|-------|
| Portal | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| My Cases / Pension / Dues | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Voting / Education / Calendar | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Workbench / Members Dir | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Clause Library / Precedents | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Health & Safety | ✗ | ✓* | ✓ | ✓ | ✓ | ✗ | ✗ |
| Communications | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Grievances / Bargaining / Financial | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Executive Dashboard | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ |
| Governance / Audits / Structure | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| CLC Dashboard / Cross-Union | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| Movement Insights | ✗ | ✗ | ✓† | ✓† | ✓† | ✓ | ✗ |
| Platform Operations | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Platform Admin | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

*`✓*` = health_safety_rep also gets access  
`✓†` = national_officer and admin also qualify

### 3.4 API Access Matrix by Role Group

| API Domain | member | steward | officer | admin | clc+ | nzila |
|------------|--------|---------|---------|-------|------|-------|
| Claims (read own) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Claims (write/assign) | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Workflow transitions | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Members directory | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Analytics (general) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Analytics (financial) | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| AI insights | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Pension admin | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ |
| Audit logs | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ |
| Feature flags | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ |
| Role management | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ |
| Platform admin | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

### 3.5 RBAC Mismatches

| Finding | Severity | Detail |
|---------|----------|--------|
| `/api/admin/members/stats` accepts any authenticated user | HIGH | No admin/steward role check — any `userId` gets cross-org stats |
| `/api/organizations/[id]` PATCH/DELETE accepts any authenticated user | CRITICAL | No membership or admin check — any user can modify/archive ANY org |
| `/api/organizations/[id]/members` POST accepts any authenticated user | CRITICAL | Any user can add members to any org |
| `/api/cbas` POST accepts `organizationId` from request body | HIGH | No validation that caller belongs to that org |
| `/api/claims/[id]/workflow/history` has no org scoping | MEDIUM | Cross-org data leak on workflow history |
| `admin/update-role` only requires `steward` | MEDIUM | Stewards can change roles — should require `admin+` |
| `admin/fix-super-admin-roles` only requires `steward` via crudRoutes | HIGH | Critical system operation under-protected |

---

## Section 4 — Workflow Mapping Audit

### 4.1 Lifecycle State Machines Found

| FSM | File | States | Transitions | Domain |
|-----|------|--------|-------------|--------|
| **Case FSM** | `lib/workflow/case-workflow-fsm.ts` | 10 | draft→submitted→acknowledged→investigating→pending_response→negotiating→escalated→resolved→withdrawn→closed | Case lifecycle |
| **Claim FSM** | `lib/workflow/claim-workflow-fsm.ts` | 8 | submitted→under_review→assigned→investigation→pending_documentation→resolved→rejected→closed | Claim lifecycle |
| **Workflow Engine** | `lib/workflow/workflow-engine.ts` | 8 | Same as Claim FSM | DUPLICATE of Claim FSM |
| **Grievance SM** | `lib/workflow/grievance-state-machine.ts` | 10 | Intake: draft→converted/closed_no_case; Case: new→triage→investigation→negotiation→arbitration→resolved→closed | Grievance lifecycle |
| **PKI Workflow** | `services/pki/workflow-engine.ts` | 4 | pending→in_progress→completed→skipped | Signature workflows |
| **Automation Engine** | `lib/workflow/workflow-automation-engine.ts` | — | Maps stage types → Claim FSM statuses | Orchestrator |

### 4.2 Critical Workflow Observation

**THREE overlapping FSMs model the same grievance/case domain:**

```
                    Case FSM (10 states)
                   ┌─────────────────────┐
                   │ draft → submitted → │
                   │ acknowledged →      │
                   │ investigating →     │
                   │ pending_response →  │
                   │ negotiating →       │
                   │ escalated →         │
                   │ resolved/withdrawn/ │
                   │ closed              │
                   └─────────────────────┘
                         ▲ OVERLAPS ▼
                   ┌─────────────────────┐
                   │ submitted →         │
                   │ under_review →      │    Claim FSM (8 states)
                   │ assigned →          │    + Workflow Engine (DUPLICATE)
                   │ investigation →     │
                   │ pending_documentation →
                   │ resolved/rejected/  │
                   │ closed              │
                   └─────────────────────┘
                         ▲ OVERLAPS ▼
                   ┌─────────────────────┐
                   │ draft → converted / │
                   │ closed_no_case      │    Grievance SM (10 states)
                   │ new → triage →     │
                   │ investigation →     │
                   │ negotiation →       │
                   │ arbitration →       │
                   │ resolved → closed   │
                   └─────────────────────┘
```

**Impact**: Same entity (a union member's workplace issue) flows through 3 different state models with different naming, different transition rules, and different role gates. This is the primary source of domain confusion and the highest-priority refactor target.

### 4.3 Workflow-to-Target Architecture Mapping

| Target Workflow Stage | Current Implementation | Status |
|----------------------|----------------------|--------|
| **Signal Ingestion** | `/api/claims` POST, `/api/grievances` POST, `/api/dispatch/requests` POST | Fragmented across 3 endpoints |
| **Decision (Triage)** | `/api/ai/grievances/triage` POST, `/api/workflow/transition` POST | Two entry points |
| **Execution** | `/api/workbench/assign` POST, claim FSM transitions, workflow-engine transitions | Partially unified |
| **Intelligence** | `/api/analytics/*`, `/api/ai/insights/*`, `/api/cba-intelligence/*` | Well-developed but scattered |
| **Feedback** | `/api/satisfaction/*`, SLA watchdog cron | Minimal |

---

## Section 5 — Navigation Complexity Audit

### 5.1 Sidebar Items Per Role

| Role | Sidebar Sections Visible | Approx. Nav Items | Assessment |
|------|------------------------|-------------------|------------|
| `member` | Your Union, Participation | ~13 | Acceptable |
| `steward` | Your Union, Participation, Representative Tools | ~25 | Borderline overload |
| `officer` | Your Union, Participation, Rep Tools, Leadership | ~38 | **OVERLOADED** |
| `president` | All union + Executive | ~42 | **OVERLOADED** |
| `admin` | All union + Executive + Admin | ~48 | **SEVERELY OVERLOADED** |
| `system_admin` | All union + Executive + Admin | ~48 | **SEVERELY OVERLOADED** |
| `clc_executive` | Rep Tools, Leadership, CLC sections | ~20 | Acceptable |
| `app_owner` (Nzila) | Platform Ops + Administration | ~17 | Acceptable |

### 5.2 Navigation Overload Findings

| Finding | Detail |
|---------|--------|
| **Officer+ sees 38+ items** | No progressive disclosure — all sections expanded at once |
| **"Leadership" section has 14 items** | Grievances, Bargaining, Financial, Targets, Organizing, Strike Fund, Alerts, Pension Admin, Trustee, Dues Admin, Leadership Dashboard, AI Insights, Movement Insights, Billing |
| **"Representative Tools" has 11 items** | Case Queue, Deadlines, Members, Clause Library, CBA Intelligence, Precedents, H&S, Analytics, Dispatch, Stewards, Cross-Union Analytics |
| **No workflow-first grouping** | Items grouped by functional area (finance, people, cases) rather than workflow stage (inbox, work in progress, outcomes) |
| **Duplicate navigation paths** | Portal nav (8 items) overlaps dashboard nav for member functions |
| **Mobile nav is separate** | 3 mobile pages (`/mobile`, `/mobile/members`, `/mobile/claims`) not integrated with main nav |

### 5.3 Buried Pages

| Page | Why It's Buried | Impact |
|------|----------------|--------|
| `/dashboard/deadlines` | Listed under Rep Tools, not prominently visible | Missed SLA deadlines |
| `/dashboard/compliance` vs `/dashboard/compliance-admin` | Two separate compliance pages in different sections | Confusion |
| `/dashboard/targets` | Under Leadership, not visible to stewards who need targets | Goal misalignment |
| `/dashboard/insights` vs `/dashboard/movement-insights` | Two "insights" pages in different sections | Discovery friction |
| `/dashboard/finance` vs `/dashboard/financial` | Two "financial" pages — one for billing, one for management | Naming confusion |

### 5.4 Merge Candidates

| Candidate A | Candidate B | Rationale |
|-------------|-------------|-----------|
| `/portal/*` (8 pages) | `/dashboard/*` member pages | Same functions, different shells |
| `/dashboard/finance` | `/dashboard/financial` | Same domain, confusing names |
| `/dashboard/compliance` | `/dashboard/compliance-admin` | Same domain |
| `/dashboard/insights` | `/dashboard/movement-insights` | Both are intelligence views |
| `/dashboard/analytics` | `/dashboard/analytics-admin` | Same domain, different scope |

---

## Section 6 — Duplication / Cleanup Audit

### 6.1 API Duplication Registry

| Pair | Classification | Evidence | Action |
|------|---------------|----------|--------|
| `/api/claims` + `/api/cases` | **DUPLICATE** — same DB table | `cases/route.ts`: "Cases are claims viewed from steward workbench" | Merge: single `/api/cases` with view parameter |
| `/api/cba/search` + `/api/cbas` | **DUPLICATE** — same collectiveAgreements table | Both do CRUD on same table | Merge: use `/api/cbas` only |
| `/api/payments/webhooks/stripe` + `/api/stripe/webhooks` | **DUPLICATE** — two Stripe webhook handlers | Nearly identical code, different secrets | Merge: single webhook endpoint |
| `/api/org/current` + `/api/organization/current` | **DUPLICATE** — both return current org | Different implementations, same purpose | Merge: keep `/api/org/current` |
| `/api/org/switch` + `/api/organization/switch` | **DUPLICATE** — one is a stub | `/api/organization/switch` returns `{ action: 'switch', status: 'accepted' }` with no logic | Delete stub |
| `/api/messaging/campaigns` + `/api/messages/threads` | **DUPLICATE** — same messageThreads table | crudRoutes on same table | Merge: keep `/api/messages` |
| `/api/v2/*` (604 routes) + `/api/*` (730 routes) | **FULL MIRROR** | v2 is a wholesale copy of root API | Determine canonical, delete other |
| `/api/v1/*` (2 routes) | **DEAD** | Legacy claims CRUD, unused | Delete |
| `/api/v2/v1/*` | **DEAD** | Triple-nested version prefix copy | Delete |
| Claim FSM + Workflow Engine | **CODE DUPLICATE** | Same transition map defined in two files | Merge into single FSM |

### 6.2 Broken/Misnamed Routes

| Route | Issue | Severity |
|-------|-------|----------|
| `/api/messaging/templates` | Routes to `messageThreads` table instead of `messageTemplates` | **BROKEN** — wrong data |
| `/api/v1/reports/membership` | Claims CRUD masquerading as membership report | **MISNAMED** |
| `/api/financial/budgets` | CRUD on `perCapitaRemittances`, not budgets | **MISNAMED** |
| `/api/user/status` | Generic CRUD on `users` table, not a status endpoint | **MISPLACED** |

### 6.3 Stubs / Dead Routes

| Route | Evidence |
|-------|----------|
| `/api/clause-library/compare` GET | Returns "Use POST with clauseIds array" |
| `/api/organization/switch` POST | Returns `{ action: 'switch', status: 'accepted' }` — no implementation |
| `/api/metrics/operational` | Returns placeholder for `request_count` |
| `/api/strike-fund/applications` | Returns a "queued placeholder" |

### 6.4 Financial Surface Fragmentation

The financial domain is split across **6 different API prefixes**:

```
/api/billing/       → External SaaS billing (invoices, subscriptions, credits)
/api/dues/          → Union dues lifecycle (calculate, arrears, remittances)
/api/finance/       → Platform economics (billing accounts, chargebacks, allocations)
/api/financial/     → Misnamed catch-all (actually perCapitaRemittances)
/api/payments/      → Stripe checkout + webhooks
/api/stripe/        → Stripe Connect webhooks (DUPLICATE of payments/webhooks)
```

**Recommendation**: Consolidate to 3 prefixes maximum: `/api/billing` (platform SaaS), `/api/dues` (union dues), `/api/payments` (payment processing).

### 6.5 Cleanup Impact Assessment

| Item | Routes Removable | Effort |
|------|-----------------|--------|
| Delete `/api/v1/` | 2 | Trivial |
| Delete `/api/v2/` mirror | 604 | Medium — verify no clients use `/api/v2/` paths |
| Merge duplicate endpoints | ~10 pairs | Medium — update all callers |
| Fix broken routes | 4 | Low |
| Delete stubs | 4 | Trivial |
| **Total removable** | **~620+ routes** | — |

---

## Section 7 — Governance / Safety Alignment

### 7.1 Routes Without Authentication

**CRITICAL — No auth wrapper, bare exports:**

| Route | Methods | Risk |
|-------|---------|------|
| `/api/contact` POST | POST | Contact form — intentional but NOT in public allowlist |
| `/api/docs` GET | GET | OpenAPI docs — no auth, NOT in allowlist |
| `/api/docs/openapi` GET | GET | OpenAPI spec — no auth, NOT in allowlist |
| `/api/pilot/apply` POST | POST | Pilot application — zero auth on POST (GET uses crudRoutes) |
| `/api/ready` GET | GET | K8s probe — intentional but NOT in allowlist |

**CRITICAL — Cron routes without CRON_SECRET:**

| Route | Auth | Risk |
|-------|------|------|
| `/api/cron/monthly-dues` | `withApi({ auth: { required: false } })` | Publicly accessible — no cron secret |
| `/api/cron/scheduled-reports` | `withApi({ auth: { required: false } })` | Publicly accessible — no cron secret |
| `/api/cron/analytics/daily-metrics` | `withApi({ auth: { required: false } })` | Publicly accessible — no cron secret |
| `/api/cron/overdue-notifications` | `withApi({ auth: { required: false } })` | Publicly accessible — no cron secret |
| `/api/cron/process-notifications` | `withApi({ auth: { required: false } })` | Publicly accessible — no cron secret |
| `/api/cron/process-messages` | `withApi({ auth: { required: false } })` | Publicly accessible — no cron secret |

**Note**: These 6 cron routes are stub implementations returning `{ status: 'healthy' }` — not executing business logic. But they are publicly accessible without any authentication.

### 7.2 Routes Missing Organization Scoping

| Route | Method | Impact |
|-------|--------|--------|
| `/api/organizations/[id]` | PATCH, DELETE | Any authed user can modify/archive ANY org |
| `/api/organizations/[id]/members` | POST | Any authed user can add members to any org |
| `/api/cbas` | POST | Creates CBA with unvalidated `organizationId` from body |
| `/api/claims/[id]/workflow/history` | GET | Cross-org data leak — no org filter |
| `/api/organizations/search` | GET | Returns all orgs matching query — no membership scoping |
| `/api/admin/users/[userId]` | PUT, DELETE | No org-level isolation on cross-org user operations |

### 7.3 Sensitive Operations Missing Audit Logging

| Operation | Route | Severity |
|-----------|-------|----------|
| User activation/deactivation | `/api/admin/users/[userId]` PUT | HIGH |
| User soft-delete | `/api/admin/users/[userId]` DELETE | HIGH |
| Organization modification | `/api/organizations/[id]` PATCH | HIGH |
| Organization archival | `/api/organizations/[id]` DELETE | HIGH |
| Role changes | `/api/admin/update-role`, `/api/admin/roles/batch` | HIGH† |
| Member addition to org | `/api/organizations/[id]/members` POST | MEDIUM |
| CBA creation | `/api/cbas` POST | MEDIUM |
| Database optimization | `/api/admin/database/optimize` POST | MEDIUM |
| Org context switch | `/api/organizations/switch` POST | LOW |
| Cache clear | `/api/admin/system/cache` POST | LOW |

†Role changes use `crudRoutes` which provides generic logging, but no explicit `logApiAuditEvent` or `auditDataMutation` call for this critical operation.

### 7.4 Public API Route Allowlist Issues

| Issue | Detail | Severity |
|-------|--------|----------|
| `/api/sentry-example-api` in production allowlist | Marked "DEV ONLY" in comment but still in list | LOW |
| `/api/whop/create-checkout` listed as public | Route actually calls `requireUser()` — config is wrong | LOW |
| 5 routes publicly accessible but NOT in allowlist | `/api/contact`, `/api/docs`, `/api/docs/openapi`, `/api/ready`, `/api/pilot/apply` | MEDIUM |

### 7.5 Cron Security Architecture

- **Pattern**: Per-route inline validation (NOT middleware)
- **Inconsistency**: `/api/cron/sla-watchdog` uses `x-cron-secret` header; all others use `Authorization: Bearer`
- **Gap**: 6 of 10 cron routes are stubs with `auth: { required: false }` — no CRON_SECRET check
- **Risk**: Cron auth is duplicated per-route — easy to miss when adding new routes
- **Recommendation**: Centralize cron auth in middleware or shared utility

### 7.6 Governance Scorecard

| Category | Score | Detail |
|----------|-------|--------|
| Auth Coverage | 95% | 5+ routes with no auth, 5+ with weak auth |
| Org Isolation | 92% | 6 routes with missing org scoping |
| Audit Trail | 85% | 10+ sensitive operations unlogged |
| Public Route Config | 90% | 5 accessible routes not in allowlist, 2 misconfigs |
| Cron Security | 50% | 6/10 cron routes unprotected, inconsistent header |
| Role Enforcement | 88% | 7 RBAC mismatches found |
| **Overall** | **83%** | — |

---

## Section 8 — Target Realignment Readiness

### 8.1 Target Navigation Architecture

The target UE redesign organizes around **7 workflow-first navigation groups**:

| Target Section | Purpose | Current Coverage |
|----------------|---------|-----------------|
| **Inbox** | All signals, intake, new items requiring attention | Fragmented: claims POST, grievances POST, dispatch, notifications |
| **Work** | Active work queue, assigned items, in-progress cases | Partially exists: workbench, deadlines |
| **Priorities** | SLA tracking, overdue items, escalations | Partially exists: deadlines, workflow/overdue, SLA watchdog |
| **Intelligence** | Analytics, AI insights, CBA intelligence, movement insights | Well-developed but scattered across 60+ routes |
| **Outcomes** | Resolved cases, settlements, completed workflows | Partially exists: analytics/claims, financial |
| **Knowledge** | Clause library, precedents, CBAs, education | Partially exists: clause-library, precedents, cba-intelligence, education |
| **Admin** | Settings, roles, org structure, governance, compliance | Exists: settings, admin/*, governance, compliance |

### 8.2 Current-to-Target Page Mapping

| Current Page | Target Section | Migration Complexity |
|-------------|---------------|---------------------|
| `/dashboard/claims` | **Inbox** (member view) / **Work** (steward view) | Medium — split by role |
| `/dashboard/workbench` | **Work** | Low — already workflow-oriented |
| `/dashboard/deadlines` | **Priorities** | Low — rename/move |
| `/dashboard/analytics` | **Intelligence** | Low — move |
| `/dashboard/insights` | **Intelligence** | Low — merge with analytics |
| `/dashboard/movement-insights` | **Intelligence** | Low — merge with analytics |
| `/dashboard/executive` | **Intelligence** (summary) | Medium — repurpose |
| `/dashboard/precedents` | **Knowledge** | Low — move |
| `/dashboard/clause-library` | **Knowledge** | Low — move |
| `/cba-intelligence` | **Knowledge** / **Intelligence** | Medium — split |
| `/dashboard/education` | **Knowledge** | Low — move |
| `/dashboard/settings` | **Admin** | Low — already admin |
| `/dashboard/governance` | **Admin** | Low — move |
| `/dashboard/compliance` | **Admin** | Low — move |
| `/dashboard/members` | **Admin** (directory) | Low — move |
| `/dashboard/bargaining` | **Work** (active) / **Outcomes** (completed) | Medium — split by status |
| `/dashboard/financial` | **Outcomes** (reports) / **Admin** (config) | Medium — split |
| `/dashboard/pension` | **Outcomes** (member) / **Admin** (admin) | Medium — split by role |
| `/dashboard/messages` | **Inbox** | Low — move |
| `/dashboard/notifications` | **Inbox** | Low — move |
| `/dashboard/organizing` | **Work** | Low — move |
| `/dashboard/voting` | **Work** (active) / **Outcomes** (completed) | Medium — split |
| `/dashboard/communications` | **Work** (campaigns) / **Admin** (templates) | Medium — split |

### 8.3 Progressive Disclosure Readiness

| Tier | Current State | Readiness |
|------|-------------|-----------|
| **Local → Federation** | Sidebar has separate `unionAll` vs `clcRoles` arrays | ✅ Role arrays exist — can drive progressive disclosure |
| **Federation → CLC** | `clcRoles` array separates CLC from federation | ✅ Ready |
| **Member → Rep → Leader → Exec** | `hasMinRole()` hierarchy is numeric | ✅ Numeric levels enable graduated disclosure |
| **Org-type awareness** | CBA Intelligence conditionally shown by org type | ⚠️ Partial — only 1 feature is org-type-aware |
| **Entitlement gating** | 4 entitlements control feature access | ⚠️ Partial — entitlements cover only ~45 routes |

### 8.4 Migration Risk Assessment

| Risk | Level | Mitigation |
|------|-------|-----------|
| v2 API mirror must be resolved first | HIGH | Determine canonical surface before restructuring |
| 3 overlapping FSMs need unification | HIGH | Unify into single case lifecycle before UI redesign |
| Financial surface fragmentation (6 prefixes) | MEDIUM | Consolidate API prefixes before building new nav |
| Portal / Dashboard overlap | LOW | Deprecate portal in favor of unified dashboard |
| RBAC mismatches need fixing | HIGH | Fix auth gaps before redesigning access control |
| 620+ routes removable | MEDIUM | Large cleanup batch but mostly mechanical |
| Broken routes (messaging/templates) | LOW | Fix data integrity before migration |

### 8.5 Recommended Realignment Sequence

```
Phase 0 — Safety (prerequisite)
├── Fix 7 RBAC mismatches (org scoping, role checks)
├── Fix 6 unprotected cron routes
├── Add audit logging to 10 sensitive operations
└── Add 5 missing routes to public allowlist

Phase 1 — Cleanup (prerequisite)
├── Delete /api/v1/ (2 routes)
├── Delete /api/v2/ mirror (604 routes)
├── Merge 10 duplicate endpoint pairs
├── Fix 4 broken/misnamed routes
├── Delete 4 stub routes
└── Consolidate financial surface (6 → 3 prefixes)

Phase 2 — Workflow Unification
├── Unify 3 FSMs into single CaseLifecycle state machine
├── Merge /api/claims + /api/cases into /api/cases
├── Establish canonical intake pipeline (grievance → case conversion)
└── Standardize status names across the domain

Phase 3 — Navigation Redesign
├── Implement 7-section workflow-first navigation
├── Map current pages to target sections
├── Deprecate portal in favor of unified dashboard
├── Add progressive disclosure by role tier
└── Add org-type awareness to more features

Phase 4 — Authority Refinement
├── Centralize cron auth in middleware
├── Standardize on withApi wrapper
├── Add entitlement gates to remaining premium features
└── Implement comprehensive audit logging
```

---

## Section 9 — Summary & Statistics

### 9.1 Key Metrics

| Metric | Value |
|--------|-------|
| Total API routes | ~1,340 |
| Duplicate/removable routes | ~620+ |
| Net canonical routes (after cleanup) | ~720 |
| Total pages | ~100+ |
| Overlapping FSMs | 3 |
| RBAC mismatches | 7 |
| Routes without auth | 5+ |
| Cron routes without protection | 6 |
| Sensitive operations without audit | 10+ |
| Broken/misnamed routes | 4 |
| Dead/stub routes | 4 |
| API duplication pairs | 10 |
| Financial prefixes (current → target) | 6 → 3 |
| Governance score | 83% |

### 9.2 Priority Classification

| Priority | Items | Impact |
|----------|-------|--------|
| **P0 — Security** | Fix RBAC mismatches, cron auth, org scoping gaps | Prevents data leaks and unauthorized access |
| **P1 — Cleanup** | Delete v1/v2 mirrors, fix broken routes, merge duplicates | Reduces surface by ~620 routes |
| **P2 — Architecture** | Unify 3 FSMs, consolidate financial surface | Prerequisite for workflow-first redesign |
| **P3 — Navigation** | Implement 7-section nav, progressive disclosure | End-user experience improvement |
| **P4 — Governance** | Centralize cron auth, standardize wrappers, audit logging | Long-term maintainability |

### 9.3 Files Referenced

| Category | Key Files |
|----------|----------|
| Auth guards | `lib/api-auth-guard.ts` |
| Role definitions | `lib/auth/roles.ts` |
| Sidebar config | `components/sidebar.tsx` |
| Middleware | `middleware.ts` |
| Public routes | `config/public-api-routes.ts` |
| Case FSM | `lib/workflow/case-workflow-fsm.ts` |
| Claim FSM | `lib/workflow/claim-workflow-fsm.ts` |
| Workflow Engine | `lib/workflow/workflow-engine.ts` |
| Grievance SM | `lib/workflow/grievance-state-machine.ts` |
| Automation Engine | `lib/workflow/workflow-automation-engine.ts` |
| RLS Context | `lib/db/with-rls-context.ts` |
| Portal layout | `app/[locale]/portal/layout.tsx` |

---

> **End of Discovery Audit**  
> This report is the exact input needed for the UE Workflow Realignment refactor prompt.  
> No code was modified. All findings are evidence-based from direct file inspection.
