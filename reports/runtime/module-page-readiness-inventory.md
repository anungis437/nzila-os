# Union Eyes — Module & Page Readiness Inventory

**Audit date:** 2026-05-15
**Branch:** main
**Scope:** apps/union-eyes — all routes, modules, runtime surfaces
**Posture:** validation-only · read-only · no architecture mutation

---

## 1. Surface census

| Surface family | Count | Source |
| --- | ---: | --- |
| App-router pages (`page.tsx`) | 294 | apps/union-eyes/app/**/page.tsx |
| Layouts (`layout.tsx`) | 33 | apps/union-eyes/app/**/layout.tsx |
| API routes (`route.ts`) | 867 | apps/union-eyes/app/api/**/route.ts |
| Locale message bundles | 6 | en, en-CA, fr, fr-CA, it, pt |

Two route trees coexist:

- `app/[locale]/...` — primary localized runtime (dashboard + marketing + auth + admin)
- `app/(marketing)/...` — non-localized marketing fallback / canonical SEO surface

This duality is intentional (locale + canonical) but means every marketing page exists in two trees and must be evaluated as a pair.

---

## 2. Route inventory by module family

Legend for state columns:

- **Runtime State:** `live`, `redirect`, `scaffold`, `prototype`
- **Narrative Maturity:** `mature`, `strong`, `partial`, `legacy`
- **Institutional Alignment:** `aligned`, `partial`, `drift`, `n/a`
- **Observability Alignment:** `aligned`, `partial`, `none`
- **Continuity Alignment:** `aligned`, `partial`, `none`
- **Procurement Alignment:** `aligned`, `partial`, `n/a`
- **Production Readiness:** `prod`, `near-prod`, `convergence-needed`, `not-ready`
- **Risk Level:** `low`, `medium`, `high`

### 2.1 Institutional / governance core

| Route | Module | Purpose | Runtime State | Narrative Maturity | Institutional Alignment | Observability Alignment | Continuity Alignment | Procurement Alignment | Production Readiness | Risk Level |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /[locale]/dashboard/governance-center | governance-center | Cognition kernel + anti-surveillance guarantees | live | mature | aligned | aligned | aligned | aligned | prod | low |
| /[locale]/dashboard/institutional-observability | institutional-observability | IGG-backed read surface (chronology, lineage, evidence) | live | mature | aligned | aligned | aligned | aligned | prod | medium (label) |
| /[locale]/dashboard/institutional-topology | institutional-topology | Hierarchy / affiliation / delegation projection | live | mature | aligned | aligned | partial | aligned | prod | medium |
| /[locale]/dashboard/institutional-chronology | institutional-chronology | Procedural timeline + governance epochs | live | mature | aligned | aligned | aligned | aligned | prod | low |
| /[locale]/dashboard/institutional-memory | institutional-memory | Preserved context + procedural lineage | live | strong | aligned | partial | aligned | partial | near-prod | low |
| /[locale]/dashboard/institutional-intelligence | institutional-intelligence | Redirect → /intelligence?tab=institutional | redirect | n/a | n/a | n/a | n/a | n/a | prod | low |
| /[locale]/dashboard/institutional-operating-intelligence | institutional-operating-intelligence | Redirect → /intelligence?tab=executive-operating | redirect | n/a | n/a | n/a | n/a | n/a | prod | medium (drift if revived) |
| /[locale]/dashboard/governance | governance | Bylaws / policies / signatories | live | strong | partial | partial | none | partial | near-prod | medium |
| /[locale]/dashboard/governance-culture | redirect → /governance?tab=culture | — | redirect | n/a | n/a | n/a | n/a | n/a | prod | low |
| /[locale]/dashboard/governance-recommendations | redirect → /governance?tab=recommendations | — | redirect | n/a | n/a | n/a | n/a | n/a | prod | low |
| /[locale]/dashboard/admin/governance | admin-governance | Reserved-matter / Class-B admin console | live | mature | aligned (fenced) | aligned | aligned | aligned (admin-only) | prod | low (gated) |

### 2.2 Continuity / chronology / cognition

| Route | Module | Purpose | Runtime State | Narrative Maturity | Institutional Alignment | Observability Alignment | Continuity Alignment | Procurement Alignment | Production Readiness | Risk Level |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /[locale]/dashboard/continuity-intelligence | continuity-intelligence | Fragility signals + succession readiness | live | strong | aligned | partial | aligned | aligned | near-prod | medium |
| /[locale]/dashboard/continuity-planning | continuity-planning | Resilience pathways + traceable actions | live | strong | aligned | partial | aligned | aligned | near-prod | medium |
| /[locale]/dashboard/continuity-simulation | continuity-simulation | Disruption scenarios + safeguards | live | strong | aligned | partial | aligned | aligned | near-prod | medium |
| /[locale]/dashboard/longitudinal-cognition | longitudinal-cognition | T1–T9 institutional storybook | live | mature | aligned | aligned | aligned | aligned | prod | medium (label) |
| /[locale]/dashboard/cognition | cognition | KPI / fairness / engagement | live | strong | drift (scoring framing) | partial | partial | partial | convergence-needed | high |
| /[locale]/dashboard/executive-operating-intelligence | executive-operating-intelligence | Executive briefing + cognition envelopes | live | mature | aligned | aligned | aligned | aligned | prod | medium (label) |
| /[locale]/continuity-crisis | continuity-crisis | Crisis-mode landing | live | strong | partial | partial | aligned | partial | near-prod | low |
| /[locale]/dashboard/cba-intelligence | cba-intelligence | CBA freshness + steward review | live | strong | partial | partial | partial | partial | near-prod | medium |

### 2.3 Operational / case substrate (DB-backed CRUD)

| Route | Module | Purpose | Runtime State | Narrative Maturity | Institutional Alignment | Observability Alignment | Continuity Alignment | Procurement Alignment | Production Readiness | Risk Level |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /[locale]/dashboard | dashboard | Landing | live | mature | aligned | partial | partial | partial | prod | low |
| /[locale]/dashboard/workbench | workbench | Operational workflow | live | strong | partial | none | none | partial | near-prod | medium (label) |
| /[locale]/dashboard/inbox | inbox | Unified signal feed | live | strong | partial | none | none | partial | near-prod | low |
| /[locale]/dashboard/priorities | priorities | Top-priority items | live | strong | partial | none | none | partial | near-prod | low |
| /[locale]/dashboard/operations | operations | Platform operations (platform-lead) | live | strong | n/a | aligned (telemetry) | none | n/a | prod | low |
| /[locale]/dashboard/ops/performance | ops/performance | Route latency + error rate | live | strong | n/a | aligned | none | n/a | prod | low |
| /[locale]/dashboard/intelligence | intelligence | Tabbed research shell | live | strong | drift (label) | partial | partial | partial | convergence-needed | high |
| /[locale]/dashboard/movement-insights | movement-insights | Cross-org trends (federation officer+) | live | strong | partial | partial | partial | partial | convergence-needed | high |
| /[locale]/dashboard/movement-insights/export | movement-insights export | Export | live | partial | partial | partial | partial | partial | convergence-needed | medium |
| /[locale]/dashboard/cross-union-analytics | cross-union-analytics | Cross-org analytics (gated) | live | partial | drift (label) | partial | partial | partial | convergence-needed | high |
| /[locale]/dashboard/sector-analytics | sector-analytics | Sector / industry trends | live | partial | drift (label) | partial | none | partial | convergence-needed | high |
| /[locale]/dashboard/analytics | analytics | Local analytics shell | live | partial | partial | partial | none | partial | near-prod | medium |
| /[locale]/(dashboard)/analytics | analytics (alt) | Duplicate analytics surface | live | partial | partial | partial | none | partial | near-prod | medium |
| /[locale]/dashboard/analytics-admin | analytics-admin | Platform usage metrics | live | partial | n/a | aligned | none | n/a | prod | low |
| /[locale]/dashboard/cases/[id] | cases | Case detail | live | strong | partial | partial | partial | partial | near-prod | low |
| /[locale]/dashboard/claims/[id] | claims | Claim detail | live | strong | partial | partial | partial | partial | near-prod | low |
| /[locale]/dashboard/claims/new | claims | Claim intake | live | strong | partial | partial | partial | partial | near-prod | low |
| /[locale]/dashboard/grievances/[id] | grievances | Grievance detail | live | strong | partial | partial | partial | partial | near-prod | low |
| /[locale]/dashboard/audits | audits | Audit log surface | live | strong | aligned | aligned | partial | aligned | prod | low |
| /[locale]/dashboard/correspondence | correspondence | Outgoing correspondence | live | strong | partial | none | none | partial | near-prod | low |

### 2.4 Member / representation / committees

| Route | Module | Purpose | Runtime State | Narrative Maturity | Institutional Alignment | Observability Alignment | Continuity Alignment | Procurement Alignment | Production Readiness | Risk Level |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /[locale]/dashboard/members, /members/[id], /members/new | members | Member CRUD | live | mature | partial | partial | partial | partial | near-prod | low |
| /[locale]/dashboard/member/timeline/[caseId] | member-timeline | Per-member case timeline | live | strong | partial | partial | aligned | partial | near-prod | low |
| /[locale]/dashboard/stewards, /stewards/ratings | stewards | Steward registry | live | strong | partial | partial | none | partial | near-prod | low |
| /[locale]/dashboard/committees, /committees/[id] | committees | Committee surface | live | strong | partial | partial | partial | partial | near-prod | low |
| /[locale]/dashboard/leadership | leadership | Leadership view | live | strong | partial | partial | partial | partial | near-prod | low |
| /[locale]/dashboard/elections, /[id], /new | elections | Elections | live | strong | partial | partial | partial | partial | near-prod | low |
| /[locale]/dashboard/voting | voting | Vote runtime | live | strong | partial | partial | partial | partial | near-prod | low |
| /[locale]/dashboard/dispatch | dispatch | Dispatch board | live | strong | partial | none | none | partial | near-prod | low |
| /[locale]/dashboard/calendar | calendar | Calendar | live | strong | n/a | none | none | n/a | near-prod | low |
| /[locale]/calendar | calendar (alt) | Localized alt calendar | live | partial | n/a | none | none | n/a | near-prod | low |
| /[locale]/surveys/[surveyId] | surveys | Survey runtime | live | partial | partial | none | none | partial | near-prod | low |

### 2.5 Bargaining / agreements / precedent

| Route | Module | Purpose | Runtime State | Narrative Maturity | Institutional Alignment | Observability Alignment | Continuity Alignment | Procurement Alignment | Production Readiness | Risk Level |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /[locale]/dashboard/bargaining, /new, /negotiations/[id] | bargaining | Bargaining workspace | live | strong | partial | partial | partial | partial | near-prod | low |
| /[locale]/dashboard/agreements | agreements | Active agreements | live | strong | partial | partial | partial | partial | near-prod | low |
| /[locale]/dashboard/clause-library | clause-library | Reusable clauses | live | strong | partial | none | none | partial | near-prod | low |
| /[locale]/dashboard/precedents | precedents | Precedent registry | live | strong | partial | partial | partial | partial | near-prod | low |

### 2.6 Communications / education / knowledge

| Route | Module | Purpose | Runtime State | Narrative Maturity | Institutional Alignment | Observability Alignment | Continuity Alignment | Procurement Alignment | Production Readiness | Risk Level |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /[locale]/dashboard/communications + sub-routes | communications | Campaigns, templates, distribution lists, SMS | live | strong | partial | partial | none | partial | near-prod | low |
| /[locale]/dashboard/notifications | notifications | Notifications | live | strong | n/a | none | none | n/a | near-prod | low |
| /[locale]/dashboard/education + sub-routes | education | Courses + certificates | live | strong | n/a | none | none | n/a | near-prod | low |
| /[locale]/dashboard/knowledge, /knowledge-base | knowledge | Knowledge base | live | strong | partial | none | none | partial | near-prod | low |
| /[locale]/dashboard/knowledge-transfer + [id] + new | knowledge-transfer | Knowledge transfer cases | live | strong | aligned | partial | aligned | partial | near-prod | low |

### 2.7 Finance / dues / strike fund / pension / employer execution

| Route | Module | Purpose | Runtime State | Narrative Maturity | Institutional Alignment | Observability Alignment | Continuity Alignment | Procurement Alignment | Production Readiness | Risk Level |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /[locale]/dashboard/finance + sub-routes | finance | Billing, invoices, exports, allocation | live | strong | n/a | partial | none | partial | near-prod | low |
| /[locale]/dashboard/financial + sub-routes | financial | Budgets, vendors, expenses | live | strong | n/a | partial | none | partial | near-prod | low |
| /[locale]/dashboard/dues + sub-routes | dues | Dues + receipts + pay | live | strong | n/a | partial | none | partial | near-prod | low |
| /[locale]/dashboard/strike-fund, [fundId] | strike-fund | Strike fund surface | live | strong | n/a | partial | none | partial | near-prod | low |
| /[locale]/dashboard/pension, /admin, /trustee | pension | Pension surfaces | live | strong | n/a | partial | none | partial | near-prod | low |
| /[locale]/dashboard/employer-execution + sub-routes | employer-execution | Payroll, remittances, timesheets, compliance | live | strong | n/a | partial | none | partial | near-prod | low |
| /[locale]/dashboard/pay | pay | Pay surface | live | strong | n/a | none | none | n/a | near-prod | low |

### 2.8 Compliance / health-safety / outcomes / reports

| Route | Module | Purpose | Runtime State | Narrative Maturity | Institutional Alignment | Observability Alignment | Continuity Alignment | Procurement Alignment | Production Readiness | Risk Level |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /[locale]/dashboard/compliance, /compliance-admin | compliance | Compliance surface | live | strong | partial | partial | none | partial | near-prod | low |
| /[locale]/dashboard/health-safety + sub-routes | health-safety | HS incidents/hazards/inspections/training | live | strong | partial | partial | partial | partial | near-prod | low |
| /[locale]/dashboard/outcomes | outcomes | Outcome tracking | live | strong | partial | partial | partial | partial | near-prod | low |
| /[locale]/dashboard/reports | reports | Report builder | live | strong | partial | aligned | partial | aligned | near-prod | low |
| /[locale]/dashboard/exports (under finance/exports + reports) | exports | Export surfaces | live | strong | partial | aligned | partial | aligned | near-prod | low |

### 2.9 Federation / CLC / cross-org

| Route | Module | Purpose | Runtime State | Narrative Maturity | Institutional Alignment | Observability Alignment | Continuity Alignment | Procurement Alignment | Production Readiness | Risk Level |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /[locale]/dashboard/federation, /affiliates, /remittances | federation | Federation surface | live | strong | partial | partial | partial | partial | near-prod | medium |
| /[locale]/dashboard/clc, /staff, /affiliates, /compliance, /intelligence | clc | CLC surface | live | strong | partial | partial | partial | partial | near-prod | medium |

### 2.10 Admin / onboarding / pilot / structure

| Route | Module | Purpose | Runtime State | Narrative Maturity | Institutional Alignment | Observability Alignment | Continuity Alignment | Procurement Alignment | Production Readiness | Risk Level |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /[locale]/admin/auth-policy | auth-policy | Auth policy admin | live | strong | n/a | partial | none | partial | prod | low |
| /[locale]/dashboard/admin + sub-routes (members, organizations, governance, migrations, dues, rewards, ai-usage, etc.) | admin | Admin console suite | live | strong | partial (gated) | partial | partial | partial (admin-only) | near-prod | medium |
| /[locale]/dashboard/admin/onboarding | admin-onboarding | Org onboarding | live | strong | partial | partial | partial | aligned | near-prod | low |
| /[locale]/dashboard/pilot, /pilot/onboarding | pilot | Pilot onboarding | live | strong | aligned | partial | aligned | aligned | near-prod | low |
| /[locale]/pilot-governance | pilot-governance | Pilot governance landing | live | strong | aligned | partial | aligned | aligned | near-prod | low |
| /[locale]/operational-proving | operational-proving | Operational proving landing | live | strong | partial | partial | partial | aligned | near-prod | low |
| /[locale]/final-go | final-go | Final-go landing | live | strong | partial | partial | partial | aligned | near-prod | low |
| /[locale]/field-operations | field-operations | Field-ops landing | live | strong | partial | none | none | partial | near-prod | low |
| /[locale]/dashboard/structure | structure | Org structure | live | strong | aligned | partial | partial | partial | near-prod | low |
| /[locale]/dashboard/data-source | data-source | Data source linkage | live | strong | n/a | partial | none | partial | near-prod | low |
| /[locale]/dashboard/integrations, /settings/integrations | integrations | Integration management | live | strong | n/a | none | none | n/a | near-prod | low |
| /[locale]/dashboard/settings + sub-routes | settings | User/org settings | live | strong | n/a | none | none | n/a | prod | low |
| /[locale]/dashboard/security | security | Security surface | live | strong | partial | aligned | none | partial | near-prod | low |
| /[locale]/settings/mfa | mfa | MFA settings | live | strong | n/a | none | none | n/a | prod | low |
| /[locale]/dashboard/billing-admin | billing-admin | Billing admin | live | strong | n/a | none | none | n/a | near-prod | low |
| /[locale]/dashboard/profile | profile | User profile | live | strong | n/a | none | none | n/a | prod | low |
| /[locale]/dashboard/customer-success | customer-success | CS surface | live | strong | n/a | none | none | n/a | near-prod | low |
| /[locale]/dashboard/support | support | Support surface | live | strong | n/a | none | none | n/a | near-prod | low |
| /[locale]/dashboard/debug | debug | Debug | scaffold | partial | n/a | partial | none | n/a | not-ready (dev-only) | low |
| /[locale]/dashboard/targets | targets | Targets | live | strong | partial | partial | none | partial | near-prod | low |
| /[locale]/dashboard/work | work | Work view | live | strong | partial | none | none | partial | near-prod | low |

### 2.11 Mobile / member-facing / strike

| Route | Module | Purpose | Runtime State | Narrative Maturity | Institutional Alignment | Observability Alignment | Continuity Alignment | Procurement Alignment | Production Readiness | Risk Level |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /[locale]/mobile, /members, /claims | mobile | Mobile shell | live | strong | partial | none | none | partial | near-prod | low |
| /[locale]/dashboard/rewards, /history, /recognition, /redeem | rewards | Recognition/rewards surface | live | strong | partial | none | none | partial | near-prod | low |
| /[locale]/dashboard/rewards/leaderboard | leaderboard | Leaderboard view | live | legacy | drift | none | none | n/a | convergence-needed | high (forbidden vocab) |

### 2.12 Marketing / trust / procurement (both `[locale]/(marketing)` and `(marketing)/`)

| Route | Purpose | Runtime State | Narrative Maturity | Institutional Alignment | Procurement Alignment | Production Readiness | Risk Level |
| --- | --- | --- | --- | --- | --- | --- | --- |
| /(marketing) and /[locale]/(marketing) | Home | live | mature | aligned | aligned | prod | low |
| /(marketing)/trust, /[locale]/(marketing)/trust | Trust pillar | live | mature | aligned | aligned | prod | low |
| /[locale]/(marketing)/trust/stewardship-appendix | Procurement appendix | live | mature | aligned (fenced) | aligned | prod | low |
| /(marketing)/governance, /[locale]/(marketing)/governance | Governance pillar | live | mature | aligned | aligned | prod | low |
| /(marketing)/institutional-continuity, /[locale]/(marketing)/institutional-continuity | Continuity pillar | live | mature | aligned | aligned | prod | low |
| /(marketing)/executive-intelligence, /[locale]/(marketing)/executive-intelligence | Pillar | live | strong | partial (label) | aligned | near-prod | medium |
| /(marketing)/platform/{operational-coherence, governance-intelligence, organizational-memory, explainable-intelligence}, /[locale]/(marketing)/platform/* | Platform pillars | live | strong | partial (label) | aligned | near-prod | medium |
| /(marketing)/solutions/{labour-, governance-, operations-, executive-, technology-leadership, procurement} + /[locale]/.../solutions/* | Role-based solutions | live | strong | partial | aligned | near-prod | low |
| /(marketing)/features/{ai-workbench, analytics, grievance-tracking, inbox, member-portal, priorities} + /[locale]/.../features/* | Feature pages | live | strong | partial | partial | near-prod | medium |
| /(marketing)/insights, /insights/[slug], /category/[slug], /[locale]/(marketing)/insights/* | Editorial insights | live | strong | partial | partial | near-prod | medium |
| /(marketing)/case-studies, /[slug], /[locale]/(marketing)/case-studies/* | Case studies | live | strong | aligned | aligned | near-prod | low |
| /(marketing)/pricing, /[locale]/(marketing)/pricing | Pricing | live | strong | n/a | aligned | near-prod | low |
| /(marketing)/contact, /[locale]/(marketing)/contact | Contact | live | strong | n/a | aligned | prod | low |
| /(marketing)/pilot-request, /[locale]/(marketing)/pilot-request | Pilot intake | live | strong | aligned | aligned | prod | low |
| /(marketing)/status, /[locale]/(marketing)/status | Status | live | strong | aligned | aligned | prod | low |
| /(marketing)/story, /[locale]/(marketing)/story | Story | live | strong | aligned | aligned | prod | low |
| /[locale]/(marketing)/proof | Proof artifacts | live | strong | aligned | aligned | prod | low |
| /[locale]/(marketing)/conventions | Conventions | live | strong | aligned | aligned | prod | low |
| /[locale]/(marketing)/for-{members,representatives,leadership,clc,federations} | Audience pages | live | strong | aligned | aligned | near-prod | low |
| /(marketing)/[...slug] catch-all | SEO fallback | live | strong | partial | partial | near-prod | low |
| /[locale]/(marketing)/legal/{terms,privacy,security,accessibility} | Legal | live | strong | aligned | aligned | prod | low |

### 2.13 Auth / utility / docs

| Route | Purpose | Runtime State | Production Readiness | Risk Level |
| --- | --- | --- | --- | --- |
| /[locale]/(auth)/sign-in, sign-up, signup, login (+ root variants) | Auth | live | prod | low |
| /reset-password, /forgot-password, /sign-in, /sign-up, /signup, /login | Root-level auth fallbacks | live | prod | low (dedup candidate) |
| /invite/accept | Invite | live | prod | low |
| /magic-link/verify | Magic link | live | prod | low |
| /[locale]/api-docs, /[locale]/docs/api | API docs | live | near-prod | low |
| /sentry-example-page | Diagnostic | scaffold | not-ready (remove for prod) | low |

---

## 3. API surface (867 routes) — namespace summary

API namespaces are inventoried by family rather than route-by-route to keep this report scannable. Risk is assessed at the namespace level.

| Namespace | Approx. routes | Purpose | Risk |
| --- | ---: | --- | --- |
| /api/admin/** | ~120 | Admin operations (members, orgs, dues, rewards, alerts, ingest, jobs, segments, pki, billing-cycles) | medium (gated) |
| /api/cases/**, /api/cba-intelligence/**, /api/cnesst/**, /api/cope/**, /api/correspondence/**, /api/elections/**, /api/voting/**, /api/wcb/**, /api/strike/**, /api/strike-fund/** | ~250 | Domain operations | low |
| /api/analytics/** | ~30 | Aggregations | medium (label drift) |
| /api/ai/** | ~25 | AI assistive surfaces (copilot, grievances, pension, finance) | medium (must remain assistive) |
| /api/auth/**, /api/auth_core/**, /api/tenant/**, /api/users/** | ~30 | Identity | low |
| /api/billing/**, /api/dues/**, /api/tax/**, /api/employer-execution/** | ~60 | Finance / payroll | low |
| /api/communications/**, /api/social-media/**, /api/calendar*/**, /api/calendar-sync/** | ~40 | Comms + calendar | low |
| /api/content/**, /api/documents/**, /api/storage/** | ~25 | Content / docs | low |
| /api/health-safety, /api/compliance/**, /api/audits/**, /api/deadlines/** | ~30 | Compliance / audit | low |
| /api/v2/[...path] | 1 | v2 proxy | low |
| Other domain routes | balance | Misc. | low |

Detailed per-route audit of the 867 API routes is out of scope for this validation pass and is recommended as a follow-up only if narrative or governance drift is observed at the API-shape level.

---

## 4. Readiness state classifications (initial)

Routes assigned to each readiness state:

1. **Mature:** governance-center, institutional-{observability, topology, chronology}, longitudinal-cognition, executive-operating-intelligence, admin/governance, marketing trust/governance/institutional-continuity/story/contact/proof/legal/conventions
2. **Strong but incomplete:** all dashboard CRUD families (members, claims, cases, grievances, bargaining, education, communications, finance, dues, strike-fund, pension, employer-execution, federation, clc, committees, elections, voting, dispatch, calendar, correspondence, audits, reports, knowledge-transfer, surveys)
3. **Runtime-fragmented:** intelligence (drift label + tabbed shell over partial substrate), cba-intelligence (DB-backed but uneven hydration), continuity-intelligence/planning/simulation (component-driven, IGG enrichment partial)
4. **Legacy-semantic drift:** rewards/leaderboard, intelligence (label), cross-union-analytics, sector-analytics, movement-insights, marketing platform/explainable-intelligence + executive-intelligence + features/ai-workbench (label-only)
5. **Prototype-only:** debug
6. **Scaffold-only:** sentry-example-page, root-level duplicate auth pages
7. **Conceptually aligned but shallow:** institutional-memory (strong narrative, partial substrate via @nzila/knowledge-transfer), continuity-crisis (strong landing, partial substrate)
8. **Architecturally risky:** none observed at the page layer; risk concentrates in route labels and one duplicate analytics tree
9. **Governance-sensitive:** admin/governance, governance-center, institutional-{observability, topology, chronology}, longitudinal-cognition, executive-operating-intelligence, movement-insights, cross-union-analytics, sector-analytics, intelligence
10. **Requires convergence:** intelligence, cognition, cross-union-analytics, sector-analytics, movement-insights, rewards/leaderboard, institutional-observability (label review), cba-intelligence (hydration depth)

---

## 5. Inventory limits and follow-ups

- API-shape narrative audit and protected-token sweep across all 867 routes is **deferred**; this inventory covers the page surface plus high-risk API namespaces.
- The two coexisting marketing trees (`app/(marketing)` and `app/[locale]/(marketing)`) are listed as a single semantic surface; physical duplication is intentional but should be considered when reasoning about doctrine drift fixes (changes must land in both).
- Auth fallbacks at `/reset-password`, `/forgot-password`, `/sign-in`, `/sign-up`, `/signup`, `/login` duplicate the localized auth tree and are candidates for consolidation.
- `/sentry-example-page` should not ship to production builds.
