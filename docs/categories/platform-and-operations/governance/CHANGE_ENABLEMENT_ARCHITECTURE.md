# Change Enablement Architecture

> ITIL-aligned, code-native, Git-governed change management for Nzila OS.

## Overview

The Change Enablement system is a thin orchestration layer integrated into the
existing governance, policy-engine, and deployment infrastructure. It is **not**
a standalone ITSM product — it enforces change control through the same CI/CD
pipelines and governance audit timeline used across the monorepo.

## Package

`@nzila/platform-change-management` — located at
`packages/platform-change-management/`.

### Module map

| Module | Purpose |
|---|---|
| `types.ts` | Canonical TypeScript interfaces and union types |
| `schemas.ts` | Zod runtime validation schemas |
| `service.ts` | File-based CRUD (`ops/change-records/*.json`) |
| `approvals.ts` | Approval engine with role-based evaluation |
| `calendar.ts` | Freeze periods, conflict detection, window checks |
| `checks.ts` | Pre-deployment validation gate |
| `audit.ts` | Governance event emitter (integrates `@nzila/platform-governance`) |
| `utils.ts` | ID generation, window overlap helpers |

## Data Flow

```
Developer → creates CHG-YYYY-NNNN.json in ops/change-records/
         → approval roles sign off (approved_by array)
         → CI/CD pre-deploy step runs validateChangeWindow()
         → deploy proceeds iff valid=true
         → post-deploy: PIR recorded for NORMAL/EMERGENCY changes
         → governance audit trail updated via platform-events
```

## Storage

Change records are plain JSON files stored at `ops/change-records/`. This
design is intentional:

- **Git-governed** — every change, approval, and PIR is a commit
- **No database dependency** — works offline, in CI, and locally
- **Auditable** — `git log ops/change-records/` is a full history
- **Human-readable** — reviewable in any PR diff

## Approval Model

| Change Type | Required Approvals | CAB Required | PIR Required |
|---|---|---|---|
| STANDARD | None (auto-approve) | No | No |
| NORMAL | service_owner + change_manager | Only if HIGH/CRITICAL | Yes |
| NORMAL (HIGH) | + security_approver | Yes | Yes |
| EMERGENCY | service_owner only | No | Yes (mandatory) |

## Deployment Gating

The `validateChangeWindow()` function is called in every deploy workflow as a
pre-deploy step. It checks:

1. An approved change record exists for `{env, service}`
2. `approval_status === 'APPROVED'`
3. All required approval roles are present in `approved_by`
4. Current time is inside the implementation window
5. Window does not overlap a calendar freeze period

EMERGENCY changes bypass the window restriction but produce warnings and
require a Post Implementation Review before closure.

## Integration Points

- **platform-governance**: audit events recorded via `recordAuditEvent()`
- **platform-events**: events emitted on `PlatformEventBus`
- **platform-observability**: metrics tracked via observability layer
- **CI/CD workflows**: `deploy-web.yml`, `deploy-console.yml`,
  `deploy-union-eyes.yml` each include change validation steps
- **Control Plane**: dashboard pages at `/changes` and `/change-calendar`

## CLI Scripts

| Script | Command | Purpose |
|---|---|---|
| `validate-change-window.ts` | `pnpm change:validate --env=STAGING --service=web` | Pre-deploy gate |
| `change-seed-demo.ts` | `pnpm change:seed-demo` | Seed 5 example records |
