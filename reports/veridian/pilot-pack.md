---
platform: veridian-care
type: pilot-pack
version: 1.0.0
status: pilot-ready
generated: 2026-04-27
---

# Veridian Care — 90-Day Pilot Pack

## Executive Summary

Veridian Care is a governed clinical orchestration layer designed to unify fragmented patient records
across multi-site healthcare networks. This pilot pack outlines a structured 90-day onboarding path
that gives your clinical and IT teams hands-on access to the platform in a safe, synthetic environment
before any live data is involved.

The pilot is designed to validate integration readiness, build staff familiarity, and produce a
documented baseline for production decision-making — all without displacing your existing EMR systems
or clinical workflows.

---

## What Veridian Care Does

### One Patient Story

Maria is a 68-year-old patient managed across three sites in your network: a primary care clinic, a
cardiology specialist centre, and a community diagnostic lab. Today, when Maria presents at the
specialist centre, her cardiologist has no visibility into the lab results ordered at the primary care
clinic last week. Staff spend 20 minutes on hold to gather history. Orders are duplicated.

With Veridian Care, the cardiologist sees a unified clinical timeline — labs, medications, referrals,
visit notes — sourced from all connected sites, presented in a single governed view. Access is
role-scoped. Every data access is logged. Maria's consent preferences are respected automatically.

### What Veridian Care Is

Veridian Care is a **governed orchestration layer** that sits above your existing EMRs. It does not
replace your source systems. It connects them, normalises records, resolves patient identity, and
enforces consent and access controls at the point of use.

- Designed for multi-site healthcare networks with fragmented data
- Integration-ready with FHIR R4, HL7 v2, CSV, and REST connector types
- Built around a role-based consent model aligned with healthcare privacy principles
- Supports clinician, specialist, nurse, admin, privacy officer, and auditor roles

---

## Pilot Scope

The 90-day pilot is structured across three 30-day phases. Each phase has defined deliverables and
clear entry and exit criteria.

---

### Phase 1 — Days 1–30: Integration Readiness

**Objective:** Establish the technical foundation and validate connector compatibility.

**Activities:**
- Integration readiness review: assessment of your existing EMR systems, data formats, and network
  topology against Veridian Care's connector requirements
- Connector setup: configuration of FHIR R4 or HL7 v2 connectors in the staging environment using
  synthetic data only — no live patient records at this stage
- Synthetic demo environment provisioned: a fully functional demonstration environment pre-loaded
  with synthetic patient data, clearly labeled as non-PHI throughout
- IT point-of-contact briefing: environment access, credential management, and connectivity walkthrough

**Exit Criteria:**
- Integration readiness report delivered
- At least one connector type validated against synthetic data
- Staging environment accessible to designated pilot contacts

---

### Phase 2 — Days 31–60: Clinician Portal Access

**Objective:** Give clinical staff hands-on experience with the unified patient timeline and consent model.

**Activities:**
- Clinician portal access enabled for designated pilot users against the synthetic demo environment
- Staff training sessions: role-based onboarding for clinicians, nurses, and admin staff covering
  timeline navigation, consent scope visibility, and break-glass protocol awareness
- Consent model review: walkthrough of role-based consent scopes with your Privacy Officer or
  designated data governance lead
- Feedback collection: structured feedback from pilot users on workflow fit, terminology, and
  identified gaps

**Exit Criteria:**
- Minimum 5 clinical pilot users onboarded and trained
- Consent model review completed and documented
- Feedback summary delivered to Veridian Care team

---

### Phase 3 — Days 61–90: Network Admin Portal and KPI Baseline

**Objective:** Validate administrative controls and produce a pilot readiness report.

**Activities:**
- Network admin portal access for designated administrative users: site management, user provisioning,
  audit log review, and operational dashboard walkthrough
- KPI baseline established: agreed metrics documented at pilot start to support post-go-live measurement
  (see [roi-framework.md](./roi-framework.md) for the full measurement methodology)
- Bi-weekly check-in 3: structured review of pilot progress, outstanding integration items, and
  go/no-go assessment
- Pilot readiness report delivered: a written summary of integration findings, staff feedback, consent
  model review outcomes, and recommended next steps

**Exit Criteria:**
- Admin portal validated by designated network administrator
- KPI baseline documented
- Pilot readiness report delivered and accepted

---

## What's Included in the Pilot

| Item | Detail |
|---|---|
| veridian-care portal access | Role-scoped clinician and specialist portal, synthetic environment |
| veridian-admin portal access | Network admin portal for site and user management |
| Integration readiness review | Assessment of connector compatibility with your source systems |
| Synthetic demo environment | Pre-loaded, clearly labeled synthetic patient data — no PHI |
| Bi-weekly check-ins (×3) | Structured progress reviews at Day 15, Day 45, Day 75 |
| Pilot readiness report | Written summary of findings and recommended next steps |

---

## What's Not Included

- **Live patient data migration:** No PHI is involved at any stage of the pilot. Live data onboarding
  is a post-pilot activity subject to a separate privacy review gate.
- **EMR replacement:** Veridian Care is an orchestration layer. It is not designed to replace your
  existing EMR systems.
- **Compliance certification:** Veridian Care is designed for alignment with healthcare privacy and
  security standards, but does not provide or guarantee regulatory certification for your organisation.
- **24/7 production support SLA:** Pilot support operates on a best-effort basis during business hours.

---

## Prerequisites

Before the pilot begins, the following must be in place:

| Prerequisite | Detail |
|---|---|
| Designated clinical champion | A senior clinician who can validate workflow fit and coordinate staff feedback |
| IT point of contact | A technical contact responsible for network access and connector configuration |
| Network connectivity assessment | Confirmation that your network can reach Veridian Care staging endpoints |
| Data governance contact | Privacy Officer or equivalent to participate in the consent model review |

---

## Legal Notice

All documents in this pack use **designed-for**, **aligned-with**, **supports**, **pilot-ready**, and
**integration-ready** language. No certifications are claimed. No compliance badges are awarded through
this pilot. No real patient records are used at any stage of the pilot process.

The synthetic demo environment contains fabricated data only. All synthetic records are explicitly
labeled throughout the platform interface and in all exported artifacts.
