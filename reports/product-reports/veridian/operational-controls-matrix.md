---
platform: veridian-care
type: controls-matrix
version: 1.0.0
status: pilot-ready
generated: 2026-04-27
---

# Veridian Care — Operational Controls Matrix

This matrix documents the operational controls in place for the Veridian Care platform, along
with evidence sources, review cadences, owner roles, and current implementation status.

---

## Controls Matrix

| Control | Description | Evidence Source | Cadence | Owner Role | Status |
|---|---|---|---|---|---|
| Release governance | All deployments gated by CI checks (typecheck, lint, tests, health endpoints). Release notes produced for every staging and production deployment. | Release notes + CI gates | Per release | Engineering Lead | Implemented |
| RBAC review | Periodic review of all user role assignments to verify least-privilege compliance. Stale or inappropriate role assignments are revoked. | Audit logs | Quarterly | Privacy Officer | Implemented |
| Consent logging | Every patient-data access, consent denial, and break-glass event is written to an immutable audit log with full actor and scope context. | consent-engine audit events | Continuous | Platform | Implemented |
| Backup/restore validation | Scheduled validation that backup artifacts are complete and restorable within defined RTO targets. Restore test results documented in the infrastructure runbook. | Infrastructure runbook | Monthly | DevOps | Planned |
| Incident response | Structured incident classification (P1–P4) with defined response time targets. Security incidents trigger audit log preservation and Privacy Officer notification. | Incident log | Per incident | On-call Lead | Planned |
| Integration change control | All changes to connector configurations and data mappings reviewed and approved before deployment. Connector changelogs maintained per integration. | Connector changelogs | Per change | Integration Lead | Planned |
| Synthetic demo controls | All non-production data classified as synthetic. Synthetic label enforced in platform UI and all exports. Accidental PHI introduction treated as P1 incident. | Data classification labels | Continuous | Platform | Implemented |
| Privacy review before live data | Privacy Impact Assessment required and approved before any live patient data is onboarded to a new site. PIA stored as a governance record in veridian-admin. | Privacy impact assessment | Before each new site | Privacy Officer | Implemented |

---

## Status Definitions

| Status | Meaning |
|---|---|
| Implemented | Control is active, evidence is being generated, and the control has been validated in the current release. |
| Planned | Control is designed and documented. Implementation is scheduled and will be validated before production go-live. |

---

## Legal Notice

This controls matrix reflects the current design and implementation state of the Veridian Care
platform. It does not constitute a compliance certification or audit report. Independent
third-party assessment is required for regulatory compliance purposes.
