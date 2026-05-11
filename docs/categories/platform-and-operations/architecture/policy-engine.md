# Policy Engine

> Governance as code — evaluate, enforce, and audit platform policies at runtime.

## Overview

The Policy Engine (`@nzila/platform-policy-engine`) evaluates YAML-defined
governance policies against runtime inputs. Every decision is recorded as an
audit entry for traceability.

## Architecture

```
ops/policies/*.yml  →  Loader  →  Evaluator  →  Audit Hook
                                      ↓
                              allow / deny / require_approval
```

## Policy Types

| Type | Scope | Examples |
|------|-------|---------|
| `access` | Role-based access control | break-glass, PII export |
| `approval` | Multi-party approval flows | financial approvals |
| `voting` | Cooperative governance | quorum enforcement, self-vote blocking |
| `financial` | Budget & margin controls | budget gates, margin floors |

## Policy File Format

```yaml
version: "1.0"
lastUpdated: "2026-03-04"
policies:
  - id: access-break-glass
    name: Break-glass access control
    version: "1.0"
    type: access
    enabled: true
    scope:
      environments: [pilot, prod]
      resources: ["/api/admin/break-glass"]
    rules:
      - id: require-platform-admin
        description: Only platform_admin may invoke break-glass
        conditions:
          - field: actor.roles
            operator: not_in
            value: [platform_admin]
        effect: deny
        severity: critical
```

## Enforcement Points

The policy engine is enforced on **3 critical flows**:

| Flow | Policy ID | Effect |
|------|----------|--------|
| **Break-glass access** | `access-break-glass` | Deny if not `platform_admin` |
| **Vote casting** | `voting-quorum` | Deny below quorum; block self-vote on payout |
| **Financial mutations** | `financial-budget-gate` | Deny over budget; require approval near threshold |

## API (Programmatic)

```ts
import { enforcePolicies } from '@/lib/policy-enforcement'

const result = await enforcePolicies({
  action: 'break_glass.activate',
  resource: '/api/admin/break-glass',
  actor: { userId, roles: ['platform_admin'] },
  context: { environment: 'production' },
  orgId,
})

if (result.blocked) {
  return NextResponse.json({ error: result.reason }, { status: 403 })
}
```

## Audit Trail

Every policy evaluation emits an audit event:

```json
{
  "action": "policy.denied",
  "targetType": "policy_enforcement",
  "afterJson": {
    "enforcedAction": "break_glass.activate",
    "blocked": true,
    "policyIds": ["access-break-glass"]
  }
}
```

## Packages

- **`@nzila/platform-policy-engine`** — Evaluator, loader, audit hook
- **`apps/console/lib/policy-enforcement.ts`** — HTTP-layer enforcement wrapper
- **`ops/policies/`** — YAML policy definitions

## Policy Files

| File | Policies |
|------|---------|
| `access-policies.yml` | Break-glass, PII export |
| `approval-policies.yml` | Multi-party approval |
| `voting-policies.yml` | Quorum, self-vote, cooling-off |
| `financial-policies.yml` | Budget gates, margin floors |
