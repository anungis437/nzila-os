# On-Call Rotation & Escalation

**Owner:** Platform Engineering
**Review Cadence:** Monthly rotation review; quarterly process review
**Last Updated:** 2026-03-03

---

## 1. Rotation Schedule

### Primary On-Call

| Slot | Coverage | Timezone | Handoff |
|------|----------|----------|---------|
| Week A | Engineer 1 | UTC+2 | Monday 09:00 UTC |
| Week B | Engineer 2 | UTC+2 | Monday 09:00 UTC |
| Week C | Engineer 3 | UTC+1 | Monday 09:00 UTC |
| Week D | Engineer 4 | UTC+2 | Monday 09:00 UTC |

### Secondary On-Call (Backup)

The **previous week's primary** serves as secondary backup.

### Coverage Hours

| Tier | Hours | Response SLA |
|------|-------|-------------|
| Business hours | Mon–Fri 08:00–18:00 local | Per severity rubric |
| After-hours | All other times | P1 only — 30 min ack |
| Weekends/holidays | Full day | P1 only — 30 min ack |

---

## 2. Acknowledgment SLAs

| Severity | Ack SLA | Escalation if unacked |
|----------|---------|----------------------|
| P1 | 15 min | Auto-escalate to secondary → Tech Lead → CTO |
| P2 | 1 hr | Auto-escalate to secondary → Tech Lead |
| P3 | 4 hr | No escalation |
| P4 | Next BD | No escalation |

> **Ack** = Acknowledge the alert in PagerDuty / Slack and open an incident channel.

---

## 3. Escalation Path

```
P1 Flow:
  On-call primary (15 min)
    → Secondary on-call (15 min)
      → Tech Lead (15 min)
        → CTO (immediate)

P2 Flow:
  On-call primary (1 hr)
    → Secondary on-call (30 min)
      → Tech Lead (30 min)
```

### Escalation Contacts

| Role | Contact Method |
|------|---------------|
| On-call primary | PagerDuty + Slack `#ops-alerts` |
| On-call secondary | PagerDuty + Slack DM |
| Tech Lead | Phone + Slack DM |
| CTO | Phone + SMS |
| CISO (security incidents) | Phone + Email |

---

## 4. Handoff Protocol

1. **Outgoing** on-call writes a handoff note in `#ops-handoff` Slack channel:
   - Open incidents / active monitoring
   - Pending follow-ups
   - Any known flaky alerts
2. **Incoming** on-call acknowledges the handoff within 2 hours.
3. Verify PagerDuty rotation has switched correctly.
4. Run `pnpm pilot:check` (if applicable) to confirm system health.

---

## 5. Tools & Access

| Tool | Purpose | Access |
|------|---------|--------|
| PagerDuty | Alert routing & ack | All on-call engineers |
| Slack `#ops-alerts` | Real-time alerts | All eng |
| Teams `Ops Alerts` | Redundant alerting | All eng |
| Console → System Health | Health dashboard | platform_admin, ops |
| Console → Performance | Perf metrics + regressions | platform_admin, ops |
| Runbooks | Step-by-step remediation | [docs/ops/runbooks/](../../ops/runbooks/) |

---

## 6. Alert Routing

Alerts are routed via the on-call alert router at `ops/oncall/alert-routing.ts`:

- **Slack**: `@nzila/chatops-slack` adapter → `#ops-alerts`
- **Teams**: `@nzila/chatops-teams` adapter → `Ops Alerts` channel
- **PagerDuty**: Native integration (webhook)

### Alert Severity Mapping

| Source Metric | Threshold | Pager Severity |
|---------------|-----------|---------------|
| p95 latency | > SLO × 1.5 | P2 |
| Error rate | > SLO × 2 | P1 |
| DLQ backlog | > SLO max | P2 |
| Integration SLA | < SLO min | P2 |
| Full outage (health check fail) | Any | P1 |

---

## 7. On-Call Wellness

- Maximum 1 week of primary on-call per month.
- Comp time: 1 day off after any P1 weekend incident.
- No on-call during approved PTO.
- Quarterly retro on alert noise — target < 5 actionable pages/week.

---

## Related Documents

- [Incident Response Playbook](incident-response.md)
- [Runbooks](../../ops/runbooks/)
- [SLO Policy](../../ops/slo-policy.yml)
