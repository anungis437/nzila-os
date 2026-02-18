# Security Operations

**Owner:** CISO / Platform Engineering  
**Review Cadence:** Quarterly  
**Controls Covered:** AC-01 through AC-05, SDLC-03, SDLC-04

## Purpose

Define security operations procedures for Nzila OS, covering access management,
key rotation, vulnerability scanning, and secret detection.

## Access Management

### Authentication (Clerk)

- All console access requires Clerk authentication
- MFA is enforced at the organization level (AC-01)
- Sessions expire per Clerk default policy

### Authorization (Entity-Scoped RBAC)

- Users access only entities listed in `entity_members` (AC-02)
- Roles: `admin`, `editor`, `viewer` — least privilege enforced (AC-03)
- Middleware checks entity membership on every API request

### Key Rotation

- API keys and service credentials rotated every 90 days (AC-04)
- Rotation process: generate new key → deploy → verify → revoke old key
- Each rotation logged as `audit_event` with `action = 'key_rotated'`

### Off-Boarding

- Access revoked within 24 hours of termination notice (AC-05)
- Process: Deactivate Clerk user → delete `entity_members` rows → verify

## Vulnerability Management

- Weekly `pnpm audit` scans (SDLC-03) — see CT-06
- GitHub Dependabot alerts reviewed weekly
- Critical/high findings remediated within 7 days or documented exception

## Secret Scanning

- GitHub secret scanning enabled on repository (SDLC-04)
- Pre-commit hooks prevent secret commits
- Monthly review of scanning results — see CT-07

## Evidence to Capture

| Artifact | Format | Control | Storage Path | Retention |
|---|---|---|---|---|
| Clerk MFA config export | JSON | AC-01 | `evidence/{entity_id}/access/{YYYY}/{MM}/clerk-mfa-config/` | 3_YEARS |
| RBAC membership export | JSON | AC-02 | `evidence/{entity_id}/access/{YYYY}/{MM}/rbac-membership-export/` | 3_YEARS |
| Quarterly access review report | JSON/PDF | AC-03 | `evidence/{entity_id}/access/{YYYY}/Q{N}/access-review-report/` | 3_YEARS |
| Key rotation log | JSON | AC-04 | `evidence/{entity_id}/access/{YYYY}/{MM}/key-rotation-log/` | 3_YEARS |
| Off-boarding evidence | JSON | AC-05 | `evidence/{entity_id}/access/{YYYY}/{MM}/offboarding/{user_id}/` | 7_YEARS |
| Dependency audit results | JSON | SDLC-03 | `evidence/{entity_id}/sdlc/{YYYY}/{MM}/dependency-audit/` | 1_YEAR |
| Secret scan results | JSON | SDLC-04 | `evidence/{entity_id}/sdlc/{YYYY}/{MM}/secret-scan-results/` | 1_YEAR |

### Required Metadata Fields

- `entity_id`, `artifact_id`, `sha256`, `created_by`, `retention_class` per table above

### Hashing Expectation

All artifacts uploaded via `@nzila/blob` → SHA-256 auto-computed → stored in `documents.sha256` → `audit_event` logged.

## References

- [Required Evidence Map](../compliance/Required-Evidence-Map.md) — AC-01 through AC-05, SDLC-03, SDLC-04
- [Control Test Plan](../compliance/Control-Test-Plan.md) — CT-02, CT-06, CT-07
