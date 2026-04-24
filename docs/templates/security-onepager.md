# Union Eyes — Security One-Pager

> **Document type:** Security One-Pager  
> **Generated:** {{GENERATED_AT}} · Git SHA {{GIT_SHA}}  
> **Classification:** Buyer-shareable

---

## Platform Identity

Union Eyes is a governed SaaS platform for labour union representation workflows,
hosted on **Azure (Canada Central)** with geo-redundant backup in Canada East.
Built on Next.js 16 + Django 5 within the Nzila OS monorepo.

---

## Security Controls at a Glance

### Identity & Access

| Control | Detail |
|---------|--------|
| Authentication | Microsoft Entra ID (SSO) |
| MFA | Enforced via Entra policy |
| SCIM provisioning | Auto-provision / deprovision via Entra SCIM |
| RBAC | 5-tier: member / steward / LRO / officer / admin |
| Session management | JWT with secure rotation |
| Privileged access review | Quarterly — `reports/compliance/access-review/` |

### Data Protection

| Control | Detail |
|---------|--------|
| Encryption at rest | AES-256 (Azure-managed keys) |
| Encryption in transit | TLS 1.2+ enforced |
| Data isolation | Row-level security on every DB query — org-scoped |
| Evidence sealing | AES-256 HMAC seal on every evidence export |
| Audit trail | Hash-chained `audit_events` — append-only, tamper-evident |

### Infrastructure

| Control | Detail |
|---------|--------|
| Hosting | Azure Container Apps |
| Secrets | Azure Key Vault (RBAC, purge-protect, 90-day auto-rotate) |
| Network | Private Key Vault, VNet rules, `Deny` public access |
| TLS | 1.2 minimum enforced |
| Container images | Signed; retained 90 days |

### Development Security

| Control | Detail |
|---------|--------|
| Pre-commit | Lefthook: lint + typecheck + Gitleaks secret scan |
| CI | CodeQL (SAST) + Trivy (SCA) + DAST (weekly) |
| Dependency audit | Dependabot + weekly automated scan |
| SBOM | CycloneDX on every release |
| Branch protection | Enforced on `main` |

---

## Business Continuity

| Metric | Target |
|--------|--------|
| RTO | ≤ 4 hours |
| RPO | ≤ 1 hour |
| Backup | Continuous PITR (35-day retention) + RA-GRS geo-redundant storage |
| DR runbooks | Published — `docs/union-eyes/dr/` |
| Quarterly drill | Automated reminder + reproducible evidence |

---

## Compliance Roadmap

| Certification | Target |
|--------------|--------|
| SOC 2 Type I | Q3 2026 |
| SOC 2 Type II | Q1 2027 |
| ISO 27001:2022 | Q2 2027 |
| GDPR Attestation | Q3 2026 |

---

## What We Do Not Claim

- No SOC 2 certificate issued yet
- No live production deployment with a paying customer yet (pilot-stage)
- RTO is a documented target; live measurement is scheduled for {{BACKUP_TARGET}}

---

_Contact: security@ · Generated {{GENERATED_AT}}_
