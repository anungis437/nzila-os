# Runbooks — Security

**Owner:** CISO / Platform Engineering  
**Review Cadence:** Quarterly

## Purpose

Security runbooks for access management, key rotation, vulnerability response,
and security monitoring within Nzila OS.

## Available Runbooks

| Runbook | Description | Controls Covered |
|---|---|---|
| Quarterly Access Review | Review and validate all user access across entities | AC-02, AC-03 |
| Key Rotation | Rotate API keys and service credentials (90-day cycle) | AC-04 |
| Off-Boarding | Revoke user access upon termination | AC-05 |
| Vulnerability Remediation | Triage and fix critical/high dependency vulnerabilities | SDLC-03 |
| Secret Leak Response | Respond to detected secrets in code or logs | SDLC-04 |

## Quarterly Access Review Procedure

See `Control-Test-Plan.md` → CT-02 for full procedure.

1. Export Clerk users for the organization
2. Export `entity_members` table per entity
3. Cross-reference: every member maps to an active Clerk user
4. Audit role assignments (flag excessive admin access)
5. Review off-boardings for the quarter
6. Generate and store evidence

## Key Rotation Procedure

1. Generate new credential (Azure portal / CLI / Clerk dashboard)
2. Deploy new credential to environment variables
3. Verify service functions with new credential
4. Revoke old credential
5. Log rotation in `audit_events`
6. Store rotation evidence

## Evidence to Capture

| Artifact | Format | Control | Storage Path | Retention |
|---|---|---|---|---|
| Access review report | JSON/PDF | AC-02, AC-03 | `evidence/{entity_id}/access/{YYYY}/Q{N}/access-review-report/ACR-Q{N}-{YYYY}/` | 3_YEARS |
| Key rotation log | JSON | AC-04 | `evidence/{entity_id}/access/{YYYY}/{MM}/key-rotation-log/` | 3_YEARS |
| Off-boarding evidence | JSON | AC-05 | `evidence/{entity_id}/access/{YYYY}/{MM}/offboarding/{user_id}/` | 7_YEARS |
| Vulnerability scan results | JSON | SDLC-03 | `evidence/{entity_id}/sdlc/{YYYY}/{MM}/dependency-audit/` | 1_YEAR |

### Required Metadata Fields

- `entity_id`, `artifact_id`, `sha256`, `created_by`, `retention_class` per table above

### Hashing Expectation

All artifacts uploaded via `@nzila/blob` → SHA-256 auto-computed → stored in `documents.sha256` → `audit_event` logged.

## References

- [Required Evidence Map](../../compliance/Required-Evidence-Map.md) — AC-01 through AC-05, SDLC-03, SDLC-04
- [Control Test Plan](../../compliance/Control-Test-Plan.md) — CT-02, CT-06, CT-07
- [Security Operations](../../security-operations/README.md)
