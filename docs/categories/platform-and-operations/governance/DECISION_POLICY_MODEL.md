# Decision Policy Model

> How policies govern decision execution in the Decision Layer.

## Policy Evaluation

Every decision is evaluated against a policy context before it can be executed. The evaluation considers:

### 1. Environment Protection

Protected environments (`STAGING`, `PRODUCTION`) require manual approval before execution.

```
if environment.protected_environment:
  → block execution: "Protected environment — manual approval required"
```

### 2. Severity Escalation

`CRITICAL` severity decisions always require escalation.

```
if severity == CRITICAL:
  → block execution: "Critical severity — escalation required before execution"
```

### 3. Approval Requirements

If `required_approvals` is non-empty and no reviewers have acted yet, execution is blocked.

```
if required_approvals.length > 0 AND reviewed_by is empty:
  → block execution: "Pending approvals: {required_approvals}"
```

### 4. Expiration

Expired decisions cannot be executed.

```
if expires_at < now:
  → block execution: "Decision has expired"
```

## Classification

Decisions are classified into two groups:

- **Executable** — no blocking reasons; can proceed
- **Blocked** — one or more policy reasons prevent execution; requires resolution

## Review-Required Logic

A decision's `review_required` flag is set `true` when:

1. Severity is `HIGH` or `CRITICAL`
2. Environment is `STAGING` or `PRODUCTION` (protected)

## Default Approval Roles

| Severity | Default Required Approvals |
|----------|---------------------------|
| CRITICAL | `platform-admin` |
| HIGH | None (but review_required is true) |
| MEDIUM | None |
| LOW | None |

Rules may specify additional approval roles:

- `arbitration-risk` → `legal-compliance`, `platform-admin`
- `budget-variance` → `finance-admin`
- `deployment-risk` → `platform-admin`, `service-owner`
