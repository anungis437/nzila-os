# Privacy Readiness Self-Assessment — Nzila Ventures

**Doc ID:** PRA-2026-001
**Methodology:** Info-Tech Privacy Readiness Assessment (12 domains × 5-level maturity)
**Assessed:** 2026-04-28
**Owner:** Privacy Lead
**Next review:** 2026-Q3

Maturity scale: **1 Initial · 2 Repeatable · 3 Defined · 4 Managed · 5 Optimized**

| # | Domain | Current | Target | Evidence | Top gap / next action |
|---|--------|---------|--------|----------|-----------------------|
| 1 | Governance | 2 | 4 | `governance/privacy/`, `CODEOWNERS` | Appoint named DPO; quarterly privacy steering committee |
| 2 | Regulatory Compliance | 2 | 4 | PIPEDA, GDPR primary; HIPAA-adjacent in `apps/union-eyes`, `packages/health-*` | Per-jurisdiction control mapping in [readiness-assessment.md](readiness-assessment.md) |
| 3 | Data Process & Handling | 2 | 4 | Org-scoped Postgres; Container Apps in canadacentral | Complete data inventory across all 22 apps |
| 4 | Incident Response | 3 | 4 | [`../security/THREAT_MODEL.md`](../security/THREAT_MODEL.md), [`incidents/`](incidents/) | Run quarterly tabletop; integrate breach-clock into on-call runbook |
| 5 | Privacy Risk Assessments | 3 | 4 | [`dpia/`](dpia/), [`ai-pia/`](ai-pia/) | Complete DPIAs for all production data flows (currently AI-only) |
| 6 | Notices and Consent | 1 | 4 | None published | Publish [`public/privacy-notice.md`](public/privacy-notice.md) and [`public/cookie-policy.md`](public/cookie-policy.md) |
| 7 | Data Subject Requests | 1 | 4 | Manual via support | Build self-serve DSAR endpoint per [`dsar/`](dsar/) runbook |
| 8 | Privacy by Design | 3 | 4 | Reasoning-context envelope; org scoping; tenant isolation contract tests | Document PbD checklist as a PR-template gate |
| 9 | Information Security | 4 | 4 | [`../security/APPLICATION_SECURITY_POLICY.md`](../security/APPLICATION_SECURITY_POLICY.md), Snyk, Trivy, Argon2id, MFA-capable Entra | Maintain current state |
| 10 | Third-Party Management | 2 | 4 | Vendor list informal | Build vendor inventory + DPA register in [`vendor/`](vendor/) |
| 11 | Awareness and Training | 1 | 3 | None documented | Annual privacy training module; track completion |
| 12 | Program Measurement | 1 | 3 | None | Implement KPIs from [`metrics/privacy-metrics.md`](metrics/privacy-metrics.md); publish annual report |

## Composite scores

- **Current average:** 2.1 / 5 (Repeatable → emerging Defined)
- **Target average (12 months):** 3.7 / 5
- **Highest-risk domains:** 6 (Notices/Consent), 7 (DSARs), 11 (Training) — all at 1

## 12-month roadmap

| Quarter | Milestones |
|---------|-----------|
| 2026 Q2 | Publish privacy notice + cookie policy; appoint DPO; vendor inventory v1 |
| 2026 Q3 | DSAR endpoint live in `apps/web` + `apps/zonga`; data classification rolled out; quarterly tabletop |
| 2026 Q4 | DPIAs complete for top 10 data flows; privacy training launched; metrics dashboard |
| 2027 Q1 | First annual Data Privacy Program Report published; external readiness review |
