# On-Call

**Owner:** Platform Engineering  
**Review Cadence:** Monthly

## Purpose

Define on-call procedures, escalation paths, and responsibilities for Nzila OS.

## On-Call Rotation

| Role | Coverage | Escalation After |
|---|---|---|
| Primary on-call | 24/7 weekly rotation | 15 min (P1), 1 hour (P2) |
| Secondary on-call | Backup for primary | After primary escalation |
| Engineering manager | Management escalation | After secondary escalation |
| CISO | Security incidents | Direct page for security events |

## Escalation Matrix

| Severity | First Responder | Escalation 1 (15 min) | Escalation 2 (30 min) | Escalation 3 (1 hour) |
|---|---|---|---|---|
| P1 | Primary on-call | Secondary + EM | CTO | CEO |
| P2 | Primary on-call | Secondary | EM | CTO |
| P3 | Primary on-call | — | — | — |
| P4 | Next business day | — | — | — |

## Handoff Procedure

1. Review open incidents and ongoing issues
2. Update on-call log with status of each item
3. Confirm monitoring dashboards and alert configs
4. Acknowledge handoff in communication channel

## Evidence to Capture

On-call events that escalate to P1/P2 follow the [Incident Response](../incident-response/README.md) evidence procedures.

## References

- [Incident Response](../incident-response/README.md)
- [Runbook Template Schema](../runbooks/TEMPLATE_SCHEMA.md)
