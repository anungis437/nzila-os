# Zonga Backup & Incident Response Plan

> **Report type:** Launch readiness — backup and incident response  
> **Generated:** 2025-Q2  
> **Scope:** Database backups, storage backups, restore drills, and incident response procedures

---

## Backup Configuration

| Asset | Backup Frequency | Retention | Storage |
|-------|-----------------|-----------|---------|
| PostgreSQL (primary DB) | Daily automated + WAL continuous | 30 days | Azure Blob Storage — `backups` container |
| Audio file storage | Weekly incremental | 90 days | Azure Blob Storage — `media` container |
| Configuration / secrets | On change via Key Vault versioning | Indefinite | Azure Key Vault |
| Application database export | Daily snapshot | 7 days | `nzilacanadastore/backups` |

---

## Restore Drill Results

| Drill Date | Scope | RTO Achieved | RPO Achieved | Status |
|------------|-------|-------------|-------------|--------|
| 2025-Q1 | Full DB restore from nightly snapshot | 42 minutes | < 24 hours | ✅ Pass |
| 2025-Q2 | Point-in-time restore (1-hour lag) | 18 minutes | < 1 hour | ✅ Pass |

Full drill runbook: `docs/zonga/dr/restore-drill-runbook.md`

---

## Incident Response Procedures

### Severity Classification

| Severity | Description | Response Time | Examples |
|----------|-------------|---------------|---------|
| P1 — Critical | Full platform outage | 15 minutes | DB down, streaming unavailable |
| P2 — High | Core feature degraded | 1 hour | Payouts failing, auth errors |
| P3 — Medium | Non-critical feature impacted | 4 hours | Admin screen unavailable |
| P4 — Low | Minor issue | Next business day | UI glitch, typo |

### Response Steps (P1/P2)

1. **Detect** — Alert fired via Azure Monitor → Slack `#zonga-alerts`
2. **Acknowledge** — On-call engineer acknowledges within SLA window
3. **Investigate** — Check Azure Container Apps logs, Application Insights, DB health
4. **Contain** — Scale down affected service, enable maintenance mode if needed
5. **Restore** — Execute appropriate runbook (DB restore, CDN purge, container restart)
6. **Communicate** — Status page updated; partner notification if impact > 30 min
7. **Post-mortem** — Blameless post-mortem within 48 hours of P1 resolution

---

## On-Call Coverage

- Primary on-call rotation: 2 engineers (weekly rotation)
- Escalation: Engineering lead → CTO
- Tooling: Azure Monitor alerts → PagerDuty → Slack `#zonga-alerts`

---

## Recovery Targets

| Metric | Target |
|--------|--------|
| RTO (Recovery Time Objective) | < 1 hour (P1) |
| RPO (Recovery Point Objective) | < 1 hour (continuous WAL) |
| Backup restore test frequency | Quarterly |

---

*Reviewed by: Nzila platform reliability team. Status: Approved for pilot operations.*
