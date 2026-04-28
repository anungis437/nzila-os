# Security Incident Management Plan

**Doc ID:** SIMP-2026-001
**Version:** 1.0
**Owner:** Security Lead / CISO
**Status:** ACTIVE
**Companion:** [`../../security/THREAT_MODEL.md`](../../security/THREAT_MODEL.md), [`../../security/AUDIT_READINESS.md`](../../security/AUDIT_READINESS.md), [breach-reporting-requirements.md](breach-reporting-requirements.md)

## 1. Definitions

- **Security event** — any observable occurrence that may have security implications.
- **Security incident** — confirmed adverse event or violation of security policy.
- **Personal data breach** (GDPR Art. 4(12)) — incident leading to accidental or unlawful destruction, loss, alteration, unauthorized disclosure of, or access to personal data.
- **Severity** — see §3.

## 2. Roles & contacts

| Role | Name / Channel | Responsibility |
|------|----------------|----------------|
| Incident Commander (IC) | On-call lead | Coordinates response |
| Security Lead | TBD | Technical containment |
| Privacy Lead | TBD | Breach assessment & notification |
| Legal | External counsel TBD | Regulatory + liability |
| Communications | TBD | External / customer comms |
| Engineering on-call | per app rotation | Hands-on remediation |

## 3. Severity matrix

| Sev | Criteria | Initial response time | IC required |
|-----|----------|----------------------|-------------|
| SEV1 | Confirmed breach of Restricted data, OR widespread service compromise | 15 min | Yes |
| SEV2 | Suspected breach, OR active intrusion not yet contained, OR Confidential data exposure | 1 hour | Yes |
| SEV3 | Single-account compromise, OR contained vulnerability exploit attempt | 4 hours | Optional |
| SEV4 | Policy violation without data impact, OR informational | 1 business day | No |

## 4. Phases (NIST 800-61)

### 4.1 Preparation
- All on-call have access to this plan, paging tools, and break-glass credentials.
- Quarterly tabletop exercise (next: 2026-Q3).
- Annual DR test of Postgres restore.

### 4.2 Detection & Analysis
- Sources: Azure Defender alerts, Snyk/Trivy CVE alerts, application audit logs, user reports, vendor breach notifications (24-hour SLA per DPA).
- IC opens an incident channel and an issue with `incident` label; assigns severity.

### 4.3 Containment
- Short-term: rotate compromised credentials, revoke sessions (`auth_user_sessions`), isolate affected Container App revision, block IPs at edge.
- Long-term: patch, redeploy, harden config.

### 4.4 Eradication
- Remove malicious artifacts; verify clean state with fresh deploy from last known-good commit.

### 4.5 Recovery
- Restore service; monitor for recurrence (heightened logging for 14 days).
- Validate data integrity from backups if applicable.

### 4.6 Post-incident
- Within 5 business days: blameless post-mortem with timeline, root cause, contributing factors, corrective actions with owners + due dates.
- Update threat model, runbooks, and waiver list.

## 5. Personal data breach assessment (parallel track)

If personal data may be involved, Privacy Lead runs the breach-clock IMMEDIATELY at detection:

1. **Confirm** whether personal data was accessed, exfiltrated, altered, or destroyed.
2. **Assess risk** to data subjects (likelihood × severity of impact).
3. **Determine notification obligations** per [breach-reporting-requirements.md](breach-reporting-requirements.md).
4. **Notify** within statutory deadlines (GDPR: 72h to authority; PIPEDA: ASAP if real risk of significant harm; HIPAA: 60 days).
5. **Document** the assessment regardless of notification decision (GDPR Art. 33(5) requires recording every breach).

## 6. Communication

- **Internal:** Slack `#incidents` channel + page IC.
- **Customer:** Status page update for SEV1/SEV2; per-customer email if their data is affected.
- **Regulatory:** Privacy Lead leads.
- **Public:** Communications Lead leads; only after Legal sign-off.

## 7. Templates

- Customer notification: see [breach-reporting-requirements.md §5](breach-reporting-requirements.md#5-notification-templates)
- Regulator notification: see same doc §5
- Internal post-mortem: TODO `governance/privacy/incidents/post-mortem-template.md`
