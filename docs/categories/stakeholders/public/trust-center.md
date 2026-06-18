# Union Eyes — Trust Center

> **Classification:** Public (buyer-safe)  
> **Maintained by:** Platform Engineering / SRE / CISO  
> **Last Updated:** 2026-04-24  
> **Contact:** security@ | partnership@

---

Union Eyes is a governed SaaS platform for labour union representation workflows.
This Trust Center documents our security posture, data protection practices,
business continuity program, and compliance roadmap.

**Transparency principle:** We only state what is true. Every claim in this
document maps to a verifiable repository artifact or IaC control. We publish
our gaps and target closure dates alongside our strengths.

---

## 1. Security Posture

### Architecture

Union Eyes is hosted on **Azure Canada Central** (primary) with **Canada East**
as a geo-redundant secondary. It is built on Next.js 16 + Django 5 within the
Nzila OS monorepo, deployed on Azure Container Apps.

### Development Security Gates

Every pull request passes:

| Gate | Tool | Frequency |
|------|------|-----------|
| Secret scan | Gitleaks (pre-commit + CI) | Every commit |
| Static analysis (SAST) | CodeQL | Every pull request |
| Software composition analysis (SCA) | Trivy | Every release |
| Dependency audit | Dependabot | Weekly |
| Dynamic analysis (DAST) | Automated | Weekly |
| Software bill of materials | CycloneDX SBOM | Every release |

### Infrastructure Security

| Control | Implementation |
|---------|---------------|
| Network isolation | Azure Container Apps + private Key Vault + VNet deny rules |
| Secrets management | Azure Key Vault (RBAC-only, purge-protect, soft-delete 90d) |
| Secret rotation | 90-day auto-rotation policy |
| TLS | 1.2 minimum enforced on all services |
| Container signing | Images signed at build time; registry enforces signed pulls |

---

## 2. Identity & Access Controls

| Control | Detail |
|---------|--------|
| Authentication | Nzila platform auth (email/password + Entra OIDC) |
| Single Sign-On | Microsoft Entra OIDC supported |
| Multi-factor authentication | Entra MFA for Entra users; required for admin access |
| SCIM provisioning | Planned for enterprise GA (not currently GA) |
| Role-based access control | 5 tiers: member / steward / LRO / officer / admin |
| Privileged access review | Quarterly cadence framework active — `reports/compliance/access-review/` |
| Session management | JWT with secure rotation; no persistent sessions |

No super-admin console exists outside the governed auth and RBAC hierarchy.
Admin access is reviewed quarterly; live Entra-backed attestation evidence is
produced on review cadence.

---

## 3. Data Isolation

### Row-Level Security

Every database query includes `org_id = ?` at the application query layer AND
is independently enforced by **PostgreSQL Row-Level Security (RLS)** at the
database layer. A misconfigured application query cannot return cross-tenant
data — the database enforces the boundary independently.

### Evidence Sealing

Every evidence pack export is sealed with **AES-256 HMAC**. The seal key is
stored in Azure Key Vault. The seal is verified on every download. Tampering
is detectable and logged in the immutable audit trail.

### Audit Trail

Every privileged action writes an immutable `audit_event` with:

- `actor_id` (the authenticated user or system actor)
- `org_id` (the organisation scope)
- `trace_id` (correlated request trace)
- `hash` / `prev_hash` (hash chain — tamper-evident, append-only)

The hash chain means audit events cannot be deleted or reordered without
detection.

---

## 4. Business Continuity & Restore Drills

### Recovery Objectives

| Metric | Target | Basis |
|--------|--------|-------|
| **RTO** | ≤ 4 hours | Azure PITR + IaC rebuild + container registry |
| **RPO** | ≤ 1 hour | Continuous PostgreSQL WAL (architectural target) |

We do not claim a measured RTO that has not been tested. Our infrastructure
analysis puts estimated actual RTO at 50–100 minutes. Live measurement is
scheduled for 2026-Q2.

### Backup Infrastructure

| System | Method | Redundancy | Retention |
|--------|--------|-----------|----------|
| PostgreSQL primary | Continuous PITR | Zone-HA + geo-redundant | 35 days |
| Daily full backup | pg_dump + encrypted upload | RA-GRS | 90 days |
| Evidence storage | Blob RA-GRS | Real-time geo-replication | 7 years |
| Config / IaC | Git | Version-controlled | Permanent |
| Container images | Azure Container Registry | — | 90 days |

### Drill Cadence

| Drill Type | Frequency | Last Completed | Next |
|-----------|-----------|---------------|------|
| Dry-run evidence audit | Monthly | 2026-04-24 | 2026-05 |
| Live staging restore (measured RTO) | Quarterly | Pending | 2026-Q2 |
| Full environment rebuild | Annually | Pending | 2026-Q4 |

### DR Documentation

Five published runbooks in `docs/union-eyes/dr/`:

1. `restore-drill-runbook.md` — master drill procedure
2. `database-restore.md` — PITR / rollback / full rebuild with Azure CLI commands
3. `blob-recovery.md` — evidence storage recovery
4. `rollback-procedure.md` — container rollback procedure
5. `continuity-matrix.md` — BCP priority matrix + credential rotation

Evidence artifacts: `reports/dr/` — available under NDA on request.

---

## 5. Monitoring & Performance

| Tool | Coverage |
|------|---------|
| Sentry | Error tracking, session replay, performance |
| OpenTelemetry | Distributed traces wired from Next.js + Django |
| Azure Application Insights | Infrastructure uptime, request monitoring |
| Azure Monitor workbook | Route performance — `docs/ops/azure-monitor/union-eyes-route-performance.workbook.json` |

### Performance Targets

| Metric | Target |
|--------|--------|
| P95 latency (priority routes) | ≤ 500ms (Green) / ≤ 2s (Yellow) / > 2s (Red) |
| Error rate | < 1% (Green) / < 5% (Yellow) / > 5% (Red) |
| Uptime | 99.9% target |

Per-route numeric dashboards are in progress; target 2026-Q2.

---

## 6. Development Security Gates

See §1 above. The CI pipeline (`ci.yml`) enforces:

- Lint + typecheck on every PR
- Unit tests with coverage
- Contract tests (no fake production behaviour, evidence chain integrity, RLS)
- Gitleaks secret scan
- CodeQL SAST
- Trivy SCA

Pre-commit hooks enforce lint, typecheck, and Gitleaks on every commit before
it can leave a developer's machine.

---

## 7. Compliance Roadmap

| Certification | Current State | Target |
|--------------|--------------|--------|
| SOC 2 Type I | In preparation (95% readiness) | Q3 2026 |
| SOC 2 Type II | In preparation | Q1 2027 |
| ISO 27001:2022 | In preparation (92% readiness) | Q2 2027 |
| GDPR Attestation | In preparation | Q3 2026 |
| POPIA Compliance | Planned | Q4 2026 |

We publish our certification timeline honestly. We have no issued certifications
to date — the SOC 2 readiness assessment is based on internal self-assessment
against TSC criteria mapped in `ops/compliance/CERTIFICATION_ROADMAP.md`.

### Active Governance Controls

| Control | Frequency | Evidence |
|---------|-----------|---------|
| DR restore drill | Quarterly | `reports/dr/` |
| Privileged access review | Quarterly | `reports/compliance/access-review/` |
| Dependency vulnerability audit | Weekly | `dependabot.yml` |
| SBOM generation | Every release | CI artifact |
| Evidence chain integrity test | Every CI run | Contract test suite |
| Secret scan | Every commit | Gitleaks |

---

## 8. Contact Security@

For security disclosures, procurement diligence, or NDA-protected artifact
sharing, contact:

- **Security enquiries & disclosures:** security@
- **Procurement / IT governance reviews:** partnership@
- **Technical diligence briefings:** Available on request

We respond to security disclosures within 48 hours.  
We will not use legal threats against good-faith researchers.

---

*This document is generated from source-of-truth and updated quarterly.
All claims are mapped to verifiable repository artifacts.*
