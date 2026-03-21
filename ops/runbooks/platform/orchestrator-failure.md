# Runbook: Orchestrator Workflow Failure

**Scope:** Workflow execution failures in the orchestration layer
**Severity:** P2 (single workflow) / P1 (core workflows: org-onboarding, invoice-generation)
**On-call:** Platform Engineering

## Detection

Workflow failures surface through:

1. **Ops score degradation** — `computeOpsScore()` drops below threshold
2. **Health digest anomalies** — `detectAnomalies()` flags metric regressions
3. **Trend alerts** — `dispatchTrendAlerts()` fires on sustained degradation
4. **DLQ depth** — workflow dead letters exceed `maxDlqDepth` from `DEFAULT_SLO_TARGETS`

## Triage

### Step 1: Identify affected workflow

Check the Orchestrator Ops dashboard at `/orchestrator-ops` in platform-admin.

Key data points:

- Workflow name and domain
- Danger level (high/medium/low)
- Whether rollback and circuit breaker are configured

### Step 2: Check failure classification

The `classifyFailure()` function from `platform-ops` categorises errors:

| Category | Retry? | Common causes |
|----------|--------|---------------|
| `transient` | Yes | Network timeout, downstream rate limit, temporary unavailability |
| `permanent` | No | Validation error, missing required data, auth failure |
| `unknown` | Limited | Unrecognised error patterns — needs investigation |

### Step 3: Check retry state

The `RetryStateMachine` tracks:

- Current attempt number
- Next delay (exponential backoff)
- Decision: `retry`, `exhaust` (budget spent), or `abort` (permanent)

## Response

### Transient failures

1. Verify retry state machine is active (log: `retry` decision)
2. Check retry config: `DEFAULT_RETRY_CONFIG` allows up to N attempts
3. If retries exhausted → entry moves to DLQ
4. **No manual action** unless failure persists >15 minutes

### Permanent failures

1. Check the error message for specific cause
2. Common fixes:
   - **Missing data**: Check upstream data pipeline
   - **Validation error**: Check input schema against `integrations-core` Zod schemas
   - **Auth failure**: Rotate credentials, check RBAC
3. After fix, replay DLQ entries

### High-danger workflow failure

For workflows with `danger: 'high'`:

1. **Immediately check** if rollback is configured (`hasRollback: true`)
2. If rollback exists, verify it triggered automatically
3. If rollback failed, manually invoke compensating actions
4. **Do not retry** high-danger workflows without understanding root cause

### Circuit breaker behaviour

Workflows with `hasCircuitBreaker: true`:

1. Breaker opens after failure threshold
2. Subsequent calls fail fast (no cascade)
3. After cooldown, half-open probe tests recovery
4. Admin reset available but **use with caution** for high-danger workflows

## Monitoring

| Metric | Source | Threshold |
|--------|--------|-----------|
| Success rate | `DEFAULT_SLO_TARGETS.successRate` | 99.5% |
| P99 latency | `DEFAULT_SLO_TARGETS.p99LatencyMs` | Configured per-workflow |
| DLQ depth | `DEFAULT_SLO_TARGETS.maxDlqDepth` | Platform default |

## Escalation

| Condition | Action |
|-----------|--------|
| Core workflow down >30 min | P1, all-hands |
| Multiple workflows failing | Check shared dependency (DB, network, auth) |
| DLQ depth >500 | Alert product team |
| Ops score <60% | Weekly review escalation |

## Related

- [Integration Failure Runbook](integration-failure.md)
- [SLO Breach Runbook](slo-breach.md)
- Orchestrator Ops Dashboard: `apps/platform-admin/app/orchestrator-ops/page.tsx`
- Platform Health Dashboard: `apps/platform-admin/app/platform-health/page.tsx`
