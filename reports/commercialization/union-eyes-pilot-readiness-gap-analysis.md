# Union Eyes — Pilot Readiness Gap Analysis

**Date:** 2 June 2026
**Objective:** Identify and prioritize the specific commercialization gaps between existing pilot machinery and a repeatable conversion pipeline.

---

## 1. Baseline

Union Eyes already has the majority of pilot foundations in place:

1. Pilot intake + persistence + readiness scoring.
2. Tenant/org isolation with RLS.
3. Pilot-mode runtime gating and onboarding checklist.
4. Pilot metrics, friction, champions, readiness APIs.
5. Pilot environment and operations runbooks.
6. Billing/subscription infrastructure.

The major gap is not technical foundation. It is **exposure and conversion orchestration**.

---

## 2. Priority Matrix

| Gap | Type | Severity | Effort | Phase |
|---|---|---|---|---|
| Public pilot route discoverability | Funnel exposure | High | Small | P0 |
| Pilot application review workflow | Commercial ops | High | Medium | P0 |
| Proposal generation framework | Commercial ops | High | Medium | P0 |
| Pilot status dashboard (leadership-facing) | Decision support | Medium | Medium | P0/P1 |
| Pilot-to-customer conversion workflow | Revenue conversion | High | Medium | P0/P1 |
| Pilot pricing structure visibility | Commercial clarity | High | Small | P0 |
| Generic bootstrap fixtures | Delivery repeatability | Medium | Medium | P1 |
| Demo→real handoff automation | Delivery efficiency | Medium | Small | P1 |
| Pilot closeout automation | Operational maturity | Medium | Medium | P1 |
| Cohort-level pilot analytics | Scale optimization | Low | Medium | P2 |

---

## 3. Gap Details

## Gap 1 — Public Pilot Route Discoverability

### Current
- Pilot form exists and is functional.
- Legacy route naming and sparse CTA linkage weaken discoverability.

### Required
1. Canonical public URL for pilot application.
2. CTA consistency across marketing pages.

### Status
- Addressed in this implementation cycle by exposing `/{locale}/pilot/apply` and wiring key CTAs.

---

## Gap 2 — Pilot Application Review Workflow

### Current
- `pilotApplications` status lifecycle exists in schema.
- No operator UI to review, score, approve/decline, and activate.

### Impact
- Commercial operations depend on manual DB/CRM handling.
- Risk of inconsistent intake-to-activation processing.

### Required
1. Admin queue view.
2. Review detail page with readiness and intake summary.
3. Status transition controls with audit metadata.

### Recommended phase
- **P0** (before second pilot)

---

## Gap 3 — Proposal Generation Framework

### Current
- Intake and readiness outputs are available.
- Proposal creation is manual.

### Impact
- Slower response cycle in active pipeline.
- Inconsistent quality in pilot proposals.

### Required
1. Standard proposal template sections:
   - Executive summary
   - Pilot scope
   - Timeline
   - Success criteria
   - Implementation approach
   - Pricing section
   - Next steps
2. Data-binding from intake/readiness outputs.
3. Export to shareable format.

### Recommended phase
- **P0**

---

## Gap 4 — Pilot Status Dashboard (Leadership)

### Current
- Metrics exist and APIs exist.
- Existing pilot admin overview is useful but not presented as a concise decision dashboard.

### Impact
- Leadership sees data but not a canonical pilot-health decision surface.

### Required
1. Single page summary for readiness, deployment status, adoption, and success progress.
2. Decision flags and milestone state visibility.

### Recommended phase
- **P0/P1** (P0 if active deal pressure; P1 otherwise)

---

## Gap 5 — Pilot-to-Customer Conversion Workflow

### Current
- Billing and subscription infrastructure is in place.
- No explicit handoff from pilot closeout to subscription start.

### Impact
- High conversion leakage at end of pilot.

### Required
1. Exit decision states linked to next-step actions.
2. If successful: subscription initiation workflow.
3. If partial/no-fit: extension or closeout workflows.

### Recommended phase
- **P0/P1**

---

## Gap 6 — Pilot Pricing Structure Visibility

### Current
- Pricing page has engagement architecture and diagnostic ladder.
- Pilot engagement tier is not clearly surfaced.

### Impact
- Prospects misclassify platform annual ranges as first-step asks.

### Required
1. Explicit pilot engagement structure in pricing/offer material.
2. Credit-forward policy from pilot to annual engagement.

### Recommended phase
- **P0**

---

## Gap 7 — Generic Bootstrap Fixtures

### Current
- Bootstrap path is CUPE fixture oriented.

### Impact
- Second-customer onboarding requires engineering edits.

### Required
1. Fixture registry or parameterized bootstrap source.
2. Sector/profile presets for hospital, municipal, education, federated small org.

### Recommended phase
- **P1**

---

## Gap 8 — Demo→Real Handoff Automation

### Current
- Procedure exists but is manual.

### Impact
- Repeatability friction at activation boundary.

### Required
1. Idempotent handoff command/API.
2. Guardrails for demo-data purge and production-safe continuity.

### Recommended phase
- **P1**

---

## Gap 9 — Pilot Closeout Automation

### Current
- No standardized closeout state machine in UI/workflow.

### Impact
- Inconsistent closure artifacts and delayed decisions.

### Required
1. Month-3 closeout checklist.
2. Automated scorecard artifact generation.
3. Exit-path assignment.

### Recommended phase
- **P1**

---

## Gap 10 — Cohort-Level Analytics

### Current
- Per-pilot metrics are available.
- No aggregate cohort lens.

### Impact
- Harder to optimize pilot model over multiple customers.

### Required
1. Multi-pilot aggregate dashboard.
2. Conversion and performance trend analytics.

### Recommended phase
- **P2**

---

## 4. Top 10 Strengths (Context for Prioritization)

1. Intake-to-readiness pipeline already operational.
2. Strong org isolation and governance controls.
3. Deployed pilot environment and runbooked operations.
4. Instrumentation for friction/champions/readiness exists.
5. Onboarding checklist model already implemented.
6. Billing and subscription stack exists.
7. Dry-run and QA evidence indicate operational maturity.
8. Scope lock discipline already documented.
9. Bilingual marketing framework exists.
10. Product narrative is coherent and non-per-seat.

---

## 5. 30-Day Gap Closure Plan (Exposure-First)

### Week 1
1. Public pilot route exposure and CTA alignment.
2. First-customer intake package publication.

### Week 2
1. Pilot application review queue and status transitions.
2. Proposal template + generation scaffold.

### Week 3
1. Leadership pilot dashboard surface.
2. Pilot pricing structure visibility updates.

### Week 4
1. Pilot-to-customer conversion workflow linkage to billing.
2. Generic bootstrap fixture work start.

---

## 6. Final Assessment

Union Eyes does not need new foundational modules to run repeatable pilots.

Union Eyes needs a focused **Pilot Conversion Layer** that exposes and orchestrates existing systems.

That is the shortest path from promising demo to first signed pilot customer and onward to repeatable commercialization.
