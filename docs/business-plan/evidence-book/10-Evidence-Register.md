# 10 — Evidence Register

## Objective

Provide a traceability matrix linking substantive business claims to concrete repository artifacts.

| Business Claim | Supporting Repository Artifact(s) | Current Status | Evidence Strength | Confidence |
|---|---|---|---|---|
| Nzila OS operates as a shared decision infrastructure across multiple products. | `README.md`, `ARCHITECTURE.md`, `packages/decision-core/package.json` | Implemented | Code + documentation | Verified |
| The portfolio is centrally governed from a single truth source. | `governance/portfolio/product-catalog.json`, `reports/portfolio-status.md` | Implemented | Machine-readable source + generated report | Verified |
| The repository currently contains 26 top-level apps. | `apps/` directory | Current repository state | Direct repository artifact | Verified |
| The repository currently contains 225 top-level packages. | `packages/` directory | Current repository state | Direct repository artifact | Verified |
| The repository currently contains 52 GitHub Actions workflow files. | `.github/workflows/` directory | Current repository state | Direct repository artifact | Verified |
| Union Eyes is a Tier 1, sell-now, pilot-proof product. | `apps/union-eyes/maturity.json`, `governance/portfolio/product-catalog.json`, `reports/portfolio-status.md` | Current | Machine-readable product record | Verified |
| CIVIC is the public-sector implementation of the Institutional Intelligence platform, with documented thesis, methodology, and market-engagement materials. | `docs/public-service/civic-thesis.md`, `docs/CIVIC_OCI_ALIGNMENT.md`, `docs/public-service/civic-one-page-brief.md` | Current | Documentation set | Documented |
| The ABR codebase (apps/abr/) provides CourtLens with proven technical foundations including tribunal intelligence, workflows, RBAC, audit, and bilingual coverage. | `apps/abr/README.md`, `apps/abr/modules/`, `docs/courtlens/target-architecture.md` | Implemented | App README + module docs | Verified |
| CourtLens is in migration-planning / pilot-definition mode rather than shipped runtime mode. | `docs/courtlens/README.md`, `docs/courtlens/target-architecture.md`, `docs/courtlens/pilot-readiness-plan.md` | Planned | Documentation set | Verified |
| Union Eyes has a controlled pilot evidence pack. | `docs/union-eyes/pilot-evidence-pack/README.md` and contents | Current | Operational documentation corpus | Demonstrated |
| Union Eyes has a documented controlled pilot GO decision. | `docs/union-eyes/pilot-evidence-pack/PILOT_READINESS_MEMO.md` | Current | Readiness memo + conditions | Demonstrated |
| Union Eyes supports audited evidence export and seal verification. | `docs/union-eyes/pilot-evidence-pack/PILOT_READINESS_MEMO.md`, `docs/union-eyes/pilot-evidence-pack/SECURITY_BUYER_PACK.md`, `apps/union-eyes/lib/evidence-export.ts` (cited) | Implemented | Documentation + code references + tests cited | Demonstrated |
| Union Eyes uses fail-closed org-scoped RLS enforcement. | `docs/union-eyes/pilot-evidence-pack/SECURITY_BUYER_PACK.md`, `docs/union-eyes/pilot-evidence-pack/CI_GOVERNANCE_EVIDENCE.md`, `apps/union-eyes/lib/db/with-rls-context.ts` (cited) | Implemented | Code-backed security evidence | Demonstrated |
| The platform uses PostgreSQL and Drizzle ORM. | `README.md`, `packages/db/package.json`, `ARCHITECTURE.md` | Implemented | Code + documentation | Verified |
| The canonical auth authority is `packages/platform-auth/package.json`. | `README.md`, `governance/platform-package-authority.json`, `packages/platform-auth/package.json` | Implemented | Code + governance authority file | Verified |
| The repository uses pnpm workspaces and Turborepo. | `README.md`, `package.json` | Implemented | Config + documentation | Verified |
| Release governance includes staging, production, rollback, and hotfix commands. | `README.md`, `package.json` | Implemented | Command catalog | Verified |
| Production certification exists for selected live runtimes. | `docs/readiness/production-certification.md`, `docs/readiness/production-ready-release-summary.md`, `docs/readiness/platform-production-runtime-inventory.md` | Current | Certification corpus | Demonstrated |
| SBOM generation is part of the security workflow set. | `SECURITY.md`, `.github/workflows/sbom.yml` | Implemented | Policy + workflow | Verified |
| Trivy container scanning is part of the security workflow set. | `SECURITY.md`, `.github/workflows/trivy.yml` | Implemented | Policy + workflow | Verified |
| ZAP/DAST testing is part of the workflow inventory. | `.github/workflows/dast.yml`, `.zap/` | Implemented | Workflow + repo artifact | Verified |
| SOC 2 is presently a readiness scaffold, not a completed attestation. | `docs/compliance/soc2/README.md`, `docs/compliance/soc2/gap-log.md` | Open readiness stage | Formal documentation | Verified |
| Union Eyes has documented pilot metrics tied to runtime routes. | `docs/categories/products-and-market/union-eyes/pilot-kpis.md`, `apps/union-eyes/docs/procurement/PILOT_SCOPE.md` | Implemented | Product documentation + route map | Verified |
| The ABR codebase includes bilingual dashboard coverage. | `apps/abr/README.md`, `apps/abr/messages/` | Implemented/documented | App README + message catalogs | Documented |
| Nzila has a formal doctrine corpus for Institutional Intelligence / OCI. | `docs/doctrine/DOCTRINE.md`, `docs/oci/OCI_METHOD.md`, `docs/oci/methodology/OCI_METHOD_WHITEPAPER_v1.md` | Current | Canonical documentation | Verified |
| OCI methodology is linked to source implementation in Union Eyes. | `docs/oci/methodology/OCI_METHOD_WHITEPAPER_v1.md`, `apps/union-eyes/lib/oci/frameworks/` | Implemented | Documentation + code path | Verified |
| Customer-proof capture is governed by an explicit playbook. | `docs/categories/stakeholders/commercial/customer-proof-playbook.md` | Current | Commercial operating doc | Verified |
| Public commercial claims are governed by a claims ledger. | `docs/categories/stakeholders/commercial/claims-ledger.md` | Current | Commercial governance doc | Verified |
| Corporate structure is documented as Nzila Ventures Inc. holding company ownership. | `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md` | Current | Corporate governance doc | Documented |
| Aubert is documented as founder/CEO and authorized owner. | `governance/corporate/leadership.json`, `docs/governance/owner-operated-review-model.md`, `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md` | Current | Leadership registry + governance docs | Verified |
| Michel is documented as President with labour/legal commercialization scope. | `governance/corporate/leadership.json` | Current | Leadership registry | Documented |
