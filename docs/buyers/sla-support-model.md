# Nzila OS — SLA & Support Model

> Defines service-level commitments, support tiers, and incident response expectations for Nzila pilot and commercial engagements.
>
> Updated: 2026-04-17 · Status: Pilot-phase commitments (pre-GA)

---

## 1. Deployment Environment Tiers

| Environment | Description | Availability Target |
|-------------|-------------|---------------------|
| Staging (Canada Central) | Active pilot and internal validation environment | Best-effort |
| Production | Not yet activated — requires formal contract | Per contract |

---

## 2. Pilot-Phase SLA Commitments

During the pilot phase, Nzila commits to the following response and resolution targets for **staging environment** issues:

| Priority | Description | First Response | Target Resolution |
|----------|-------------|----------------|-------------------|
| P0 — Critical | Platform unavailable or data integrity at risk | 2 hours | 8 hours |
| P1 — High | Core user journey blocked; no workaround | 4 hours | 24 hours |
| P2 — Medium | Non-blocking issue; workaround available | 1 business day | 5 business days |
| P3 — Low | Enhancement request or cosmetic issue | 3 business days | Next sprint |

> **Scope limitation**: Pilot-phase SLAs apply to the staging environment only. Production-grade SLAs will be established in the commercial contract and subject to infrastructure scale decisions.

---

## 3. Support Channels

| Channel | Availability | Use Case |
|---------|--------------|----------|
| Dedicated Slack channel (pilot orgs) | Business hours (Mon–Fri, 09:00–18:00 ET) | P1–P3 issues, questions |
| Email (`platform-support@nzila.com`) | Async | Non-urgent issues, documentation requests |
| Emergency contact | Defined in pilot agreement | P0 only |

---

## 4. Incident Response Process

### Detection
- Platform health endpoints are monitored by Nzila ops team
- Container Apps availability tracked via Azure Monitor
- Critical error rates trigger internal alerts

### Response
1. **P0**: Immediate Slack/call escalation to platform-core-lead + on-call engineer
2. **P1**: Platform-core-lead notified within 1 hour; triage begins
3. **P2/P3**: Logged in backlog; triaged in next planning session

### Communication
- Pilot customers receive incident updates via their dedicated Slack channel
- Post-incident summary provided within 48 hours for P0/P1 events

---

## 5. Planned Maintenance

- **Windows**: Saturdays 02:00–06:00 ET (minimum 48 hours advance notice for staged work)
- **Emergency patches**: Applied without notice for critical security vulnerabilities
- **Zero-downtime target**: Rolling deploys via Azure Container Apps — typical deploys cause < 30 seconds of elevated latency

---

## 6. Data Recovery Objectives

| Metric | Target | Notes |
|--------|--------|-------|
| RTO (Recovery Time Objective) | 4 hours | Pilot phase only |
| RPO (Recovery Point Objective) | 24 hours | Based on daily DB backup schedule |
| Backup frequency | Daily | PostgreSQL Flexible Server automated backups |
| Backup retention | 7 days | Configurable to 35 days on request |

---

## 7. Pilot Onboarding SLA

| Milestone | Commitment |
|-----------|------------|
| Environment access provisioned | Within 2 business days of signed pilot agreement |
| Initial org and RBAC configured | Within 1 business day of access |
| First walkthrough session | Within 3 business days |
| Feedback loop established | By end of week 1 |

---

## 8. Pilot-to-Production Criteria

The pilot converts to a commercial contract when the following are met:

1. **Usage threshold**: Minimum agreed volume of operational activity (defined per product)
2. **Outcome metrics**: Pilot success criteria met (defined in pilot agreement)
3. **Buyer confirmation**: Signed commercial intent
4. **Production readiness gate**: Nzila internal gate passed (`can_claim_production_deployment: true`)

---

## 9. Out-of-Scope (Pilot Phase)

The following are explicitly out of scope during the pilot phase:

- Enterprise SSO (SAML / SCIM) provisioning
- Custom domain SSL certificates
- Data residency guarantees beyond Canada Central
- HIPAA / SOC 2 / ISO 27001 certifications
- 99.9%+ uptime SLA (production-grade commitments)
- On-premises or customer-cloud deployment

These items are roadmap targets for commercial GA.
