# Incident Response Runbook

| Field   | Value                |
|---------|----------------------|
| Status  | `DRAFT`              |
| Created | 2026-04-20           |
| Owner   | _TBD_                |

## Overview

Procedures for handling P1 (critical) and P2 (major) production incidents across the Nzila platform.

## Severity Levels

| Level | Description | Examples | Response SLA |
|-------|-------------|----------|--------------|
| **P1 — Critical** | Complete service outage or data loss affecting all tenants | DB down, auth broken, data corruption | 15 min acknowledge, 1 hr mitigate |
| **P2 — Major** | Degraded service or partial outage affecting subset of users | Single app unreachable, elevated error rates, AI model failures | 30 min acknowledge, 4 hr mitigate |

## Response Timeline

1. **0–15 min** — Alert fires → on-call acknowledges
2. **15–30 min** — Incident channel opened, triage begins
3. **30–60 min** — Root cause hypothesis, mitigation underway
4. **1–4 hr** — Service restored or workaround in place
5. **24–48 hr** — Postmortem drafted and shared

## Steps

### 1. Detect

- Monitor alerts (Azure Monitor, Application Insights, health checks)
- Confirm impact scope: which services, which tenants

### 2. Triage

- Assign severity (P1/P2)
- Identify incident commander (IC)
- Open dedicated incident channel

### 3. Mitigate

- Apply immediate fix or rollback
- Communicate status to stakeholders
- Escalate if mitigation stalls beyond SLA

### 4. Resolve

- Confirm service restored to normal
- Verify with health checks and smoke tests
- Close incident channel

### 5. Postmortem

- Draft within 48 hours
- Include: timeline, root cause, impact, action items
- Store in `ops/postmortems/YYYY-MM-DD-<slug>.md`

## Communication

- **Internal**: Incident channel in team chat
- **Stakeholders**: Status page update within 30 min of P1
- **Customers**: Email notification for P1 if impact > 1 hr

## Escalation Matrix

| Role | Contact | When |
|------|---------|------|
| On-call engineer | _TBD_ | First responder |
| Engineering lead | _TBD_ | P1 or mitigation > 1 hr |
| CTO / VP Eng | _TBD_ | P1 > 2 hr or data loss |

## Related Docs

- [Database Recovery Runbook](./database-recovery.md)
- [AI Model Rollback](./ai-model-rollback.md)
- [Business Continuity Plan](../../business-continuity/README.md)
- [SLO Policy](../../slo-policy.yml)
