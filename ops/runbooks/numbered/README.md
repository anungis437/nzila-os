# Ops Runbooks

Operational runbooks for Nzila OS incident response and remediation.

## Index

| ID | Title | Severity | Category |
|----|-------|----------|----------|
| [RB-001](rb-001-db-pool-exhaustion.md) | Database Connection Pool Exhaustion | P1 | Infrastructure |
| [RB-002](rb-002-dlq-backlog-spike.md) | DLQ / Outbox Backlog Spike | P2 | Infrastructure |
| [RB-003](rb-003-integration-provider-outage.md) | Integration Provider Outage | P2–P1 | Integration |
| [RB-004](rb-004-latency-regression.md) | Latency Regression (P95/P99 Breach) | P2 | Performance |
| [RB-005](rb-005-error-rate-spike.md) | Error Rate Spike | P1–P2 | Application |
| [RB-006](rb-006-tenant-isolation-breach.md) | Org Isolation Breach | P1 | Security |
| [RB-007](rb-007-deployment-failure.md) | Deployment Failure / Rollback | P2 | Deployment |
| [RB-008](rb-008-certificate-secret-expiry.md) | Certificate / Secret Expiry | P1–P2 | Security |
| [RB-009](rb-009-hash-chain-integrity.md) | Hash Chain / Audit Integrity Failure | P1 | Security |

## When to Use

- **During an incident:** Find the matching runbook and follow the steps.
- **During on-call handoff:** Review active issues linked to specific runbooks.
- **During pilot prep:** Verify you can execute each relevant runbook.

## Related Documents

- [Incident Response Playbook](../platform/incident-response.md)
- [On-Call Rotation](../../../docs/ops/on-call.md)
- [SLO Policy](../../../ops/slo-policy.yml)
