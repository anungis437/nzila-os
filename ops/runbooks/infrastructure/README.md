# Runbooks — Infrastructure

**Owner:** Platform Engineering  
**Review Cadence:** Semi-annually or after infrastructure changes

## Purpose

Infrastructure runbooks for provisioning, scaling, and maintaining Nzila OS platform components.

## Available Runbooks

| Runbook | Description | Controls Covered |
|---|---|---|
| Azure SWA Deployment | Deploy/redeploy Static Web Apps for `apps/web` and `apps/console` | CM-05 |
| Azure Container Apps Scaling | Scale API/worker containers up/down | — |
| Database Provisioning | Provision new PostgreSQL Flexible Server instance | CM-05 |
| Blob Storage Configuration | Configure containers, lifecycle policies, RA-GRS | DR-04, DR-RET-01 |
| DNS & Certificate Management | SSL cert renewal, DNS record updates | — |

## Evidence to Capture

Infrastructure changes produce evidence for Change Management (CM-05) and DR (DR-04):

| Artifact | Format | Storage Path | Retention |
|---|---|---|---|
| IaC plan output | JSON/text | `evidence/{entity_id}/change-mgmt/{YYYY}/{MM}/iac-changes/{change_id}/plan.json` | 7_YEARS |
| IaC apply log | JSON/text | Same path, `apply-log.json` | 7_YEARS |
| Config export (post-change) | JSON | Same path, `config-export.json` | 7_YEARS |

### Required Metadata Fields

- `entity_id`, `artifact_id`, `sha256`, `created_by`, `retention_class = '7_YEARS'`

### Hashing Expectation

All artifacts uploaded via `@nzila/blob` → SHA-256 auto-computed → stored in `documents.sha256` → `audit_event` logged.

## References

- [Required Evidence Map](../../compliance/Required-Evidence-Map.md) — CM-05, DR-04
- [Evidence Storage Convention](../../compliance/Evidence-Storage-Convention.md)
