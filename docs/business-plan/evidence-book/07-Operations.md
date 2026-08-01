# 07 — Operations

## Objective

Assess delivery operations, release governance, SRE discipline, DR, monitoring, FinOps, and onboarding capability using repository evidence.

## Evidence Summary

- **Repository operations are heavily codified in scripts, runbooks, validators, and readiness certifications.** **Confidence: Verified.** Evidence: `package.json`, `ops/runbooks/README.md`, `docs/readiness/`.
- **Release governance is explicit and command-driven.** **Confidence: Verified.** Evidence: `README.md`, `package.json`, `.github/workflows/release-governance.yml`, `.github/workflows/release-train.yml`.
- **Production-readiness documentation is unusually strong for a repository of this type.** **Confidence: Demonstrated.** Evidence: `docs/readiness/production-certification.md`, `docs/readiness/production-ready-release-summary.md`, and `docs/readiness/backup-restore-certification.md`.

## Development Operations Maturity

- **Canonical development controls:** lint, typecheck, test, contract tests, governance validation, docs index, repo audit. **Confidence: Verified.** Evidence: `README.md`, `CONTRIBUTING.md`, `package.json`.
- **Governance audit pipeline:** pnpm governance:audit chains docs, ownership, release, repo, and import-guard audits. **Confidence: Verified.** Evidence: `package.json`.

## Release Governance

| Release capability | Confidence | Evidence |
|---|---|---|
| Staging gate (pnpm release:staging) | Verified | `README.md`, `package.json` |
| Production gate (pnpm release:prod) | Verified | `README.md`, `package.json` |
| Rollback and hotfix procedures | Verified | `README.md`, `package.json`, `ops/runbooks/platform/production-transactional-rollback.md` referenced by certification corpus |
| Gate authority taxonomy | Verified | `docs/governance/gates/gate-taxonomy.md` |

## SRE Practices

- **SRE validation chain exists.** **Confidence: Verified.** Evidence: `package.json` scripts commands `sre:health:contract`, `sre:synthetic:dry-run`, `sre:alerts:dry-run`, `sre:audit`, `sre:dashboard`, and composite `sre:validate`.
- **Incident severity and evidence expectations are documented.** **Confidence: Verified.** Evidence: `ops/incident-response/README.md`.
- **Executive SRE reporting exists as a generated surface.** **Confidence: Documented.** Evidence: `package.json` `sre:dashboard` and referenced `reports/ops/executive-reliability-report.md` in security readiness docs.

## Runbooks

- **Repository-wide runbook framework exists.** **Confidence: Verified.** Evidence: `ops/runbooks/README.md`.
- **Union Eyes controlled pilot operations runbook is substantive and deployment-aware.** **Confidence: Demonstrated.** Evidence: `docs/union-eyes/pilot-evidence-pack/PILOT_OPERATIONS_RUNBOOK.md`.
- **Security runbooks are explicitly referenced in `SECURITY.md`.** **Confidence: Verified.**

## Incident Management

- **Severity model, evidence capture requirements, containment, recovery, and postmortem expectations are documented.** **Confidence: Verified.** Evidence: `ops/incident-response/README.md`.
- **Union Eyes pilot-specific escalation paths are documented.** **Confidence: Demonstrated.** Evidence: `docs/union-eyes/pilot-evidence-pack/PILOT_OPERATIONS_RUNBOOK.md`.

## FinOps

- **FinOps tooling is built into the repo command surface.** **Confidence: Verified.** Evidence: `README.md`, `package.json` scripts finops:build, finops:validate, collect:cost.
- **Investor and internal finance strategy artifacts exist, but many are planning-grade.** **Confidence: Documented.** Evidence: `docs/categories/stakeholders/investor/revenue-scenarios.md`, `governance/corporate/finance/`.

## Disaster Recovery

- **Backup/restore certification exists for the Union Eyes production database.** **Confidence: Demonstrated.** Evidence: `docs/readiness/backup-restore-certification.md`.
- **Restore drill evidence is explicitly cited in Union Eyes maturity and pilot materials.** **Confidence: Demonstrated.** Evidence: `apps/union-eyes/maturity.json`, `docs/union-eyes/pilot-evidence-pack/PILOT_READINESS_MEMO.md`, `docs/union-eyes/pilot-evidence-pack/PILOT_SUCCESS_METRICS.md`.

## Monitoring / Observability

- **OpenTelemetry and structured logging are part of the platform architecture.** **Confidence: Verified.** Evidence: `ARCHITECTURE.md`, `apps/union-eyes/README.md`.
- **Runtime truth and live readiness artifacts exist.** **Confidence: Demonstrated.** Evidence: `reports/runtime/platform-runtime-truth-latest.json` (referenced across evidence docs), `docs/readiness/production-certification.md`.
- **Observability maturity is not uniform across products.** **Confidence: Verified.** Evidence: `apps/union-eyes/maturity.json`, `apps/abr/maturity.json` both mark observability as partial.

## Onboarding Capability

- **Union Eyes onboarding and pilot enablement are documented in detail.** **Confidence: Demonstrated.** Evidence: `docs/categories/products-and-market/union-eyes/quick-start.md`, `docs/categories/products-and-market/union-eyes/admin-guide.md`, `docs/categories/products-and-market/union-eyes/pilot-overview.md`, and `docs/union-eyes/pilot-evidence-pack/PILOT_OPERATIONS_RUNBOOK.md`.
- **Runbook contribution standards and acceptance expectations exist repo-wide.** **Confidence: Verified.** Evidence: `ops/runbooks/README.md`.

## Supporting Artifacts

- `README.md`
- `package.json`
- `ops/runbooks/README.md`
- `ops/incident-response/README.md`
- `docs/readiness/production-certification.md`
- `docs/readiness/production-ready-release-summary.md`
- `docs/readiness/backup-restore-certification.md`
- `docs/governance/gates/gate-taxonomy.md`
- `docs/union-eyes/pilot-evidence-pack/PILOT_OPERATIONS_RUNBOOK.md`

## Current Maturity

Operational maturity is one of Nzila's strongest documentary areas. Production-grade operational evidence is concentrated around the platform and Union Eyes. Other products inherit the platform posture but do not always yet have equivalent product-level proof.

## Commercialization Relevance

Operational maturity matters directly to lenders, procurement teams, and partners because it reduces execution risk and supports claims of repeatable implementation.

## Gaps

- Product-level observability and DR proof are not yet equally complete for FairCase and other portfolio products.
- Some references in readiness docs point to follow-up runbooks or evidence artifacts that are still evolving.
- FinOps evidence is more tooling-rich than externally summarized.

## Next Milestone

Package the operational backbone into a cross-product operating-readiness summary that pairs command-level automation with product-level service evidence.
