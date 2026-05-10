# Governance Architecture

> Platform-wide governance, compliance, and audit infrastructure for Nzila OS.

## Overview

The governance architecture ensures every application in the Nzila OS ecosystem meets compliance, security, and operational standards through automated enforcement and continuous monitoring.

## Core Packages

### @nzila/platform-policy-engine

Central policy evaluation engine. All sensitive operations must pass through policy checks before execution.

**Key capabilities:**

- Policy definition (YAML-based rules)
- Policy evaluation (allow/deny/requires_approval)
- Threshold-based approval workflows
- Audit trail for all policy decisions

### @nzila/platform-governance

Governance control plane for compliance validation and drift detection.

**Key capabilities:**

- Audit timeline (timestamped governance events)
- App compliance assessment (6-point check)
- Governance findings with severity classification
- Compliance drift detection

### @nzila/platform-evidence-pack

Evidence collection and export for procurement and audit purposes.

### @nzila/platform-observability

Metrics, logging, and monitoring infrastructure.

### @nzila/platform-events

Event bus for cross-app communication and audit logging.

## Compliance Framework

### 6-Point App Compliance Check

| Check | Description | Severity if Missing |
|-------|-------------|---------------------|
| SBOM | Software Bill of Materials generated | High |
| Policy Engine | Platform policy integration | Critical |
| Evidence Pack | Evidence export endpoint | High |
| Health Endpoint | /api/health returns status | Medium |
| Metrics Endpoint | /api/metrics operational | Medium |
| Test Coverage | Unit tests present | High |

### Compliance Levels

- **Full Compliance**: 6/6 checks pass
- **Partial Compliance**: 3-5/6 checks pass
- **Non-Compliant**: 0-2/6 checks pass

## Governance Workflows

### Policy Evaluation Flow

```
Operation Request → Policy Engine → Evaluate Rules → Decision
                                                       ├── Allow → Execute
                                                       ├── Deny → Block + Log
                                                       └── Requires Approval → Queue + Notify
```

### Compliance Drift Detection

```
Push to main → CI Workflow → governance:check → Report
                                                  ├── Pass → Continue
                                                  └── Fail → Block + Alert
```

### Evidence Collection

```
Schedule (daily) → Collect SBOM → Run Policy Checks → Generate Evidence Pack → Store
```

## Audit Timeline

Every governance event is recorded with:

- Unique ID
- ISO 8601 timestamp
- Event type (policy_evaluated, compliance_check, drift_detected, etc.)
- Actor (user or system)
- Organization ID
- App identifier
- Policy result (pass/fail/warn)
- Git commit hash
- Optional details

## Scripts

| Command | Purpose |
|---------|---------|
| `pnpm governance:check` | Run governance validation across all apps |
| `pnpm validate:governance` | Full governance validation (GA check + contract tests + release) |
| `pnpm generate:sbom` | Generate Software Bill of Materials |

## CI/CD Integration

### compliance-drift.yml

- Triggers on push to main (apps/ and packages/platform-* paths)
- Weekly scheduled check (Monday 04:00 UTC)
- Runs `pnpm governance:check`
- Uploads report artifact on failure

### compliance.yml

- Daily evidence collection (05:00 UTC)
- Weekly compliance reports (Sunday 06:00 UTC)
- SOC 2 Type II + ISO 27001 validation
