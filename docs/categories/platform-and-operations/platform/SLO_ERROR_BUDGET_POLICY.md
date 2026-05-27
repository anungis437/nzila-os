# SLO & Error Budget Policy

## Purpose

This document is the canonical, human-readable companion to `ops/slo-policy.yml`. It defines:

1. How Service Level Objectives (SLOs) are declared and measured
2. Error budget allocation and burn-rate alerting rules
3. Deployment gate semantics per environment
4. Error budget exhaustion response procedures

Machines read `ops/slo-policy.yml`. Humans read this document.

---

## SLO Definitions

### Historical Baseline (last 90 days)

| Tier | Median p95 latency | Median error rate | Notes |
|---|---|---|---|
| Critical | 178 ms | 0.38% | Stable under weekday traffic peaks |
| Production | 322 ms | 0.92% | Sensitive to dependency retries |
| Standard | 438 ms | 1.41% | Spikes correlate with release windows |
| Emerging | 860 ms | 2.44% | Volatile due to active feature iteration |

Baselines are refreshed monthly via runtime telemetry snapshots and compared to SLO target drift.

### Service Level Indicators (SLIs)

| SLI | Measurement | Source |
|---|---|---|
| **Request latency** | p95 and p99 of HTTP response time | k6 load test + APM spans |
| **Error rate** | `5xx / total requests * 100` | Access logs + health endpoint |
| **Integration success rate** | `successful_deliveries / total_attempts * 100` | Queue consumer metrics |
| **DLQ backlog** | Unprocessed messages in dead-letter queue | Queue depth metric |

### SLO Targets by App Tier

| Tier | p95 latency | p99 latency | Error rate | Integration success |
|---|---|---|---|---|
| **Critical** (trade, orchestrator-api) | ≤ 200 ms | ≤ 800 ms | ≤ 0.5% | ≥ 99.9% |
| **Production** (union-eyes, abr, nacp-exams) | ≤ 400 ms | ≤ 1500 ms | ≤ 1.5% | ≥ 99.5% |
| **Standard** (web, console, partners, zonga) | ≤ 500 ms | ≤ 2000 ms | ≤ 2.0% | ≥ 99.0% |
| **Emerging** (agrimo, cora, pilot apps) | ≤ 1000 ms | ≤ 5000 ms | ≤ 3.0% | ≥ 98.0% |

All per-app overrides are in `ops/slo-policy.yml` and take precedence.

---

## Error Budgets

### Budget Calculation

An error budget is the allowable amount of unreliability for a 30-day rolling window:

$$\text{Error Budget} = 1 - \text{SLO target}$$

Example for `trade` (error rate SLO = 0.5%):

- Error budget = 0.5% of all requests over 30 days
- At 1000 req/min → 43.2M requests/month → budget = 216,000 failed requests

### Burn Rate Thresholds

| Burn Rate | Window | Meaning | Action |
|---|---|---|---|
| **14×** | 1 hour | Budget exhausted in < 3 days | Page on-call immediately |
| **6×** | 6 hours | Budget exhausted in < 5 days | Alert team lead |
| **3×** | 72 hours | Budget at 50% with 15 days remaining | Ticket + sprint backlog item |
| **1×** | 30 days | Nominal burn | No action |

Burn rate = `(error rate observed) / (1 - SLO target)`.

### Predictive Anomaly Detection (proactive)

Reactive burn-rate alerts remain mandatory. In addition, predictive controls trigger when trend risk rises:

| Predictive signal | Window | Trigger | Action |
|---|---|---|---|
| Latency trend slope | 4h rolling | p95 slope > 20 ms/15 min for 3 consecutive windows | Pre-scale + investigate queue depth |
| Error-rate drift | 2h rolling | positive drift beyond historical p90 envelope | Open Sev 2 investigation before budget burn |
| DLQ acceleration | 30 min rolling | second derivative > configured threshold | Trigger consumer scale-up and backpressure policy |

Predictive signal output is published through `ops/outputs/dora-metrics.json` under `metrics.predictive_signal`.

### Auto-Scaling Triggers

| Trigger | Threshold | Action |
|---|---|---|
| Sustained p95 latency | > SLO target for 10 min | Increase container replicas by +1 step |
| CPU saturation | > 75% for 10 min with rising latency | Scale out service replicas |
| Queue backlog pressure | DLQ backlog > 0.8 × app backlog limit | Scale worker consumers |
| Cost guardrail | Predicted monthly spend > budget by 15% | Require deployment approval from domain lead |

### Azure Monitor Alert Rules

These correspond to `docs/platform/ALERTING_RUNBOOK.md` alert IDs:

| Alert ID | Burn rate | Severity | Notification |
|---|---|---|---|
| `ALERT-SLO-001` | ≥ 14× over 1h | Sev 1 | On-call page |
| `ALERT-SLO-002` | ≥ 6× over 6h | Sev 2 | Team lead + Slack |
| `ALERT-SLO-003` | ≥ 3× over 72h | Sev 3 | Slack channel + ticket |

---

## Deployment Gate Semantics

| Environment | Violation behaviour |
|---|---|
| `dev` | Warning only — deploy proceeds |
| `staging` | Warning only — deploy proceeds |
| `pilot` | **Blocked** — deployment cancelled |
| `production` | **Blocked** — deployment cancelled |

Gate enforcement is via `tooling/contract-tests/slo-gate-real-sources.test.ts` and `slo-policy.test.ts`.  
The k6 smoke test (`tests/load/smoke.js`) enforces thresholds directly in CI.

---

## Error Budget Exhaustion Response

When the error budget for a production-tier app is exhausted (100% burned):

### Immediate (0–30 min)

1. Freeze feature deployments to the affected app.
2. Declare an incident; assign an incident commander.
3. Determine root cause category: regression, infrastructure, dependency failure.

### Short-term (30 min–24 h)

4. Implement a fix or rollback to the last known-good deployment.
5. Validate SLI recovery via real-time monitoring.
6. Resume deployments only after 1-hour clean window.

### Post-incident

7. Conduct a blameless post-mortem within 3 business days.
8. Add a regression test (unit, integration, or load) that would have caught the issue.
9. Review SLO target — if budget is consistently exhausted, the target may be wrong.
10. Update `ops/slo-policy.yml` if the target changes.

---

## Review Cadence

| Cadence | Activity |
|---|---|
| Weekly | Review burn rate dashboards; triage Sev 3 tickets |
| Monthly | Review 30-day budget consumption per app; adjust capacity if needed |
| Quarterly | Review SLO targets during strategic scorecard (`node tooling/scripts/generate-quarterly-strategic-scorecard.mjs`) |
| Post-incident | Review affected app SLO after every Sev 1/2 incident |

## Runtime Enforcement

- CI enforcement: `node tooling/scripts/collect-dora-metrics.mjs -- --enforce` blocks when thresholds fail.
- Deployment guardrails: production/pilot releases must pass SLO gate + predictive trend check.
- Threshold tuning authority: platform governance with domain lead sign-off.

---

## Ownership

SLO target accuracy is owned by the domain lead for each app (see `CODEOWNERS` and `platform/registry/apps.json`).  
The Platform Engineering team owns the gate enforcement machinery.
