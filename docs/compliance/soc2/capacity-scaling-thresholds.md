# SOC2 Capacity And Scaling Thresholds (A1.1)

Purpose: define explicit, reviewable capacity thresholds and escalation actions for production operations.

Owner: Platform Lead
Effective date: 2026-06-07
Review cadence: Quarterly

## Scope

- Console and Union Eyes production services
- Orchestrator API critical backend path
- Database and container runtime capacity signals

## Service-Level Capacity Thresholds

| Signal | Green | Yellow | Red | Action |
|---|---|---|---|---|
| API p95 latency (critical routes) | <= 500 ms | > 500 ms and <= 2000 ms | > 2000 ms sustained 5 min | Scale app replicas, investigate slow dependencies, open incident if red persists > 10 min |
| API 5xx error rate | < 1% | >= 1% and < 5% | >= 5% sustained 5 min | Trigger rollback evaluation and incident response |
| CPU utilization (app containers) | < 65% | >= 65% and < 80% | >= 80% sustained 10 min | Increase replica min/max and evaluate resource requests |
| Memory utilization (app containers) | < 70% | >= 70% and < 85% | >= 85% sustained 10 min | Increase memory limits and investigate leak patterns |
| Pod/container restart rate | 0-1 per hour | 2-3 per hour | >= 4 per hour | Incident triage and rollback candidate review |

## Database Capacity Thresholds

| Signal | Green | Yellow | Red | Action |
|---|---|---|---|---|
| DB CPU utilization | < 60% | >= 60% and < 75% | >= 75% sustained 10 min | Scale compute tier and evaluate expensive queries |
| DB storage utilization | < 70% | >= 70% and < 85% | >= 85% | Execute storage expansion runbook |
| DB connection saturation | < 70% of max | >= 70% and < 85% | >= 85% sustained 5 min | Increase pool discipline, investigate leaks, emergency scale if needed |
| Replication/restore readiness checks | Pass | Warning | Fail | Block promotion on fail until remediated |

## Escalation Policy

1. Yellow status for more than 30 minutes: open ops ticket and assign owner.
2. Red status for more than 10 minutes on critical route or DB: declare incident and activate rollback decision path.
3. Any red status during release window: require explicit go/no-go re-approval.

## Evidence Locations

- Release and runtime evidence reports under `reports/sre/` and `reports/runtime/`
- Restore drill evidence under `reports/runtime/live-captures/*/restore-drill/`
- Governance release audits under `reports/release-governance-audit.json`

## Review Log

| Date | Reviewer | Change |
|---|---|---|
| 2026-06-07 | Platform Lead | Initial threshold baseline published |
