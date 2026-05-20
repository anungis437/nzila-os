# SOC 2 Evidence Inventory — Nzila OS

> Catalogue of evidence artifacts available to support a SOC 2 examination.
> Each entry lists the artifact, its repo location (or system source), the
> TSC criteria it supports, and the cadence at which it is produced.

## A. Code-as-evidence (continuous, machine-verified)

| Artifact | Location | Supports | Cadence |
|----------|----------|----------|---------|
| RLS policies (238) | `apps/union-eyes/db/migrations/`, `apps/union-eyes/db/schema/` | CC5.2, CC6.1, CC6.3 | Every migration |
| Contract tests (~250) | `tooling/contract-tests/` | CC3.4, CC5.1, CC8.1 | Every PR (CI blocking) |
| AI boundary tests | `tooling/contract-tests/ai-boundary-*` | CC3.3 | Every PR |
| Org-isolation tests | `tooling/contract-tests/ue-org-column-audit.test.ts` | CC5.2, CC6.3 | Every PR |
| Hash-chained audit logger | `apps/union-eyes/lib/audit-logger.ts` | CC7.3 | Real-time |
| Evidence pack sealing | `apps/union-eyes/lib/evidence-export.ts` | CC7.3, C1.1 | On-demand per case |
| Lifecycle CI test (audit → seal → verify) | `apps/union-eyes/lib/__tests__/evidence-export.lifecycle.test.ts` | CC7.3 | Every PR |
| FSM transition tests | `apps/union-eyes/lib/workflow/__tests__/case-lifecycle.test.ts` | CC5.1, CC8.1 | Every PR |
| Django observability parity tests | `apps/union-eyes/backend/observability/tests/test_correlation_parity.py` | CC7.2 | Every PR |
| Governance audit | `pnpm governance:audit` | CC4.1 | Every PR |
| Docs validation | `pnpm validate:docs` | CC2.1, CC4.1 | Every PR |

## B. CI / CD evidence (GitHub Actions)

| Artifact | Location | Supports | Cadence |
|----------|----------|----------|---------|
| Trivy scans | `.github/workflows/security-*.yml` | CC6.8, CC7.1 | Every PR + nightly |
| Dependabot | `.github/dependabot.yml` | CC6.8 | Daily |
| Secret scanning | GitHub native + push protection | CC6.8, CC7.1 | Continuous |
| SBOM generation | `.github/workflows/sbom.yml` (if present) | CC6.8 | Per release |
| Release attestation | `.github/workflows/release.yml` | CC8.1 | Per release |
| Branch protection rules | Repo settings (export to `governance/`) | CC8.1 | Quarterly export |

## C. Policy & process documents

| Artifact | Location | Supports |
|----------|----------|----------|
| Data Processing Agreement (DPA) template | `docs/categories/platform-and-operations/governance/dpa-template.md` | CC2.3, CC9.2, P-series |
| Vendor questionnaire response | `docs/categories/platform-and-operations/governance/vendor-questionnaire.md` | CC2.3, CC9.2 |
| Trust page | `apps/veridian-site/app/trust/` | CC2.3 |
| Security page | `apps/veridian-site/app/security/` | CC2.3 |
| Pen-test plan | `docs/categories/platform-and-operations/governance/pentest-plan.md` | CC4.1 |
| Incident response runbooks | `docs/categories/platform-and-operations/runbooks/` | CC7.4 |
| Architecture record | `ARCHITECTURE.md` + ADRs in `docs/categories/decision-records/` | CC2.1, CC8.1 |

## D. Runtime evidence (production)

| Artifact | Source | Supports | Cadence |
|----------|--------|----------|---------|
| Application logs (structured JSON) | Azure Log Analytics | CC7.2, CC7.3 | Real-time |
| Audit chain segments | DB `audit_log` table | CC7.3 | Real-time |
| Sealed evidence packs | Object storage + HMAC | CC7.3, C1.1 | On-demand |
| Backup attestations | Azure-managed | A1.2, CC9.1 | Daily |
| Access reviews | TBD (gap) | CC6.2, CC6.3 | Quarterly target |

## E. Inherited controls (Azure Canada Central)

Microsoft Azure SOC 2 reports cover physical security (CC6.4, CC6.5),
environmental controls, and platform availability (A1.2). Latest report
available via the Microsoft Service Trust Portal.

## How to refresh this inventory

1. After each major release, run `pnpm governance:audit` and link the report.
2. Re-export branch protection rules to `governance/branch-protection.json`.
3. Pull Azure backup attestations and store under `governance/inherited/`.
4. Update [`gap-log.md`](./gap-log.md) with any closed or newly-discovered gaps.
