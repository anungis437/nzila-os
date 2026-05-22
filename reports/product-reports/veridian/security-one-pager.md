---
platform: veridian-care
type: security-one-pager
version: 1.0.0
status: pilot-ready
generated: 2026-04-27
---

# Veridian Care — Security Posture Summary

This document provides a concise summary of the security controls and design principles built into
the Veridian Care platform. It is intended for procurement, information security, and risk teams
evaluating the platform for pilot or production engagement.

---

## Security Posture Overview

Veridian Care is **designed for healthcare-grade security**. The platform is built around the principle
that every access to patient data must be authorised, scoped, logged, and auditable — before any
data is returned to the requesting application or user.

Security is not a feature layer added on top of the platform. It is embedded in the data model,
the consent engine, the API contract, and the deployment architecture from the ground up.

---

## Encryption

Veridian Care is **designed for encryption at rest and in transit**:

- **In transit:** All client-to-server and service-to-service communication is designed to use
  TLS 1.2 or higher. Plaintext transport is not supported in any environment.
- **At rest:** All persistent data stores are designed for encryption at rest using
  industry-standard encryption schemes. Encryption configuration is managed through externalized
  secret management, not hardcoded in application code.
- **Backup encryption:** Backup artifacts are designed to inherit the same encryption posture as
  the primary data store.

---

## Access Control

Veridian Care implements **role-based access control (RBAC)** with least-privilege defaults:

- Every user is assigned exactly one role. Roles are: `CLINICIAN`, `SPECIALIST`, `NURSE`,
  `ADMIN`, `PRIVACY_OFFICER`, `AUDITOR`.
- Each role is granted a defined set of **consent scopes** that controls which data fields and
  actions are accessible. No role has implicit access to all data.
- Role assignments are managed by network administrators through the veridian-admin portal.
  Role elevation requires explicit approval from a Privacy Officer or equivalent.
- **Least privilege by default:** New users are provisioned with the minimum scope required for
  their stated role. Scope expansion is a deliberate, audited action.
- All API requests carry a verified role context. Requests without a valid, scoped token are
  rejected at the API gateway before reaching any data layer.

---

## Break-Glass Protocol

For emergency clinical access where a patient's care record must be accessed outside the normal
consent scope, Veridian Care supports a **break-glass protocol**:

- Break-glass access requires the accessing user to supply a mandatory reason at the point of access.
- The reason, the accessing user's role and identifier, the patient record accessed, the timestamp,
  and the session context are all captured in an **immutable audit event** immediately on access.
- Break-glass events are surfaced to the Privacy Officer role in the audit dashboard within the
  same session.
- Break-glass access does not bypass audit logging. It is the most heavily logged access path
  in the platform.

---

## Audit Trails

Every patient-data access in Veridian Care is logged:

- Audit events are written on every read, write, and break-glass access to patient records.
- The audit event shape captures: `actorId`, `role`, `tenantId`, `siteId`, `patientId`, `action`,
  `reason` (required for break-glass), `timestamp`, `sessionId`, and `source`.
- Audit logs are **designed to be immutable**: once written, audit events are not modifiable by
  any application-layer operation.
- Audit log access is scoped to the `PRIVACY_OFFICER` and `AUDITOR` roles.
- Audit exports are available through the veridian-admin portal for compliance review.

---

## Tenant and Site Scoping

All data in Veridian Care is scoped by a three-part key:

```
organization_id + site_id + environment
```

- No query, API response, or export can return data across organisational boundaries without
  explicit cross-tenant authorisation, which requires Privacy Officer approval.
- Site-level scoping ensures that data from Site A is never visible to users scoped to Site B
  unless a cross-site access agreement has been explicitly configured.
- The `environment` field (`staging` / `production`) ensures that synthetic demo data and live
  production data are never co-mingled.

---

## Secret Management

Veridian Care is designed with the principle that **no secrets belong in application code**:

- API keys, database credentials, encryption keys, and service tokens are managed through
  externalized configuration and secret stores.
- Environment-specific secrets are injected at runtime. No secrets are committed to source
  control or bundled into build artifacts.
- Secret rotation is supported without application restarts in the deployment architecture.

---

## Synthetic Demo Environment

The Veridian Care pilot includes a fully functional synthetic demo environment:

- **No PHI is present in the synthetic demo environment.** All data is fabricated and has no
  relationship to any real patient, clinician, or healthcare organisation.
- Every record in the synthetic environment carries explicit `synthetic: true` data classification
  labels, surfaced in the platform UI and in all exported artifacts.
- The synthetic environment runs on isolated infrastructure from production. There is no data
  path between the synthetic environment and any live data store.

---

## Privacy Review Gate

Before any live patient data is onboarded to Veridian Care:

- A **Privacy Impact Assessment (PIA)** is required. No production data onboarding proceeds
  without a completed and approved PIA.
- The PIA reviews data flows, consent scope mappings, retention policies, and cross-site access
  agreements for the specific site being onboarded.
- The Privacy Review Gate is a hard blocker in the deployment process, not an advisory step.

---

## Incident Response

Veridian Care is **designed for structured incident classification and response**:

- The platform supports incident classification by severity (P1–P4) with defined response
  time targets aligned with healthcare operational requirements.
- Security incidents involving potential unauthorised data access trigger immediate audit log
  preservation and notification to the designated Privacy Officer.
- Incident response procedures are documented in the operational runbook provided to network
  administrators during onboarding.

---

## Legal Notice

This document describes security design intentions and architectural controls. It does not
constitute a security certification, compliance attestation, or regulatory approval. All
language uses **designed for**, **aligned with**, and **supports** framing. Certification
claims require independent third-party assessment.
