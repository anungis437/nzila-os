# Incident Response — Runbooks

**Owner:** CISO / On-Call Engineer  
**Review Cadence:** After every P1/P2 incident

## Available Runbooks

| Runbook | Severity | When to Use |
|---|---|---|
| Standard IR Procedure | P1–P2 | Any security or operational incident |
| Data Breach Response | P1 | Confirmed or suspected data exposure |
| Credential Compromise | P1–P2 | Compromised API keys, DB credentials, or user accounts |
| DDoS Mitigation | P1–P2 | Sustained traffic attack or service degradation |

## Standard IR Procedure

See `TEMPLATE_SCHEMA.md` for the full YAML template (`ir-001`). Summary:

1. Detect & Triage (5 min)
2. Contain (15 min)
3. Eradicate (30 min)
4. Recover (60 min)
5. Post-Incident Review (24 hours)

## Evidence to Capture

During and after every incident, capture the following:

| Step | Artifact | How to Generate | Where to Store |
|---|---|---|---|
| Detect | Alert screenshot/log, incident ticket | Copy from monitoring/PagerDuty | `evidence/{entity_id}/incident-response/{YYYY}/{MM}/detection/{incident_id}/` |
| Contain | Containment actions log (systems isolated, IPs blocked) | Document manually or export from firewall/network tools | `evidence/{entity_id}/incident-response/{YYYY}/{MM}/containment-log/{incident_id}/` |
| Eradicate | Patch/fix details, credential rotation log | Export from CI/CD, Clerk admin | `evidence/{entity_id}/incident-response/{YYYY}/{MM}/eradication/{incident_id}/` |
| Recover | Health check results, monitoring dashboard snapshot | Capture from monitoring tools | `evidence/{entity_id}/incident-response/{YYYY}/{MM}/recovery/{incident_id}/` |
| PIR | Postmortem PDF, remediation tracker, audit trail export | Use postmortem template, export from DB | `evidence/{entity_id}/incident-response/{YYYY}/{MM}/postmortem/{incident_id}/` |

### Required Metadata Fields

- `entity_id` — Which legal entity was affected
- `artifact_id` — e.g., `IR-2026-001-containment`
- `sha256` — Auto-computed by `@nzila/blob` at upload
- `created_by` — Clerk user ID of the person uploading
- `retention_class` — `7_YEARS` for all IR evidence
- `run_id` — Incident ID serves as the run identifier

### Hashing Expectation

All artifacts uploaded via `@nzila/blob` → SHA-256 computed automatically → stored in `documents.sha256` → logged in `audit_events` with hash chain.
