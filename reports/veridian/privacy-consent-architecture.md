---
platform: veridian-care
type: privacy-architecture
version: 1.0.0
status: pilot-ready
generated: 2026-04-27
---

# Veridian Care — Privacy and Consent Architecture

This document describes the consent engine, privacy controls, and audit architecture that govern
all patient data access in the Veridian Care platform. It is intended for Privacy Officers, data
governance leads, and security reviewers evaluating the platform.

---

## Consent Engine Architecture

The Veridian Care consent engine sits at the boundary between every data request and the underlying
patient record. **No query reaches a patient record without first passing through the consent engine.**

The consent engine evaluates three inputs on every request:

1. **Actor identity and role** — who is making the request and what role they hold
2. **Consent scopes assigned to that role** — what data fields and actions that role is permitted
3. **Patient-level consent preferences** — any additional restrictions or permissions set by or
   for the specific patient

Only if all three conditions are satisfied does the request proceed. If any condition fails,
the request is rejected and a consent-denial audit event is written.

---

## Role-Based Consent Scopes

Veridian Care defines six platform roles. Each role is granted a curated set of consent scopes
aligned with the clinical or administrative function of that role.

| Role | Description |
|---|---|
| `CLINICIAN` | Primary care clinician. Broad read access to support longitudinal care. |
| `SPECIALIST` | Referral specialist. Scoped to relevant clinical domains (e.g., cardiology). |
| `NURSE` | Clinical support. Read access to active orders, medications, and vitals. |
| `ADMIN` | Administrative staff. Access to scheduling, demographics, and referral status only. |
| `PRIVACY_OFFICER` | Data governance role. Access to audit logs, consent configurations, and PIA records. |
| `AUDITOR` | Read-only audit access. Can review audit logs and data access records, no patient data. |

Role assignments are managed by network administrators in the veridian-admin portal. Role elevation
requires explicit written approval from a Privacy Officer or equivalent.

---

## Consent Scopes

Consent scopes are the atomic unit of data access control in Veridian Care. Each scope governs
access to a specific data domain or action type.

| Scope | Data Domain | Permitted Roles |
|---|---|---|
| `READ_TIMELINE` | Unified clinical timeline | CLINICIAN, SPECIALIST |
| `READ_LABS` | Laboratory results | CLINICIAN, SPECIALIST, NURSE |
| `READ_MEDICATIONS` | Medication records and prescriptions | CLINICIAN, SPECIALIST, NURSE |
| `READ_REFERRALS` | Referral status and history | CLINICIAN, SPECIALIST, ADMIN |
| `READ_DEMOGRAPHICS` | Patient demographic information | CLINICIAN, ADMIN |
| `READ_VITALS` | Vital signs and observations | CLINICIAN, SPECIALIST, NURSE |
| `WRITE_CONSENT` | Update patient consent preferences | CLINICIAN, PRIVACY_OFFICER |
| `READ_AUDIT_LOG` | Access to audit event records | PRIVACY_OFFICER, AUDITOR |
| `ADMIN_USER_MANAGEMENT` | Provision and manage user roles | ADMIN (network admin only) |

Scope assignments are versioned and audited. Changes to scope assignments require Privacy Officer
approval and are logged as governance events in the audit trail.

---

## Break-Glass Protocol

The break-glass protocol is an emergency access pathway designed for clinical situations where
patient safety requires access outside the standard consent scope — for example, when an
unconscious patient presents at an unfamiliar site.

### How Break-Glass Works

1. The clinician selects the break-glass access option in the Veridian Care portal.
2. The platform prompts for a **mandatory written reason** before any data is returned.
3. The reason, the clinician's identity and role, the patient identifier, the data domains
   accessed, the timestamp, and the session context are written to an **immutable audit event**
   immediately — before the data is returned to the screen.
4. The data is returned with a persistent **break-glass indicator** visible throughout the session.
5. The break-glass event is surfaced to the Privacy Officer role in the audit dashboard in real time.
6. Post-access review is triggered automatically: the Privacy Officer receives a notification
   to review the access within 24 hours.

### What Break-Glass Does Not Do

- Break-glass does not bypass audit logging. It is the most heavily logged access path.
- Break-glass does not grant permanent elevated access. Each break-glass event is a single-session,
  single-patient authorisation.
- Break-glass does not suppress consent preferences. It records a justification override; it does
  not delete the patient's consent record.

---

## Audit Event Shape

Every consent decision, data access, and break-glass event produces a structured audit event.
The audit event shape is:

```json
{
  "actorId": "string — anonymised actor reference",
  "role": "CLINICIAN | SPECIALIST | NURSE | ADMIN | PRIVACY_OFFICER | AUDITOR",
  "tenantId": "string — organisation identifier",
  "siteId": "string — site within the organisation",
  "patientId": "string — anonymised patient reference",
  "action": "READ | WRITE | BREAK_GLASS | CONSENT_DENIED | ADMIN",
  "scope": "consent scope invoked (e.g. READ_LABS)",
  "reason": "string — mandatory for BREAK_GLASS, optional otherwise",
  "timestamp": "ISO 8601 UTC",
  "sessionId": "string — session reference for correlation",
  "source": "veridian-care | veridian-admin | api"
}
```

Audit events are written to an append-only store. No application-layer operation can modify or
delete an audit event once written.

---

## Data Scoping Model

Every record in Veridian Care is tagged with a three-part scope key at the point of ingestion:

```
organization_id + site_id + environment
```

This scoping is enforced at the data model level, not just at the API layer. A query that does
not carry a valid scope context cannot return results — the query will fail at the data layer
before reaching any patient record.

**Cross-site data access** (where a clinician at Site A needs to view records from Site B for a
shared patient) requires an explicit cross-site access agreement configured by the Privacy Officer.
This agreement is logged as a governance event and is audited on every cross-site access.

**Environment isolation:** The `environment` field (`staging` / `production`) is part of the
scope key. Synthetic demo data and live production data cannot be co-mingled at the data layer.

---

## Privacy Review Requirements

Before any live patient data is onboarded to a new site:

1. A **Privacy Impact Assessment (PIA)** must be completed and approved by the designated
   Privacy Officer for that organisation.
2. The PIA documents: data flows, consent scope mappings, cross-site access agreements,
   retention policies, and incident notification procedures.
3. The PIA outcome is stored as a governance record in the veridian-admin portal and referenced
   in the site's operational record.
4. The Privacy Review Gate is enforced in the deployment pipeline: production data onboarding
   cannot proceed without a PIA record in an approved state.

---

## No PHI Policy

Veridian Care enforces a strict no-PHI policy in all non-production environments:

- Synthetic demo environments contain only fabricated data with no relationship to any real
  patient, clinician, or healthcare organisation.
- All synthetic records carry a `synthetic: true` classification label, surfaced in the platform
  UI and in all exported artifacts.
- Developer and test environments are governed by the same no-PHI policy. Any accidental
  introduction of real patient data into a non-production environment is treated as a P1
  security incident.

---

## Legal Notice

This document describes architectural design intentions and consent model design. It does not
constitute a regulatory compliance certification or a legal privacy opinion. All language uses
**designed for**, **aligned with**, and **supports** framing. Independent legal and regulatory
review is required before production deployment in any regulated environment.
