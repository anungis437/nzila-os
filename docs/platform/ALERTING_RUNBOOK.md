# Alerting Runbook

## Overview

This runbook defines alert definitions, escalation paths, and response procedures for the Nzila OS platform. All alerts are implemented as Azure Monitor alert rules targeting Application Insights and Log Analytics workspaces.

For SLO burn-rate alert thresholds, see [`SLO_ERROR_BUDGET_POLICY.md`](./SLO_ERROR_BUDGET_POLICY.md).

---

## Alert Inventory

### SLO / Performance Alerts

| Alert ID | Condition | Severity | Destination |
|---|---|---|---|
| `ALERT-SLO-001` | Error rate burn ≥ 14× over 1h | Sev 1 | On-call page + `#incidents` |
| `ALERT-SLO-002` | Error rate burn ≥ 6× over 6h | Sev 2 | `#platform-eng` + team lead |
| `ALERT-SLO-003` | Error rate burn ≥ 3× over 72h | Sev 3 | `#platform-eng` ticket |
| `ALERT-LATENCY-001` | p95 latency > SLO target × 1.5 for 10 min | Sev 2 | `#platform-eng` |
| `ALERT-LATENCY-002` | p99 latency > SLO target × 2.0 for 5 min | Sev 1 | On-call page |

### Health / Availability Alerts

| Alert ID | Condition | Severity | Destination |
|---|---|---|---|
| `ALERT-HEALTH-001` | Health endpoint returns non-200 for 3 consecutive checks (1 min) | Sev 1 | On-call page |
| `ALERT-HEALTH-002` | Health endpoint response time > 2000 ms for 5 min | Sev 2 | `#platform-eng` |
| `ALERT-HEALTH-003` | Container app replica count = 0 for 2 min | Sev 1 | On-call page |

### Security Alerts

| Alert ID | Condition | Severity | Destination |
|---|---|---|---|
| `ALERT-SEC-001` | Auth failure rate > 10/min per IP (potential brute force) | Sev 1 | `#security` + on-call |
| `ALERT-SEC-002` | Account lockout events > 20/hour | Sev 2 | `#security` |
| `ALERT-SEC-003` | Governance gate failure in production pipeline | Sev 2 | `#platform-eng` + `#security` |
| `ALERT-SEC-004` | Trivy CRITICAL CVE detected in container image | Sev 1 | `#security` + on-call |

### Data / Queue Alerts

| Alert ID | Condition | Severity | Destination |
|---|---|---|---|
| `ALERT-DLQ-001` | DLQ backlog > app SLO threshold for 15 min | Sev 2 | Domain team lead |
| `ALERT-DLQ-002` | DLQ backlog > 2× app SLO threshold | Sev 1 | On-call page |
| `ALERT-DB-001` | Database CPU > 85% for 10 min | Sev 2 | `#platform-eng` |
| `ALERT-DB-002` | Database connection pool exhausted | Sev 1 | On-call page |

---

## Azure Monitor KQL Query Templates

### Error Rate Burn Rate (ALERT-SLO-001/002/003)

```kql
requests
| where timestamp > ago(1h)
| summarize
    total = count(),
    failed = countif(success == false or resultCode startswith "5")
    by bin(timestamp, 5m), cloud_RoleName
| extend error_rate = failed * 100.0 / total
| extend slo_target = 2.0  // replace with per-app target
| extend burn_rate = error_rate / (100.0 - slo_target)
| where burn_rate >= 14
| project timestamp, cloud_RoleName, error_rate, burn_rate
```

### p95 Latency (ALERT-LATENCY-001)

```kql
requests
| where timestamp > ago(10m)
| summarize p95 = percentile(duration, 95) by cloud_RoleName
| where p95 > 750  // 1.5× of 500ms default SLO
```

### Auth Failure Rate (ALERT-SEC-001)

```kql
requests
| where timestamp > ago(5m)
| where url contains "/api/auth" and resultCode in ("401", "403", "429")
| summarize failure_count = count() by client_IP, bin(timestamp, 1m)
| where failure_count > 10
```

### Health Endpoint Consecutive Failures (ALERT-HEALTH-001)

```kql
availabilityResults
| where timestamp > ago(5m)
| where success == false
| summarize consecutive_failures = count() by name, location
| where consecutive_failures >= 3
```

---

## Escalation Matrix

### Severity 1 (Page Immediately)

- **Response time**: 5 minutes acknowledgement
- **Primary**: On-call engineer (rotates weekly)
- **Secondary**: Domain tech lead
- **Escalation path**: On-call → Domain Lead → Platform Director → CTO
- **Bridge**: Open `#inc-YYYYMMDD-<slug>` Slack channel immediately
- **Communication**: Status update every 30 min until resolved

### Severity 2 (Team Notification)

- **Response time**: 30 minutes acknowledgement during business hours
- **Primary**: Domain team `#platform-eng` channel
- **Escalation**: If unacknowledged in 2 hours → page on-call
- **Communication**: Status update every 2 hours

### Severity 3 (Ticket + Backlog)

- **Response time**: Next sprint planning
- **Primary**: Domain team lead creates backlog ticket
- **Escalation**: If unresolved after 2 sprints → Sev 2 escalation review

---

## On-Call Rotation

On-call schedule is maintained in PagerDuty (or equivalent). Primary responsibilities:

1. Acknowledge Sev 1 alerts within 5 minutes
2. Follow the relevant incident playbook:
   - General: this document
   - AI incidents: `docs/platform/AI_INCIDENT_PLAYBOOK_*.md`
   - Security: `SECURITY.md` + `docs/hardening/BASELINE.md`
3. Open an incident Slack channel for Sev 1/2
4. Update status page if user-facing impact
5. Conduct post-mortem within 3 business days of Sev 1 resolution

---

## Alert Silence Policy

Silencing an alert requires:

1. A tracking issue/ticket number
2. An explicit maximum silence duration (no indefinite silences)
3. Approval from the domain tech lead (Sev 1) or team lead (Sev 2/3)

Never silence a security alert (`ALERT-SEC-*`) without a `#security` channel notification.

---

## Adding New Alerts

When adding a new alert:

1. Assign it an ID following the `ALERT-<CATEGORY>-<NNN>` convention
2. Add it to the inventory table above
3. Implement the Azure Monitor alert rule in `infrastructure/monitoring/`
4. Wire the escalation destination in the notification action group
5. Add a runbook link to the Azure alert definition pointing to this document

---

## Alert Automation Status

| Category | Defined | Implemented in Azure | Runbook linked |
|---|---|---|---|
| SLO burn rate | ✅ | ⚠️ Manual setup required | ✅ |
| Latency | ✅ | ⚠️ Manual setup required | ✅ |
| Health / availability | ✅ | ⚠️ Manual setup required | ✅ |
| Security | ✅ | ⚠️ Manual setup required | ✅ |
| DLQ / data | ✅ | ⚠️ Manual setup required | ✅ |

> **Action required**: Alert rules must be provisioned via `infrastructure/monitoring/`. This runbook defines the complete spec — implementation in Azure Monitor is the next step (tracked in backlog).
