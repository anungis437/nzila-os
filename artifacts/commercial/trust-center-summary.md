# Union Eyes — Trust Center Summary

> **Document type:** Trust Center Summary  
> **Generated:** 2026-04-24 13:12:22 UTC · Git SHA 376b2bca  
> **Classification:** Buyer-shareable

---

## 1. Security Posture

Union Eyes is built on the Nzila OS platform with defence-in-depth:

- **Zero trust architecture:** Every request is authenticated and org-scoped
- **Row-level security:** PostgreSQL RLS enforced at database layer — not at application layer
- **Audit-first design:** Every action writes an immutable, hash-chained audit event
- **Secret management:** Azure Key Vault with 90-day auto-rotation

Development security gates run on every pull request:

- Gitleaks (secret scan) + CodeQL (SAST) + Trivy (SCA) + DAST (weekly)

---

## 2. Identity & Access Controls

| Control | Implementation |
|---------|---------------|
| SSO | Microsoft Entra ID |
| MFA | Enforced via Entra policy |
| SCIM | Auto-provision / deprovision |
| RBAC | 5 tiers: member → steward → LRO → officer → admin |
| Privileged access review | Quarterly attestation (`reports/compliance/access-review/`) |
| Session tokens | JWT; secure rotation |

---

## 3. Data Isolation

Every database query includes `org_id = ?` at the query layer AND is enforced
by PostgreSQL RLS at the database layer. A misconfigured query cannot return
cross-org data — the database enforces the boundary independently.

Evidence sealing uses AES-256 HMAC on every evidence pack export. The HMAC key
is stored in Azure Key Vault; the seal is verified on every download.

---

## 4. Business Continuity & Restore Drills

| Metric | Target |
|--------|--------|
| RTO | ≤ 4 hours |
| RPO | ≤ 1 hour (continuous PITR) |
| Backup retention | 35 days PITR + 90-day pg_dump + 7-year evidence |

**Drill cadence:** Quarterly  
**DR runbooks:** Published in `docs/union-eyes/dr/` (5 runbooks)  
**Evidence artifacts:** `reports/dr/` — available under NDA  
**Last drill:** 2026-04-24 (evidence-mode; infrastructure confirmed)  
**Next live staging drill:** 2026-Q2

---

## 5. Monitoring & Performance

| Tool | Coverage |
|------|---------|
| Sentry | Error tracking, session replay, performance |
| OpenTelemetry | Distributed traces |
| Azure Application Insights | Infrastructure + uptime monitoring |
| Per-route dashboards | In progress (target 2026-07-15) |

Uptime target: 99.9% (no contractual SLA yet — we do not overclaim).

---

## 6. Development Security Gates

| Gate | Frequency |
|------|-----------|
| Gitleaks secret scan | Every commit (pre-commit + CI) |
| CodeQL SAST | Every pull request |
| Trivy SCA | Every release |
| Dependabot | Weekly |
| DAST | Weekly |
| SBOM (CycloneDX) | Every release |

---

## 7. Maturity Roadmap

| Area | Status | Target |
|------|--------|--------|
| Backup / restore | Progressing (runbooks live; live drill pending) | 2026-Q2 |
| Observability | Partial (Sentry + OTEL; route dashboards in progress) | 2026-07-15 |
| Access reviews | Partial (framework live; CI enforcement in progress) | 2026-06-15 |
| Contract tests | Partial | 2026-Q2 |
| SOC 2 Type I | In preparation (95% ready) | Q3 2026 |
| SOC 2 Type II | In preparation | Q1 2027 |

We publish our gaps and target closure dates. We do not overclaim certifications
we have not received.

---

## 8. Contact

**Security enquiries:** security@  
**Procurement / NDA requests:** partnership@  
**Technical diligence:** Available on request for enterprise reviews

---

_Generated from source-of-truth on 2026-04-24 13:12:22 UTC · Git SHA 376b2bca_
