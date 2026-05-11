# Zonga — Security Posture Document

## Overview

This document describes the security controls enforced by the Zonga
hardening pass, covering authentication, authorization, data integrity,
and operational safety.

## Authentication

- **Clerk** — All user authentication via Clerk (primary + satellite mode)
- **Org-scoped context** — Every command and action resolves org membership
  from the authenticated session before execution
- **No anonymous mutations** — All write operations require authenticated context

## Authorization Controls

### Role-Based Access (G2)

`guardRoleAuthorization(userRole, requiredRoles)` validates that the
actor's role is in the allowed set before any protected operation.

Workflow transitions define `requiredRole` on sensitive transitions:

- `finance` — payout approval, manual review, write-off
- `admin` — artist approval, moderation resolution, rights update approval
- `moderator` — content review decisions
- `system` — automated processing transitions

### Admin Accountability (G1)

`guardAdminActionReason(reason, minLength)` requires a minimum 10-character
reason for all admin/governance actions. Applied to:

- Moderation case resolution
- Content takedown

### Rate Limiting (G3)

`guardRateLimit(actionCount, maxActions, windowMs, windowStart)` prevents
abuse by enforcing action frequency limits.

### Environment Restriction (G5)

`guardEnvironmentRestriction(env, allowedEnvs)` blocks dangerous
operations (e.g., data deletion) from running in production.

## Data Integrity

### Ledger Integrity (E1-E3)

- Every revenue event creates a corresponding ledger entry
- Payout amounts validated against available balance
- Ledger balance verified (debits ≈ credits) within ±0.001 tolerance

### Atomic Operations (T1-T2)

Ticket purchases use atomic `INSERT...SELECT WHERE capacity_not_exceeded`
to prevent race conditions and overselling.

### Dispute Freeze (R2, R4)

Filing a rights dispute automatically freezes payouts for the affected release.
Resolution checks remaining disputes and only unfreezes when all are resolved.

## Audit Trail

Every critical mutation writes to `audit_log` with:

- Org ID, actor ID, action name, entity reference, metadata, timestamp
- Compensation events recorded with original error context
- Command blocks recorded with guard name and reason

See [AUDIT_TRAIL_SCHEMA.md](AUDIT_TRAIL_SCHEMA.md) for full schema.

## Supply Chain Security

- **Snyk** — `snyk test --all-projects --severity-threshold=high`
- **Trivy** — Dockerfile scanning with `--severity CRITICAL`
- **pnpm overrides** — Security patches applied via root `package.json`
- **SBOM generation** — GitHub Actions workflow produces software bill of materials
- **Dependency audit** — `tooling/security/supply-chain-policy.ts` with waiver system

## Pre-Execution Guard Pipeline

The command bus supports blocking any command before handler execution:

```typescript
registerPreExecutionGuard({
  name: 'guard-name',
  appliesTo: ['command-name'],
  check: async (ctx) => ({ allowed: boolean, reason?: string })
})
```

Blocked commands emit `command.blocked` audit events — no mutation occurs.

## Secrets Management

- Application secrets injected via environment variables
- No secrets in source code or build artifacts
- Clerk keys, Stripe keys, database credentials managed externally
- See `docs/hardening/secrets.md` for full secrets policy
