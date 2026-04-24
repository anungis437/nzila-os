# Union Eyes — Procurement Pack

> **Document type:** Procurement Pack  
> **Generated from:** `apps/union-eyes/maturity.json`, `reports/dr/`  
> **Generated:** {{GENERATED_AT}}  
> **Git SHA:** {{GIT_SHA}}  
> **Classification:** Buyer-shareable (sanitized)

---

## 1. Vendor Overview

| Field | Value |
|-------|-------|
| Product | Union Eyes |
| Vendor | Nzila OS |
| Product tier | {{PORTFOLIO_TIER}} |
| Deployment model | SaaS (multi-tenant with org isolation) |
| Hosting region | Azure Canada Central (primary), Canada East (geo-redundant) |
| Status | {{STATUS}} |

---

## 2. Functional Scope

| Module | Description | Status |
|--------|-------------|--------|
| Grievance Intake | Structured member submission with audit trail | ✅ Production |
| Case Management | Full lifecycle case tracking | ✅ Production |
| Steward Workspace | Rep-facing task surface | ✅ Production |
| LRO Workspace | Senior oversight, escalation, arbitration prep | ✅ Production |
| Officer Dashboard | Analytics, case risk, load management | ✅ Production |
| Member Inbox | Outcome visibility | ✅ Production |
| Evidence Pack | Hash-sealed tamper-evident export | ✅ Production |
| AI Case Intelligence | Case pattern analysis | ✅ Available |
| Multi-org Federation | National + local federation | ✅ Available |

---

## 3. Security Controls

| Control | Implementation | Verified |
|---------|---------------|---------|
| Authentication | Microsoft Entra ID / SSO | ✅ |
| SCIM provisioning | Entra SCIM sync | ✅ |
| Role-based access control (RBAC) | 5-tier: member / steward / LRO / officer / admin | ✅ |
| Row-level security | PostgreSQL RLS — every query org-scoped | ✅ |
| Audit trail | Hash-chained `audit_events` — append-only | ✅ |
| Evidence sealing | AES-256 HMAC sealed evidence packs | ✅ |
| Secrets management | Azure Key Vault (RBAC, purge-protect, 90-day auto-rotate) | ✅ |
| TLS | 1.2 minimum enforced on all services | ✅ |
| Network isolation | Container Apps + private Key Vault + VNet rules | ✅ |
| Vulnerability scanning | Trivy + Dependabot + weekly DAST | ✅ |
| SAST / secret scan | CodeQL + Gitleaks in CI | ✅ |
| SBOM | CycloneDX on every release | ✅ |

---

## 4. Data Protection

| Aspect | Detail |
|--------|--------|
| Data residency | Canada Central (primary) |
| Geo-redundancy | Canada East (RA-GRS) |
| Encryption at rest | AES-256 (Azure-managed) |
| Encryption in transit | TLS 1.2+ |
| Data isolation | Org-scoped RLS — no cross-tenant data access |
| Evidence retention | 7 years (evidence packs) |
| Backup retention | 35 days PITR (prod), 90-day pg_dump |
| Client data export | Full JSON export + evidence packs on request |
| Data deletion | On org offboarding — full wipe with evidence |

---

## 5. Business Continuity & Disaster Recovery

| Objective | Target | Basis |
|-----------|--------|-------|
| RTO | ≤ 4 hours | Azure PITR; IaC-backed rebuild; container registry |
| RPO | ≤ 1 hour | Continuous WAL (architectural; operational target conservative) |
| DR runbooks published | ✅ | `docs/union-eyes/dr/` (5 runbooks) |
| Restore drill cadence | Quarterly | `.github/workflows/dr-drill-reminder.yml` |
| Evidence artifacts | ✅ | `reports/dr/restore-drill-{{DRILL_DATE}}.json` |
| Next live staging drill | {{NEXT_DRILL_DATE}} | Staged execution with measured RTO |

Full DR evidence package available under NDA.

---

## 6. Availability & Performance

| Metric | Status |
|--------|--------|
| Uptime SLA | 99.9% target (no contractual SLA yet) |
| Observability | Sentry + OpenTelemetry traces wired |
| Per-route dashboards | In progress (target {{OBSERVABILITY_TARGET}}) |
| Alerting | Azure Application Insights |
| On-call | Defined in `docs/ops/on-call.md` |

---

## 7. Development Security

| Gate | Status |
|------|--------|
| Pre-commit hooks | Lefthook: lint-staged + typecheck + gitleaks |
| Branch protection | Enforced on main |
| CI pipeline | Lint + typecheck + unit tests + contract tests |
| Dependency audit | Dependabot + weekly DAST |
| Quarterly access review | ✅ `reports/compliance/access-review/` |
| SOC 2 Type I target | Q3 2026 |
| SOC 2 Type II target | Q1 2027 |

---

## 8. Compliance Roadmap

| Certification | Target | Status |
|--------------|--------|--------|
| SOC 2 Type I | Q3 2026 | In preparation |
| SOC 2 Type II | Q1 2027 | Readiness 95% |
| ISO 27001:2022 | Q2 2027 | Readiness 92% |
| GDPR Attestation | Q3 2026 | In preparation |

---

## 9. Maturity Gaps (Transparent)

| Gap | Current State | Target |
|-----|--------------|--------|
| Live RTO measurement | Pending first staging execution | {{BACKUP_TARGET}} |
| Per-route performance dashboards | Partial | {{OBSERVABILITY_TARGET}} |
| CI-enforced access review | Framework live | {{ACCESS_REVIEW_TARGET}} |
| Contract test coverage | Partial | {{CONTRACTS_TARGET}} |

We publish our gaps and closure targets. We do not overclaim.

---

## 10. Document Index (Available Under NDA)

| Document | Location |
|---------|---------|
| DR Runbooks | `docs/union-eyes/dr/` |
| Restore Drill Evidence | `reports/dr/` |
| Access Review Attestations | `reports/compliance/access-review/` |
| Maturity JSON | `apps/union-eyes/maturity.json` |
| Architecture Docs | `docs/architecture/` |
| RBAC Matrix | `docs/pilot/cupe/CUPE_RBAC_MATRIX.md` |
| CAPE Pilot Audit | `apps/union-eyes/docs/CAPE-PILOT-AUDIT-REPORT.md` |

---

_Generated from source-of-truth on {{GENERATED_AT}} · Git SHA {{GIT_SHA}}_
