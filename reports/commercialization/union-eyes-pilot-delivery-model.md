# Union Eyes — Pilot Delivery Model

**Purpose:** Define the lightest-weight repeatable operating model to deliver pilots using machinery already in the repository.

---

## 1. Delivery Principles

1. **Expose existing machinery first.** Do not build new subsystems if existing intake, scoring, onboarding, metrics, and deployment paths already satisfy the stage.
2. **Bound every pilot.** 90-day maximum by default, with explicit in-scope/excluded capability list.
3. **Instrument from day 1.** Every pilot action should feed readiness, adoption, and conversion-readiness signals.
4. **No ad hoc consulting drift.** Services support activation and adoption only; product remains primary value surface.
5. **Conversion is a designed workflow.** Pilot operations must naturally produce a month-3 commercial decision package.

---

## 2. Delivery Flow (Operator View)

### Stage 1 — Intake and Qualification

**Existing components to use**
1. Public route: `/{locale}/pilot/apply` (alias to existing pilot-request page).
2. Form submission endpoint: `/api/pilot/apply`.
3. Data model: `pilotApplications` + `PilotApplicationInput`.
4. Readiness engine: `calculateReadinessScore()`.
5. CRM sync: HubSpot contact + deal pipeline fields (`ue_*`).

**Operator outcome**
- New pilot application stored, scored, and visible in CRM.

### Stage 2 — Pilot Approval and Scope Lock

**Current state**
- Status enum exists in DB (`submitted`, `review`, `approved`, `active`, `completed`, `declined`).
- Approval operations are procedural/manual.

**Required operating behavior now**
1. Move application to review and approval in internal ops process.
2. Attach scope lock and success criteria before activation.
3. Ensure legal and operational prerequisites are met (DPA, named roles, escalation path).

**Planned improvement**
- Expose this as an admin review workflow (see readiness gap analysis).

### Stage 3 — Pilot Deployment Activation

**Existing components to use**
1. Pilot environment and infra provisioning artifacts.
2. Bootstrap endpoint for CUPE fixture: `/api/pilot/bootstrap/cupe`.
3. Admin seed endpoint: `/api/admin/seed-cupe-pilot` (idempotent reset-aware seeding).
4. Org isolation model: RLS with org-context enforcement.

**Operator outcome**
- Pilot org activated with baseline data and role structure in pilot environment.

### Stage 4 — Onboarding and Adoption Stabilization

**Existing components to use**
1. Onboarding API: `/api/pilot/onboarding`.
2. Checklist UI and table (`pilotChecklistItems`).
3. Pilot mode context and runtime gating.
4. Training/help/feedback pilot components.

**Operator outcome**
- Checklist complete, first workflows executed, early friction surfaced.

### Stage 5 — Operational Monitoring and Mid-Pilot Corrections

**Existing components to use**
1. Metrics API: `/api/pilot/metrics` and `/api/pilot/current`.
2. Friction API: `/api/pilot/friction`.
3. Champions API: `/api/pilot/champions`.
4. Readiness API: `/api/pilot/readiness`.
5. Feedback API: `/api/pilot/feedback`.
6. Health-scoring logic (`PilotHealthScoreBreakdown`).

**Operator outcome**
- Weekly scorecard and intervention decisions based on actual pilot telemetry.

### Stage 6 — Assessment and Commercial Decision

**Existing components to use**
1. Pilot admin overview (read-only leadership surface).
2. Pilot metrics + readiness signals.
3. Billing stack (Stripe + subscription lifecycle service) for conversion execution.

**Operator outcome**
- End-of-pilot recommendation and conversion/no-fit decision.

---

## 3. RACI (Default)

### Union Eyes Team

1. **Pilot Owner**
   - Owns timeline, success criteria, and month-3 decision package.
2. **Implementation Lead**
   - Executes deployment activation, onboarding completion, and environment readiness.
3. **Product Operations**
   - Monitors friction/adoption/champion signals and recommends interventions.
4. **Commercial Owner**
   - Owns proposal, agreement, and conversion close workflow.

### Customer Team

1. **Executive Sponsor**
   - Decision authority and month-3 go/no-go ownership.
2. **Pilot Lead (Steward/Officer)**
   - Day-to-day adoption and operational feedback.
3. **Admin/IT Contact**
   - Access, account, and security/compliance execution.
4. **Operational Users**
   - Use the platform in real workflow and provide improvement signals.

---

## 4. Pilot Artifacts Pack (Repeatable)

Every pilot should generate the same minimum artifact set:

1. Intake package (application + readiness summary).
2. Scope lock and excluded-capabilities sheet.
3. Milestone calendar and role assignment record.
4. Week-2 and week-6 pilot health snapshots.
5. End-of-pilot scorecard with exit-path recommendation.

This artifact standard is the core of repeatability.

---

## 5. Minimal Commercial Exposure Layer

These are the minimal surfaces required to convert machinery into visible customer motion:

1. **Public application URL** on a Union Eyes path.
2. **Review workflow** for operators to approve/decline and activate pilots.
3. **Proposal template generator** that converts readiness and scope into a decision document.
4. **Pilot status surface** for leadership view.
5. **Pilot-to-customer conversion step** tied to subscription/billing flow.

Everything above can be delivered by exposing existing APIs, tables, and services.

---

## 6. Lightweight Data Model Alignment

Use existing types as the canonical data contract:

1. `PilotApplicationInput`
2. `PilotApplication`
3. `PilotMetrics`
4. `PilotMilestone`
5. `PilotHealthScoreBreakdown`

Additions should be additive and conversion-focused, not structural rewrites.

---

## 7. Delivery Risks and Controls

### Primary Risks

1. Commercial bottleneck at approval stage due to missing review UI.
2. Proposal turnaround delays due to manual generation.
3. Fixture-specific bootstrap limits second-customer velocity.
4. Conversion drop-off from missing pilot-to-subscription handoff.

### Controls

1. Implement admin review queue as first exposure enhancement.
2. Standardize proposal template and auto-populate from intake.
3. Generalize bootstrap fixture selection.
4. Attach conversion playbook to month-3 assessment and automate first billing step.

---

## 8. Implementation Sequence (Exposure-First)

1. Public pilot route (completed in this cycle).
2. Pilot application review workflow (operator UI + status transitions).
3. Proposal generator (template + data-binding from readiness input/output).
4. Pilot status dashboard hardening (leadership-ready summary page).
5. Pilot-to-customer conversion workflow (subscription handoff trigger).

No new doctrine, no new governance module, no platform redesign.

---

## 9. Outcome Target

A prospect should be able to move from interest to pilot decision using product surfaces and standardized operations, with consulting used only for adoption acceleration.

That is the commercialization threshold for repeatable first-customer success.
