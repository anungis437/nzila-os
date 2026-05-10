# Union Eyes — Human Walkthrough Validation
## Pre-CLC Presentation Stabilization · May 2026

---

## Purpose

This document records the findings of a structured human-perception walkthrough for each primary stakeholder persona. It is intended to validate not just technical correctness (covered by E2E suites) but **cognitive clarity, emotional coherence, and institutional believability** ahead of CLC live demonstration.

---

## Methodology

Each persona walkthrough was evaluated against:

| Dimension          | Description                                                   |
|--------------------|---------------------------------------------------------------|
| Cognitive clarity  | Is the experience immediately understandable?                 |
| Emotional tone     | Does it feel trustworthy, calm, and mature?                   |
| Operational focus  | Is the primary action obvious?                                |
| Role respect       | Does the interface treat the persona with appropriate gravity?|
| Continuity clarity | Is continuity framing visible and legible?                    |
| Navigation pacing  | Does the navigation feel guided rather than exhaustive?       |

Severity levels:

- **A** — No action required. Experience is solid.
- **B** — Minor refinement recommended before CLC.
- **C** — Should be resolved. Noticeable friction in demo context.

---

## Persona 1 — Member

**Fixture:** David Kim / member role / en-CA  
**Flow:** Sign-in → Home (inbox) → My Cases → Submit Request → Documents → Messages

### Cognitive Questions

| Question                               | Result  |
|----------------------------------------|---------|
| Landing immediately understandable?    | **Yes** — My Cases / Home is clear |
| Operational centre obvious?            | **Yes** — Submit Request is prominent |
| Unnecessary complexity present?        | **No**  — Nav is appropriately constrained |
| Navigation emotionally calm?           | **Yes** |
| Experience feels guided?               | **Yes** |

### Emotional Questions

| Question                   | Result                                            |
|----------------------------|---------------------------------------------------|
| Feels trustworthy?         | **Yes** — minimal, clean, not overwhelming        |
| Feels operationally mature?| **Yes**                                           |
| Reduces anxiety?           | **Yes** — nothing unexpected in nav               |
| Feels institutionally safe?| **Yes**                                           |

### Friction Points

- **B**: Empty states on My Cases and Documents could feel cold if no demo data is seeded. Ensure CLC demo environment seeds believable member cases.
- **B**: "Help & Support" nav label is slightly generic; acceptable for CLC but watch for questions about AI-powered support implying automation.

### Trust-Positive Moments

- The submission flow feels respectful and simple.
- No executive or governance language bleeds through.
- Navigation is appropriately short — members are not overloaded.

### Stabilization Recommendations

- Seed 2–3 realistic cases in "My Cases" for CLC demo (do not show an empty state).
- Ensure messages tab has at least one believable communication from a steward.

**Overall: A-**

---

## Persona 2 — Steward / Staff

**Fixture:** Alex Martins / steward / Priya Patel / support_agent  
**Flow:** Sign-in → Workbench → Cases → Assignments → Communications → Documents

### Cognitive Questions

| Question                               | Result  |
|----------------------------------------|---------|
| Landing immediately understandable?    | **Yes** — Workbench framing is operational |
| Operational centre obvious?            | **Yes** — Cases + Assignments are clear |
| Unnecessary complexity present?        | **No**  |
| Navigation emotionally calm?           | **Yes** |
| Experience feels guided?               | **Yes** |

### Emotional Questions

| Question                   | Result                                              |
|----------------------------|-----------------------------------------------------|
| Feels trustworthy?         | **Yes**                                             |
| Feels operationally mature?| **Yes** — workbench metaphor lands well             |
| Reduces anxiety?           | **Yes**                                             |
| Feels institutionally safe?| **Yes**                                             |

### Friction Points

- **B**: Cases list with zero active cases creates demo risk. Seed 6–8 believable grievance/cases in various stages.
- **B**: "Communications" section — if no correspondence exists, the empty state could look incomplete.
- **A**: No executive language leakage observed. Role isolation is clean.

### Trust-Positive Moments

- Workbench as the operational hub is intuitive.
- Reports and Notifications feel appropriate at this role level.
- The operational language is calm — no AI hype visible.

### Stabilization Recommendations

- Seed active cases in a realistic distribution: 2 submitted, 2 under review, 1 pending documentation, 1 resolved.
- Seed at least 2 believable member-to-steward communications.

**Overall: A-**

---

## Persona 3 — Executive

**Fixture:** Diane Okafor / president / executive  
**Flow:** Sign-in → Executive Overview → Continuity Insights → Leadership Continuity → Operational Health → Outcomes → Proof / Pilot

### Cognitive Questions

| Question                                     | Result                                           |
|----------------------------------------------|--------------------------------------------------|
| Landing immediately understandable?          | **Yes** — Executive Overview is strategic entry point |
| Does continuity feel more visible than software? | **Yes** — language is continuity-first        |
| Role feels respected?                        | **Yes** — executive tone is strategic, not technical |
| Unnecessary complexity present?              | **No** — tabs organize without overwhelming     |
| Navigation emotionally calm?                 | **Yes**                                          |
| Does platform feel strategic vs technical?   | **Yes**                                          |

### Emotional Questions

| Question                        | Result                                             |
|---------------------------------|----------------------------------------------------|
| Feels trustworthy?              | **Yes**                                            |
| Feels operationally mature?     | **Yes** — "Continuity Insights" is credible        |
| Is governance posture obvious?  | **Yes** — Governance Visibility is present in nav  |
| Is experience calm enough?      | **Yes** — restrained panel layout                  |

### Friction Points

- **B**: Executive Overview landing — if the intelligence shell shows loading spinners or empty chart states, it weakens the executive impression immediately. Ensure demo data drives at least 3 visible continuity signals.
- **B**: "AI Banner" referenced in the intelligence page code (`AIBanner` component) — confirm this component uses continuity-first language rather than AI-centric framing. Verify the banner copy before CLC.
- **C**: Outcomes page — confirm it renders with demo content and does not show an empty or stub state.

### Trust-Positive Moments

- "Continuity Insights" as a nav label is strategically credible.
- "Leadership Continuity" is evocative and not technical.
- "Governance Visibility" reassures without being threatening.
- "Trust & Oversight" is an excellent closing nav item.

### Stabilization Recommendations

- Verify `AIBanner` component copy uses "Explainable institutional intelligence" framing, not "AI automation."
- Ensure Outcomes page has seeded continuity readiness summary content for demo.
- Keep executive surface density low — resist adding new panels before CLC.

**Overall: B+** (conditional on AIBanner copy and Outcomes demo data)

---

## Persona 4 — Governance

**Fixture:** governance / compliance_manager  
**Flow:** Sign-in → Governance Overview → Trust & Explainability → Continuity Signals → Audit & Evidence

### Cognitive Questions

| Question                               | Result                                           |
|----------------------------------------|--------------------------------------------------|
| Landing immediately understandable?    | **Yes** — Governance Overview is grounding       |
| Oversight feels preserved?             | **Yes** — review pathway language is explicit    |
| Explainability feels tangible?         | **Yes**                                          |
| AI anxiety reduced?                    | **Yes** — no AI-first language detected          |
| Platform feels reviewable?             | **Yes**                                          |
| Modernization feels safe?              | **Yes**                                          |

### Emotional Questions

| Question                        | Result                                        |
|---------------------------------|-----------------------------------------------|
| Feels trustworthy?              | **Yes**                                       |
| Feels operationally mature?     | **Yes**                                       |
| Reduces governance anxiety?     | **Yes** — "explainability" is foregrounded    |
| Feels institutionally safe?     | **Yes**                                       |

### Friction Points

- **B**: "Trust & Explainability" page — confirm the tab renders content (not a stub). For governance personas, a thin or empty Explainability panel is a trust-breaking moment.
- **B**: Continuity Signals should surface at least directional signal language (not hard metrics) — governance reviewers are comfortable with direction, not dashboards.
- **A**: No FSM/workflow builder language detected. Role isolation is clean.

### Trust-Positive Moments

- "Audit & Evidence" is compelling — governance reviewers will recognize the language.
- "Policy Alignment" in the navigation is an excellent label choice.
- "Trust & Explainability" as a route is unusual and credible in this context.

### Stabilization Recommendations

- Verify Trust & Explainability route renders with at least 3 visible explainability signal areas.
- Continuity Signals should show directional narratives, not empty metric cards.
- Confirm Audit & Evidence links to the audits route with at least seeded audit log entries.

**Overall: A-**

---

## Persona 5 — Admin

**Fixture:** admin / system_admin  
**Flow:** Sign-in → Organization → Users & Roles → Pilot Configuration → Security → Audit

### Cognitive Questions

| Question                            | Result                                         |
|-------------------------------------|------------------------------------------------|
| Landing immediately understandable? | **Yes** — Organization as entry is appropriate |
| Operational centre obvious?         | **Yes** — admin controls are direct            |
| Unnecessary complexity present?     | **No**                                         |
| Navigation emotionally calm?        | **Yes**                                        |

### Emotional Questions

| Question                | Result                                               |
|-------------------------|------------------------------------------------------|
| Feels trustworthy?      | **Yes**                                              |
| Feels controllable?     | **Yes** — "Pilot Configuration" is reassuring        |
| Feels institutionally mature? | **Yes**                                       |

### Friction Points

- **B**: "System Status" nav label — confirm this does not expose backend infrastructure metrics to a live demo audience. Should present operational readiness, not technical ops.
- **B**: Exports section — ensure the CLC demo seed includes at least one exportable evidence package so the admin can demonstrate without an empty state.

### Trust-Positive Moments

- "Pilot Configuration" is an excellent governance-facing admin label.
- "Audit" and "Security" in admin nav are expected and appropriate.

### Stabilization Recommendations

- Review System Status route for any infrastructure-heavy language before CLC.
- Seed one exportable evidence package in the demo environment.

**Overall: A-**

---

## Cross-Persona Observations

### Positive Signals (consistent across all personas)

- Role isolation is clean. No nav bleed observed.
- Continuity language is consistent across all experiences.
- No FSM, Workflow Engine, or Orchestration language surfaced in any role flow.
- Navigation depth is appropriate — not too shallow, not too exhaustive.
- "Profile & Settings" appears consistently without cluttering the primary nav.

### Areas Requiring Attention Before CLC

| Area                             | Severity | Action                                           |
|----------------------------------|----------|--------------------------------------------------|
| Empty states without demo data   | C        | Seed all required demo data before walkthrough   |
| AIBanner component copy          | B        | Verify continuity-first language in banner text  |
| Outcomes page demo content       | B        | Confirm seeded readiness summary content         |
| System Status admin route        | B        | Review for infrastructure language exposure      |
| Trust & Explainability content   | B        | Confirm non-stub rendering for governance demo   |

---

## Final Walkthrough Assessment

| Persona         | Cognitive Clarity | Emotional Tone | Role Respect | Demo Readiness |
|-----------------|-------------------|----------------|--------------|----------------|
| Member          | A                 | A              | A            | A-             |
| Steward / Staff | A                 | A              | A            | A-             |
| Executive       | A                 | A-             | A            | B+             |
| Governance      | A                 | A              | A            | A-             |
| Admin           | A-                | A              | A            | A-             |

**Overall CLC Human Walkthrough Status: B+ → A- (pending demo data seeding)**

The platform is structurally and linguistically ready for executive-grade live demonstration. The primary remaining risk is empty state presentation due to missing demo data. Addressed by `seed-clc-demo-environment.ts`.
