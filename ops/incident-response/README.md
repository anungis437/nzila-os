# Incident Response

**Owner:** CISO / Platform Engineering  
**Review Cadence:** After every P1/P2 incident; quarterly review of procedures

## Purpose

Define the incident response lifecycle for Nzila OS, ensuring all security and operational
incidents are detected, contained, eradicated, recovered from, and documented with full
evidence trails.

## Severity Levels

| Level | Description | Response Time | Postmortem Required |
|---|---|---|---|
| P1 | Service outage, data breach, integrity compromise | 15 minutes | Yes (within 5 business days) |
| P2 | Degraded service, security alert, failed control | 1 hour | Yes (within 10 business days) |
| P3 | Minor issue, cosmetic, single-user impact | 4 hours | No (optional) |
| P4 | Informational, improvement opportunity | Next business day | No |

## Incident Lifecycle

1. **Detect & Triage** — Alert received, severity assigned, incident ticket created
2. **Contain** — Isolate affected systems, preserve evidence, block threat
3. **Eradicate** — Remove root cause, patch vulnerability, reset credentials
4. **Recover** — Restore from clean state, verify integrity, monitor
5. **Post-Incident Review (PIR)** — Document timeline, root cause, remediation items

## Evidence to Capture

Every P1/P2 incident **must** produce the following evidence artifacts:

| Artifact | Format | Controls Covered | Storage Path |
|---|---|---|---|
| Postmortem document | PDF | IR-01 | `evidence/{entity_id}/incident-response/{YYYY}/{MM}/postmortem/{incident_id}/postmortem.pdf` |
| Audit events export (incident window) | JSON | IR-02 | `evidence/{entity_id}/incident-response/{YYYY}/{MM}/audit-trail/{incident_id}/audit-trail-export.json` |
| Containment log | JSON | IR-03 | `evidence/{entity_id}/incident-response/{YYYY}/{MM}/containment-log/{incident_id}/containment-log.json` |
| Remediation tracker | JSON | IR-04 | `evidence/{entity_id}/incident-response/{YYYY}/{MM}/remediation/{incident_id}/remediation-tracker.json` |
| Evidence pack index | JSON | All IR | `evidence/{entity_id}/incident-response/{YYYY}/{MM}/postmortem/{incident_id}/evidence-pack-index.json` |

### Metadata Requirements

All artifacts must be uploaded via `@nzila/blob` `uploadBuffer()` which automatically computes SHA-256.
Each upload must:
- Create a `documents` table row with `blob_container`, `blob_path`, `sha256`, `entity_id`
- Create an `audit_events` entry with `action = 'document_uploaded'` and hash chain continuation
- Set retention class to `7_YEARS`

### Hashing Expectation

SHA-256 is computed at upload time by `@nzila/blob`. The hash is stored in:
- `documents.sha256` column
- Blob index tag `sha256` (first 16 chars)
- Referenced in the evidence pack index JSON

Auditors verify integrity by re-downloading the artifact and recomputing SHA-256.

## Sub-directories

- `runbooks/` — Step-by-step incident response procedures
- `templates/` — Postmortem template, incident ticket template, communication templates

## References

- [Required Evidence Map](../compliance/Required-Evidence-Map.md) — Controls IR-01 through IR-04
- [Evidence Pack Index Schema](../compliance/Evidence-Pack-Index.schema.json)
- [Evidence Storage Convention](../compliance/Evidence-Storage-Convention.md)
- [Runbook Template Schema](../runbooks/TEMPLATE_SCHEMA.md)
