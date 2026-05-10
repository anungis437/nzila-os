# Security & Privacy Packet

**Purpose:** Pre-packaged answers to common security and privacy questions from procurement, compliance, and legal teams during pilot evaluation.
**Owner:** CISO / Platform Engineering
**Last Updated:** 2026-03-03

---

## 1. Architecture Overview

Nzila OS is a multi-tenant platform with strict tenant isolation:

- **Multi-tenancy:** Row-level security (RLS) at the database level + application-layer org scoping.
- **Data isolation:** Each org's data is scoped by `org_id`; cross-org queries are architecturally impossible via the scoped DAL.
- **Infrastructure:** Azure-hosted (PaaS), with optional sovereign deployment.
- **Verification:** Automated isolation certification via `Console → Isolation`.

> Evidence artifact: **Isolation Certification Report** (generated via `Console → Isolation`).

---

## 2. Data Protection

| Aspect | Implementation |
|--------|---------------|
| Encryption in transit | TLS 1.2+ enforced on all endpoints |
| Encryption at rest | Azure Blob (AES-256), PostgreSQL (TDE) |
| Key management | Azure Key Vault with managed HSM |
| PII handling | Classified fields, retention rules via `@nzila/data-lifecycle` |
| Data residency | Configurable per org (Azure region selection) |
| Backup & recovery | Automated daily backups, 30-day retention, tested restore |

> Evidence artifact: **Data Protection Summary** (Proof Pack → Data Protection).

---

## 3. Access Control

| Control | Implementation |
|---------|----------------|
| Authentication | Clerk SSO (OIDC) with MFA support |
| Authorization | RBAC with org-scoped roles (`platform_admin`, `org_admin`, `user`, `ops`) |
| API security | Bearer token + org context validation on every request |
| Audit trail | Immutable hash-chained audit log for all mutations |
| Session management | Clerk session management with configurable idle timeout |

> Evidence artifact: **Access Control Matrix** (Proof Pack → RBAC).

---

## 4. Compliance Framework

| Standard | Status | Evidence |
|----------|--------|----------|
| POPIA | Designed for compliance | Data lifecycle, consent management |
| GDPR | Designed for compliance | Data residency, right to erasure |
| SOC 2 Type II | In progress | Proof packs cover Trust Service Criteria |
| ISO 27001 | Roadmap | Controls mapped to Annex A |

> Evidence artifact: **Compliance Controls Matrix** (Proof Pack → Governance).

---

## 5. Incident Response

- Documented incident response playbook: [incident-response.md](../ops/incident-response.md)
- 24/7 on-call rotation with defined SLAs: [on-call.md](../ops/on-call.md)
- Automated health monitoring with alert thresholds
- Post-incident review (PIR) within 5 BD for P1 incidents

> Evidence artifact: **Incident Response Plan** (Proof Pack → Incident Response).

---

## 6. Vulnerability Management

| Process | Cadence |
|---------|---------|
| Dependency scanning (Trivy) | Every CI build |
| Secret scanning (Gitleaks) | Every commit |
| SLO-gated deployment | Every deploy to pilot/prod |
| Penetration testing | Annual (or on request) |
| Red team exercises | Quarterly (internal) |

> Evidence artifact: **Release Attestation** (generated per deploy via `scripts/release-attestation.ts`).

---

## 7. Business Continuity

| Metric | Target |
|--------|--------|
| RPO (Recovery Point Objective) | 1 hour |
| RTO (Recovery Time Objective) | 4 hours |
| Availability SLO | 99.9% |
| Disaster recovery region | Configurable (Azure paired regions) |

---

## 8. Proof Pack Reference

All security and compliance evidence is bundled in the **Proof Pack**, accessible at `Console → Proof Pack`. The proof pack includes:

- Isolation certification report
- Audit trail integrity verification
- RBAC / access control matrix
- Data lifecycle policy
- SLO compliance report
- Release attestation history
- Incident response plan

Each artifact is:

- SHA-256 hashed for tamper evidence
- Stored with 7-year retention
- Org-scoped and exportable

---

## 9. Common Procurement Questions

| Question | Answer |
|----------|--------|
| Is our data isolated from other customers? | Yes — RLS + org-scoped DAL + automated isolation certification. |
| Where is our data stored? | Azure region of your choice (default: South Africa North). |
| Can we export our data? | Yes — full data export via `Console → Platform Export`. |
| Do you have a breach notification process? | Yes — notification within 72 hours per POPIA/GDPR. |
| Can we run our own penetration test? | Yes — with 14-day advance notice. |
| Is MFA supported? | Yes — via Clerk SSO provider. |

---

## Related Documents

- [Scope Checklist](01-scope-checklist.md)
- [Monitoring & SLOs](04-monitoring-and-slos.md)
- [Deploy Profiles](../deploy/profiles.md)
