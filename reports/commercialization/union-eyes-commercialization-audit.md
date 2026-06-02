# Union Eyes — Commercialization Audit

**Date:** 2 June 2026
**Scope:** `apps/union-eyes` plus directly-related infrastructure under the nzila-os monorepo.
**Method:** Read-only audit of pilot infrastructure, sales surface, tenancy, deployment, admin tooling, and operational artifacts. Findings are cited to specific files; no claims are made without a source.
**Author:** Commercialization audit pass (June 2026), grounded in three parallel codebase audits.

---

## 0. Executive Summary

Union Eyes is materially more pilot-ready than the absence of public marketing material suggests. A full pilot evidence pack was signed off on **2026-05-03** ("controlled pilot GO — 1 organization, ≤5 worksites, ≤200 members, 90 days"), the QA pass returned `GO_FOR_PRODUCTION` with `17/17` dry-run components passing, and a dedicated pilot environment (`pilot.unioneyes.app`, `pilot-rg`) is live alongside production, demo, and staging.

The platform supports the **technical** pilot lifecycle end-to-end: intake form, application API, readiness scoring, per-org RLS isolation, demo seeding, onboarding checklist, event-stream observability, friction detection, champion detection, conversion-readiness signals, and Stripe billing. What is **not yet packaged commercially** is the surrounding sales motion: pilot pricing tier, pilot proposal generator, admin approval UI, multi-fixture bootstrap, and pilot closeout / conversion workflow.

Treat this as a packaging and selective build-out exercise, not a redesign.

---

## 1. Existing Pilot Infrastructure Inventory

### 1.1 Complete and pilot-grade (production-ready)

| Capability | Location | Notes |
|---|---|---|
| Readiness scoring engine | [apps/union-eyes/lib/pilot/readiness-assessment.ts](../../apps/union-eyes/lib/pilot/readiness-assessment.ts) | `calculateReadinessScore()` weighs size (20), system state (25), leadership (20), tech capacity (15), complexity (10), goals (10). Returns level (`ready` / `mostly-ready` / `needs-preparation` / `not-ready`), strengths, concerns, recommendations, estimated setup time, support level, and continuity profile. |
| Health-scoring engine | [apps/union-eyes/lib/pilot/health-scoring.ts](../../apps/union-eyes/lib/pilot/health-scoring.ts) | 30% adoption / 25% engagement / 15% usage / 20% effectiveness / 10% progress. `getHealthScoreStatus()` maps to a narrative recommendation. |
| Pilot event emitter | [apps/union-eyes/lib/pilot-metrics.ts](../../apps/union-eyes/lib/pilot-metrics.ts) | Records case lifecycle (created / assigned / acknowledged / resolved), workflow transitions, SLA watchdog signals, evidence export. Resolves active pilot via `pilot_definitions` table. |
| Admin health checks | [apps/union-eyes/lib/pilot-admin.ts](../../apps/union-eyes/lib/pilot-admin.ts) | `runHealthChecks()` covers vocabulary, org config, users, worksites, SLA, audit trail, overdue cases. `buildPilotStatus()` aggregates KPI/phase. |
| Pilot application API (POST) | [apps/union-eyes/app/api/pilot/apply/route.ts](../../apps/union-eyes/app/api/pilot/apply/route.ts) | Validates required fields, persists to `pilotApplications`, fire-and-forget HubSpot contact + deal upsert with `ue_*` properties. |
| Pilot application API (GET) | Same route | Org-scoped list with steward+ read role. |
| Public pilot-request page | [apps/union-eyes/app/\[locale\]/(marketing)/pilot-request/page.tsx](../../apps/union-eyes/app/[locale]/(marketing)/pilot-request/page.tsx) | Multi-step readiness form, i18n via `marketing.pilotRequest.*`. EN-CA + FR-CA. |
| Current-pilot metrics API | [apps/union-eyes/app/api/pilot/current/route.ts](../../apps/union-eyes/app/api/pilot/current/route.ts) | Returns `PilotMetrics` shape: enrollment, days active, milestone progress, DAU, case counts. Officer+ auth. |
| Champions API | [apps/union-eyes/app/api/pilot/champions/route.ts](../../apps/union-eyes/app/api/pilot/champions/route.ts) | `detectChampions(orgId)` from pilot-signals. |
| Friction API | [apps/union-eyes/app/api/pilot/friction/route.ts](../../apps/union-eyes/app/api/pilot/friction/route.ts) | Login-without-case, case-without-update, inactive-user cohorts. |
| Conversion readiness API | [apps/union-eyes/app/api/pilot/readiness/route.ts](../../apps/union-eyes/app/api/pilot/readiness/route.ts) | `assessConversionReadiness(orgId)` returns adoption / usage / effectiveness / progress signals. |
| In-app feedback API | [apps/union-eyes/app/api/pilot/feedback/route.ts](../../apps/union-eyes/app/api/pilot/feedback/route.ts) | 1–5 ease rating, category enum, trigger enum. Persists to `pilotFeedback` and emits `pilotEvents`. |
| Onboarding checklist API | [apps/union-eyes/app/api/pilot/onboarding/route.ts](../../apps/union-eyes/app/api/pilot/onboarding/route.ts) | Reads `pilotChecklistItems` + `pilotDemoSeeds`. |
| Pilot bootstrap API (CUPE-specific) | [apps/union-eyes/app/api/pilot/bootstrap/cupe/route.ts](../../apps/union-eyes/app/api/pilot/bootstrap/cupe/route.ts) | Admin-only, runtime-gated. Seeds org + members + demo grievances from fixture, initializes checklist, emits pilot events. |
| Admin seed API | [apps/union-eyes/app/api/admin/seed-cupe-pilot/route.ts](../../apps/union-eyes/app/api/admin/seed-cupe-pilot/route.ts) | Supports reset mode; idempotent; loads from `fixtures/cupe/pilot-org/cupe-pilot-setup.json`. |
| Pilot-mode context | [apps/union-eyes/contexts/pilot-mode-context.tsx](../../apps/union-eyes/contexts/pilot-mode-context.tsx) | Per-org feature flag via `/api/feature-flags?flag=pilot-mode`. Fail-closed default. Tracks onboarding completion in localStorage. |
| Onboarding UI | [apps/union-eyes/components/pilot/pilot-readiness-checklist.tsx](../../apps/union-eyes/components/pilot/pilot-readiness-checklist.tsx) | 7-item checklist: org-seeded, users-invited, roles-assigned, contracts-uploaded, employers-imported, integrations-configured, export-verified. |
| Admin metrics dashboard | [apps/union-eyes/components/pilot/pilot-admin-overview.tsx](../../apps/union-eyes/components/pilot/pilot-admin-overview.tsx) | DAU, cases, adoption, friction detection, champion signals, conversion readiness, feedback summary. Read-only. |
| Pilot DB schema | `apps/union-eyes/db/schema/domains/pilot/` and `marketing.ts` | 6 pilot tables (`pilotEnrollments`, `pilotMilestones`, `pilotChecklistItems`, `pilotDemoSeeds`, `pilotEvents`, `pilotFeedback`) plus `pilotApplications`, `pilotMetrics`, `organizerImpacts`. All pilot tables have `org_isolation` RLS policies. |
| Migrations | [0025_pilot_enrollments.sql](../../apps/union-eyes/db/migrations/0025_pilot_enrollments.sql), [0082_add_pilot_tables.sql](../../apps/union-eyes/db/migrations/0082_add_pilot_tables.sql), [20260404_pilot_observability.sql](../../apps/union-eyes/db/migrations/20260404_pilot_observability.sql), `0093_applications_registry.sql` | All deployed. RLS policies live. |
| Pilot type definitions | [apps/union-eyes/types/marketing.ts](../../apps/union-eyes/types/marketing.ts) | `PilotApplicationInput`, `PilotApplication`, `PilotMilestone`, `PilotMetrics`, `PilotHealthScoreBreakdown`, `PilotStatus`. |
| Pilot e2e gating tests | [apps/union-eyes/e2e/pilot-mode-gating.spec.ts](../../apps/union-eyes/e2e/pilot-mode-gating.spec.ts) | `PILOT_EXCLUDED_ROUTES` hard-blocked for all stakeholder roles. |

### 1.2 Partial / demo-only

| Item | Location | Limitation |
|---|---|---|
| Pilot bootstrap fixture | [fixtures/cupe/pilot-org/cupe-pilot-setup.json](../../fixtures/cupe/pilot-org/cupe-pilot-setup.json) | CUPE-specific. Bootstrap and admin-seed endpoints both reference this single fixture; a second customer requires a new fixture and code-path. |
| Demo data generator | [apps/union-eyes/lib/pilot/cape-demo-data.ts](../../apps/union-eyes/lib/pilot/cape-demo-data.ts) | Realistic but synthetic federal-government grievance scenarios. No documented bulk migration script from demo org to real customer org; ops procedure exists in the operations runbook but is not automated. |
| Demo data API | [apps/union-eyes/app/api/pilot/demo-data/route.ts](../../apps/union-eyes/app/api/pilot/demo-data/route.ts) | POST/DELETE guarded by `NZILA_MODE=pilot\|demo`. Not for real customer data. |
| Pilot e2e journey | [apps/union-eyes/e2e/pilot-journey.spec.ts](../../apps/union-eyes/e2e/pilot-journey.spec.ts) | Skipped unless `PLAYWRIGHT_TEST_AUTH=true`. |
| Pilot feedback widget | `apps/union-eyes/components/pilot/pilot-feedback-widget.tsx` | Not inspected in depth; likely partial UX wrapper. |

### 1.3 Missing capabilities

| # | Missing capability | Why it matters |
|---|---|---|
| 1 | **Pilot proposal / quote generator** | No code generates a structured proposal from intake responses. Sales cycle today requires manual document assembly. |
| 2 | **Pilot pricing SKU on the pricing page** | The five engagement options (Assessment / Topology / Platform / Stewardship / Cohort) and the diagnostic ladder ($1.2K / $6.5K) do not include a pilot tier. Pilots are bespoke quotes today. |
| 3 | **Admin pilot-application approval UI** | The `pilotApplications.status` enum (`submitted → review → approved → active → completed`) and HubSpot deal pipeline are in place, but the only operator-visible surface is the read-only metrics dashboard. No UI lists applications, transitions status, or surfaces readiness scores. |
| 4 | **Generic (non-CUPE) bootstrap fixture** | Bootstrapping a second customer requires duplicating `bootstrap/cupe/route.ts` or refactoring it to take a fixture id parameter. |
| 5 | **Demo → real-org handoff automation** | Today: manual rename + manual demo data purge. Acceptable for the first 1–2 pilots; a hard blocker at 5+ pilots. |
| 6 | **Pilot closeout / graduation workflow** | No automatic transition from `active` to `completed`, no closure report generation, no triggered conversion-to-subscription handoff. |
| 7 | **Pilot → subscription conversion flow** | Stripe billing and `orgSubscriptions` table exist; no UI step that walks an outgoing pilot through subscription setup. |
| 8 | **Pilot success-criteria negotiation surface** | Customers cannot define custom success metrics or target thresholds before enrollment; success criteria are implicit in the health-scoring weights. |
| 9 | **Multi-pilot cohort dashboard** | Admin metrics are per-org; no cross-pilot benchmarking view. |
| 10 | **Pilot feedback closure loop** | Feedback is captured but not aggregated for product or communicated back to the pilot organization. |
| 11 | **Pilot SLA breach escalation** | Watchdog emits signals; no auto-routing or corrective workflow. |
| 12 | **Pilot usage-limit guards** | No feature-flag-driven caps on case volume, user count, or storage scoped to pilot organizations. The `PILOT_SCOPE_LOCK` parameters (5 worksites, 200 members) are not enforced in software — they are enforced contractually. |

---

## 2. Sales Readiness Audit (Stages A–G)

Each stage maps to existing repo surface. **Status legend:** ✅ functional, ⚠️ partial, ❌ missing.

| Stage | Status | Evidence |
|---|---|---|
| **A. Demo Request** | ❌ | No standalone "Request a demo" route or form. The current motion is: stakeholder demo delivered manually (the CUPE 4373 demo that just landed). The closest in-product surface is `DemoModeOverlay` ([apps/union-eyes/components/pilot/demo-mode-overlay.tsx](../../apps/union-eyes/components/pilot/demo-mode-overlay.tsx)), which is internal-only. |
| **B. Qualification** | ⚠️ | The pilot-request form ([apps/union-eyes/app/\[locale\]/(marketing)/pilot-request/page.tsx](../../apps/union-eyes/app/[locale]/(marketing)/pilot-request/page.tsx)) collects all inputs needed by `calculateReadinessScore()`. The API computes the score on submission. HubSpot deals are created with `ue_readiness_score` set. There is no UI for an internal reviewer to consume the score before approval. |
| **C. Pilot Application** | ✅ | End-to-end pipeline: multi-step form → server validation → `pilotApplications` insert → HubSpot deal at stage `pilot_applied`. Bilingual (EN-CA / FR-CA). |
| **D. Pilot Approval** | ⚠️ | API and status enum exist. No admin UI. Approval today is a manual database update or HubSpot deal-stage change. |
| **E. Pilot Deployment** | ✅ (single-customer) ⚠️ (repeatable) | CUPE-specific bootstrap works end-to-end. The 7-item onboarding checklist enforces operational readiness. Repeatable deployment to a non-CUPE customer requires the fixture refactor noted in §1.3 #4. |
| **F. Pilot Success Review** | ⚠️ | Metrics surfaces (`/api/pilot/current`, `/api/pilot/metrics`, `/api/pilot/readiness`, `/api/pilot/feedback`) are all live; admin dashboard renders them. No formal review workflow that closes the pilot or triggers a structured conversation with the customer. |
| **G. Conversion to Subscription** | ⚠️ | Stripe webhook handler ([apps/union-eyes/app/api/payments/webhooks/stripe/route.ts](../../apps/union-eyes/app/api/payments/webhooks/stripe/route.ts)), checkout creation ([apps/union-eyes/app/api/payments/checkout/create/route.ts](../../apps/union-eyes/app/api/payments/checkout/create/route.ts)), and `orgSubscriptions` table all exist. No flow ties a `completed` pilot to a subscription checkout. |

**Aggregate sales-funnel readiness:** **strong middle, weak ends.** Application + deployment + observability are solid; demo-request capture and pilot-to-subscription handoff are missing.

---

## 3. Pilot Offer Audit

| Capability | Present? | Detail |
|---|---|---|
| Pilot intake | ✅ | Multi-step form + API + DB + CRM sync. |
| Readiness scoring | ✅ | Documented algorithm, transparent weights, returns recommendations + support level. |
| Pilot proposal generation | ❌ | No template engine, no PDF generation, no Markdown-to-proposal pipeline. |
| Implementation planning | ⚠️ | `PilotOperationsRunbook` exists as a static document; not generated per-customer. |
| Success metrics | ✅ (defined) ⚠️ (per-customer) | `PilotHealthScoreBreakdown` defines the universal metric. Per-customer target thresholds are not surfaced. |
| Pilot closeout | ❌ | No status transition, no report generation, no exit-path automation. |

---

## 4. Tenant Isolation Model

**Architecture:** single shared multi-tenant Postgres per environment; isolation enforced at the database via Row-Level Security.

| Element | Detail |
|---|---|
| Organization entity | [apps/union-eyes/db/schema-organizations.ts](../../apps/union-eyes/db/schema-organizations.ts) — hierarchical (`parentId`, `hierarchyPath`, `hierarchyLevel`), CLC-aligned (`clcAffiliated`, `charterNumber`, `clcAffiliateCode`), typed (platform / congress / federation / union / local / region / district). |
| Membership | [apps/union-eyes/db/schema/organization-members-schema.ts](../../apps/union-eyes/db/schema/organization-members-schema.ts) — org-scoped role table (org_admin / steward / member / privacy_director / officer). |
| RLS scope | `0075_add_organizations_rls_policies.sql` enables `user_can_access_org()` checks; **238 policies** in production isolate org data. |
| RLS context | Postgres setting `app.current_organization_id` injected per request; fail-closed (missing context throws). |
| Cross-org leak prevention | Verified in `ue-qa/readiness-summary.md`: PASS. |
| Deployment shape | One Container App + one Postgres flexible server per environment (staging / demo / pilot / prod). Per-customer = a new org row, not a new deployment. |

This model supports **dozens of pilots per environment** without provisioning work, conditional on multi-fixture bootstrap (§1.3 #4) and admin approval UI (§1.3 #3).

---

## 5. Billing Integration State

| Component | Status | Path |
|---|---|---|
| Stripe webhook handler | ✅ | [apps/union-eyes/app/api/payments/webhooks/stripe/route.ts](../../apps/union-eyes/app/api/payments/webhooks/stripe/route.ts) — handles `checkout.session.completed`, `payment_intent.succeeded`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`. |
| Checkout creation | ✅ | [apps/union-eyes/app/api/payments/checkout/create/route.ts](../../apps/union-eyes/app/api/payments/checkout/create/route.ts) |
| Subscription management API | ✅ | [apps/union-eyes/app/api/billing/subscriptions/route.ts](../../apps/union-eyes/app/api/billing/subscriptions/route.ts) — GET list, POST pause/resume. Steward+ write. |
| Billing service | ✅ | [apps/union-eyes/services/platform-economics/billing-service.ts](../../apps/union-eyes/services/platform-economics/billing-service.ts) |
| Subscription lifecycle service | ✅ | [apps/union-eyes/services/platform-economics/subscription-lifecycle-service.ts](../../apps/union-eyes/services/platform-economics/subscription-lifecycle-service.ts) |
| Pricing calculator | ✅ | [apps/union-eyes/services/platform-economics/pricing-calculator.ts](../../apps/union-eyes/services/platform-economics/pricing-calculator.ts) |
| Pilot → Stripe handoff | ❌ | No code path. |

---

## 6. Operational Artifacts Already in Repo

These are existing artifacts that should be treated as the basis of the pilot program, not re-authored.

| Artifact | Path | Status / Decision |
|---|---|---|
| Pilot dry-run manifest | [artifacts/ue-pilot-dryrun/dry-run-manifest.json](../../artifacts/ue-pilot-dryrun/dry-run-manifest.json) | `DRY_RUN_SUCCESS`, 17/17 components PASS, 2026-05-03. Human approval PENDING. |
| Pilot launch evidence pack | [artifacts/ue-pilot-launch/launch-evidence-pack.md](../../artifacts/ue-pilot-launch/launch-evidence-pack.md) | `GO_WITH_RESTRICTIONS`, code-level blockers resolved. |
| QA readiness summary | [artifacts/ue-qa/readiness-summary.md](../../artifacts/ue-qa/readiness-summary.md) | `GO_FOR_PRODUCTION`, decision `GO`. 100% user/UX/pilot/production/RBAC/audit/E2E coverage. |
| Pilot readiness memo | [docs/union-eyes/pilot-evidence-pack/PILOT_READINESS_MEMO.md](../../docs/union-eyes/pilot-evidence-pack/PILOT_READINESS_MEMO.md) | Controlled pilot GO. All conditions defined; restore drill complete. |
| Pilot scope lock | [docs/union-eyes/pilot-evidence-pack/PILOT_SCOPE_LOCK.md](../../docs/union-eyes/pilot-evidence-pack/PILOT_SCOPE_LOCK.md) | Locked v1.0. **1 org / ≤5 worksites / ≤200 members / 90 days.** In-scope vs. excluded features explicit. |
| Pilot operations runbook | [docs/union-eyes/pilot-evidence-pack/PILOT_OPERATIONS_RUNBOOK.md](../../docs/union-eyes/pilot-evidence-pack/PILOT_OPERATIONS_RUNBOOK.md) | Pre-launch gates L-001 → L-006, onboarding checklist, role definitions, support tiers. |
| Runtime evidence pack | [docs/union-eyes/pilot-evidence-pack/RUNTIME_EVIDENCE_PACK.md](../../docs/union-eyes/pilot-evidence-pack/RUNTIME_EVIDENCE_PACK.md) | Live evidence capture methodology. |
| Security buyer pack | [docs/union-eyes/pilot-evidence-pack/SECURITY_BUYER_PACK.md](../../docs/union-eyes/pilot-evidence-pack/SECURITY_BUYER_PACK.md) | Security controls for procurement. |
| CI governance evidence | [docs/union-eyes/pilot-evidence-pack/CI_GOVERNANCE_EVIDENCE.md](../../docs/union-eyes/pilot-evidence-pack/CI_GOVERNANCE_EVIDENCE.md) | Pipeline gate evidence. |
| Production cutover checklist | [apps/union-eyes/docs/operations/PRODUCTION_CUTOVER_CHECKLIST.md](../../apps/union-eyes/docs/operations/PRODUCTION_CUTOVER_CHECKLIST.md) | 34-item pre-flight. |
| Demo runbook | [apps/union-eyes/docs/operations/DEMO_RUNBOOK.md](../../apps/union-eyes/docs/operations/DEMO_RUNBOOK.md) | Demo script + recovery cheatsheet. |
| Deployment rehearsal | [apps/union-eyes/docs/operations/DEPLOYMENT_REHEARSAL.md](../../apps/union-eyes/docs/operations/DEPLOYMENT_REHEARSAL.md) | Live deployment observation procedure. |

**Takeaway:** the documentation surface is already enterprise-grade and procurement-defensible. The gap is **commercial packaging**, not engineering rigor.

---

## 7. Marketing Surface Inventory (Verified)

The pilot-request route is one of 26 marketing routes already in production. Full inventory under [apps/union-eyes/app/\[locale\]/(marketing)/](../../apps/union-eyes/app/[locale]/(marketing)/):

`case-studies` · `contact` · `continuity-assessment` · `conventions` · `executive-intelligence` · `features` · `for-clc` · `for-federations` · `for-leadership` · `for-members` · `for-representatives` · `governance` · `insights` · `institutional-continuity` · `legal` · `organizational-continuity` · `pilot-request` · `platform` · `pricing` · `proof` · `solutions` · `status` · `story` · `trust` · `whitepaper` · `whitepapers`

The pricing page surface (verified 2026-06-01) presents:
- An **assessment ladder**: Free Readiness Check, Leadership Briefing Report ($1,200), Full Diagnostic & Action Plan ($6,500 — 100% credited to subsequent engagement within 90 days).
- Five **engagement options** (deliberately not tiered): Assessment Engagement, Topology Engagement, Platform Engagement, Stewardship Engagement, Cohort Engagement.

Notably absent: a **Pilot Engagement** entry. This is the single biggest commercial gap in the marketing surface and a recurring source of mid-funnel confusion (a prospect cannot self-identify a pilot path from the page).

---

## 8. Phase 5 Verdict

### 8.1 Readiness Scores (0–100)

| Dimension | Score | Rationale |
|---|---|---|
| **Commercial Readiness** | **48** | Strong intake + CRM sync + pricing page; weak pilot SKU, weak approval UX, no proposal generator, no demo-request capture. |
| **Pilot Readiness** | **78** | Evidence pack signed off; scope-lock parameters explicit; full operational runbook; intake-to-deployment pipeline works for the locked single-org shape. Capped below 90 by missing approval UI, missing proposal generator, single-fixture bootstrap. |
| **Deployment Readiness** | **88** | Dedicated pilot environment; Bicep + provisioning scripts cover 4 environments; RLS + 238 isolation policies; QA `GO`; dry-run 17/17. Capped below 100 by manual demo→real handoff and absence of multi-fixture bootstrap. |
| **Enterprise Readiness** | **62** | RLS isolation, audit trail, evidence export, Canadian data residency, malware scan, type safety, deployment separation. Capped by: no SOC 2 Type I, no pen-test yet, no multi-org production allowlist, finance persistence out-of-scope, no formal SLA enforcement. |

### 8.2 Top 10 Strengths

1. **Pilot evidence pack already signed off** (`PILOT_READINESS_MEMO`, 2026-05-03) at exactly the shape a hospital local needs (1 org, ≤200 members, 90 days).
2. **RLS-isolated multi-tenancy** with 238 policies in production; cross-org leak test PASS.
3. **Dedicated pilot environment** at `pilot.unioneyes.app` with its own RG, DB, and provisioning path.
4. **Working pilot intake pipeline**: form → API → DB → HubSpot sync in production today; bilingual.
5. **Transparent, documented scoring**: readiness (pre-pilot) and health (mid-pilot) algorithms with explicit weights and narrative recommendations.
6. **Full event-stream observability**: friction detection, champion detection, conversion-readiness signals all live.
7. **Stripe billing integrated** with webhook handlers and subscription management API.
8. **17/17 dry-run components PASS**; QA decision `GO_FOR_PRODUCTION`.
9. **Operational runbook + role definitions + support tiers** already authored (`PILOT_OPERATIONS_RUNBOOK`).
10. **Pricing page philosophy intact**: no per-seat tier-shopping; cadence (annual vs. one-time) explicit in price lines; diagnostic credits forward.

### 8.3 Top 10 Gaps

1. **No Pilot Engagement SKU on the pricing page.** Highest-impact gap; sales conversations land in confusion (see CUPE 4373: "is this $40K monthly or one-time?").
2. **No pilot proposal generator.** Every quote is assembled manually.
3. **No admin pilot-approval UI.** Approvals are a database edit today.
4. **CUPE-specific bootstrap fixture.** A second customer requires code work.
5. **No demo → real-org handoff automation.** Manual procedure.
6. **No pilot closeout / graduation workflow.** Pilots have no defined end-of-program transition.
7. **No pilot → subscription conversion flow.** Stripe exists; the trigger doesn't.
8. **No demo-request capture surface.** All demos are scheduled manually outside the platform.
9. **No customer-facing pilot success-criteria negotiation surface.** Targets are implicit.
10. **No software enforcement of `PILOT_SCOPE_LOCK` parameters** (200 members, 5 worksites). Contractual today; should become guardrails.

### 8.4 Recommended Next 30 Days

Bracketed by CUPE 4373's end-of-June decision deadline.

| Week | Focus | Key actions |
|---|---|---|
| **Wk 1 (Jun 2–8)** | Close the B deal mechanics. | Send 24-question intake to B. Schedule discovery call. Draft and send fixed-fee pilot proposal (see [union-eyes-first-customer-playbook.md](./union-eyes-first-customer-playbook.md)). |
| **Wk 2 (Jun 9–15)** | Plumb the missing tier on the pricing page. | Add **Pilot Engagement** card on the pricing page (EN + FR) sitting between the diagnostic ladder and the Assessment Engagement, with credit-forward language. Refactor `bootstrap/cupe/route.ts` to take a fixture id (generic-bootstrap groundwork). |
| **Wk 3 (Jun 16–22)** | Ship admin pilot-approval UI. | Minimal table view at `app/admin/pilots/page.tsx` listing `pilotApplications` with status transitions. B's signed proposal becomes the first record. |
| **Wk 4 (Jun 23–30)** | Pilot kickoff readiness. | Run pre-launch gates L-001 → L-006 for B. Confirm DPA, Azure runtime, KV separation, scope letter, escalation routing. Bootstrap the CUPE 4373 org on `pilot.unioneyes.app`. |

### 8.5 Recommended Next Customer Motion (after CUPE 4373)

After CUPE 4373 enters delivery, the next prospect motion should be:

1. **Sector-adjacent, scope-lock-fit prospect.** Another single-employer local in healthcare, municipal, or education (the ICP defined in [union-eyes-pilot-program.md](./union-eyes-pilot-program.md)). Avoid federations and multi-employer locals for pilots 2 and 3.
2. **Inbound-first via the pricing page.** Once the Pilot Engagement card is live, the discovery conversation begins with the prospect already calibrated to a bounded engagement.
3. **Reuse, don't customize.** Pilots 2 and 3 should use the same intake, the same scope lock, the same delivery shape, and (per the gap analysis) the generic bootstrap fixture. The pricing band, the kickoff workshop, the 90-day cadence, and the exit paths do not change.
4. **Reference CUPE 4373.** Treat the first pilot as the reference case study; capture artifacts at month 3 explicitly for that purpose.

### 8.6 Recommended Pricing Model Structure

*Structure only — no numbers; numeric ranges are negotiated per-customer or set in a separate pricing decision.*

| Layer | Shape | Why |
|---|---|---|
| **Diagnostic** (existing) | Fixed fee, one-time, 100% credited to a subsequent engagement within 90 days. | Already on the page; cheap entry; truth-manifest discipline preserved. |
| **Pilot Engagement** (NEW) | Bounded fixed fee, 90 days, deployed to `pilot.unioneyes.app`, scope-locked to the `PILOT_SCOPE_LOCK` parameters. 100% credited to a subsequent annual engagement signed within 60 days of pilot conclusion. | Closes the chasm between the diagnostic and the Assessment Engagement. Gives prospects a real deployment with a defined exit. |
| **Assessment / Topology / Platform / Stewardship / Cohort Engagements** (existing) | Existing structure preserved. | These remain the post-pilot continuum. The Pilot Engagement is the on-ramp; these are the destinations. |

**Non-negotiables to retain:**
- No per-seat pricing (the page philosophy already rejects this).
- Cadence in the price line on every card (already implemented after the 2026-06-01 revision).
- Credit-forward at each upstream rung (diagnostic → pilot → engagement).
- Platform Engagement remains explicitly post-pilot or post-Assessment.

---

## 9. Cross-References

- Pilot program specification → [union-eyes-pilot-program.md](./union-eyes-pilot-program.md)
- Pilot delivery model → [union-eyes-pilot-delivery-model.md](./union-eyes-pilot-delivery-model.md)
- Gap analysis with effort + phase → [union-eyes-pilot-readiness-gap-analysis.md](./union-eyes-pilot-readiness-gap-analysis.md)
- CUPE 4373 / Prospect B playbook → [union-eyes-first-customer-playbook.md](./union-eyes-first-customer-playbook.md)
