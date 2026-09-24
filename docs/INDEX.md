# Documentation Index

Curated, hand-maintained index of **current** Nzila OS documentation, organised by audience.

- This page is maintained by hand. The exhaustive, machine-generated listing of every markdown
  file is [documentation-index.md](documentation-index.md) (`pnpm docs:index`) — use that when
  you need to find something this page does not list.
- Historical planning, iteration, and completed-programme material lives under
  [categories/historical-archive/archive/](categories/historical-archive/archive/). It is kept
  for lineage and is not current authority.
- Where a document and a machine-readable authority disagree, the authority wins. See
  "Machine-readable authorities" in [ARCHITECTURE.md](../ARCHITECTURE.md).

## Current authority, at a glance

| Subject                                                       | Authoritative artifact                                                                                                                                                           |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What NzilaOS is, commercial spine                             | [../README.md](../README.md)                                                                                                                                                     |
| Architecture, authority boundaries, capability ownership      | [../ARCHITECTURE.md](../ARCHITECTURE.md)                                                                                                                                         |
| Union Eyes engineering + readiness                            | [union-eyes/README.md](union-eyes/README.md)                                                                                                                                     |
| CIVIC / OCI positioning                                       | [CIVIC_OCI_ALIGNMENT.md](CIVIC_OCI_ALIGNMENT.md) · [oci/README.md](oci/README.md)                                                                                                |
| OCI doctrine dispositions (superseded / premature / internal) | [oci/SUPERSEDED.md](oci/SUPERSEDED.md)                                                                                                                                           |
| Product tier / GTM posture                                    | [../governance/portfolio/product-catalog.json](../governance/portfolio/product-catalog.json) (read [../governance/portfolio/README.md](../governance/portfolio/README.md) first) |
| Security policy                                               | [../SECURITY.md](../SECURITY.md)                                                                                                                                                 |
| Contributing + repo contract                                  | [../CONTRIBUTING.md](../CONTRIBUTING.md)                                                                                                                                         |

## Category-First Navigation

| Category              | Purpose                                                      | Location                                                                                     |
| --------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Stakeholders          | Audience-first docs (builders, operators, buyers, investors) | [categories/stakeholders/README.md](categories/stakeholders/README.md)                       |
| Platform & Operations | Architecture, platform, governance, runtime ops              | [categories/platform-and-operations/README.md](categories/platform-and-operations/README.md) |
| Products & Market     | Product surfaces, pilots, commercial and GTM docs            | [categories/products-and-market/README.md](categories/products-and-market/README.md)         |
| Historical Archive    | Archived iterations and historical reference                 | [categories/historical-archive/README.md](categories/historical-archive/README.md)           |

## Builders (Engineering)

| Document             | Purpose                 | Location                                                                                                                                                          |
| -------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quick Start          | 5-minute setup guide    | [docs/categories/stakeholders/builders/QUICKSTART.md](categories/stakeholders/builders/QUICKSTART.md)                                                             |
| Contributing         | How to contribute       | [docs/categories/stakeholders/builders/CONTRIBUTING.md](categories/stakeholders/builders/CONTRIBUTING.md)                                                         |
| Commands             | Full command reference  | [docs/categories/stakeholders/builders/COMMANDS.md](categories/stakeholders/builders/COMMANDS.md)                                                                 |
| Architecture Map     | Repo structure & layers | [docs/categories/stakeholders/builders/ARCHITECTURE_MAP.md](categories/stakeholders/builders/ARCHITECTURE_MAP.md)                                                 |
| Architecture (Full)  | Technical architecture  | [ARCHITECTURE.md](../ARCHITECTURE.md)                                                                                                                             |
| Golden Path Guide    | Developer golden path   | [GOLDEN_PATH_DEVELOPER_GUIDE.md](GOLDEN_PATH_DEVELOPER_GUIDE.md)                                                                                                  |
| Platform Boundaries  | App vs platform rules   | [docs/categories/platform-and-operations/platform/platform-boundaries.md](categories/platform-and-operations/platform/platform-boundaries.md)                     |
| When to Use Platform | Platform package guide  | [docs/categories/platform-and-operations/platform/WHEN_TO_USE_PLATFORM_PACKAGES.md](categories/platform-and-operations/platform/WHEN_TO_USE_PLATFORM_PACKAGES.md) |
| Shell Architecture   | App shell model         | [docs/categories/platform-and-operations/platform/SHELL_ARCHITECTURE.md](categories/platform-and-operations/platform/SHELL_ARCHITECTURE.md)                       |
| Auth Migration       | Auth system notes       | [docs/categories/platform-and-operations/platform/auth-migration-architecture.md](categories/platform-and-operations/platform/auth-migration-architecture.md)     |
| Contracts            | Platform contracts      | [docs/categories/platform-and-operations/platform/CONTRACTS.md](categories/platform-and-operations/platform/CONTRACTS.md)                                         |

## Operators (Release, SRE, Incidents)

| Document                              | Purpose                                          | Location                                                                                                                                                |
| ------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deployment Model                      | Staging → prod promotion                         | [docs/categories/platform-and-operations/ops/DEPLOYMENT_PROMOTION_MODEL.md](categories/platform-and-operations/ops/DEPLOYMENT_PROMOTION_MODEL.md)       |
| Release Governance                    | Release process & gates                          | [ops/release-governance/](ops/release-governance/)                                                                                                      |
| Rollback Runbook                      | How to rollback                                  | [docs/categories/platform-and-operations/migration/ROLLBACK_RUNBOOK.md](categories/platform-and-operations/migration/ROLLBACK_RUNBOOK.md)               |
| Incident Response                     | Incident procedures                              | [docs/categories/platform-and-operations/ops/incident-response.md](categories/platform-and-operations/ops/incident-response.md)                         |
| On-Call                               | On-call playbook                                 | [docs/categories/platform-and-operations/ops/on-call.md](categories/platform-and-operations/ops/on-call.md)                                             |
| Disaster Recovery                     | DR playbooks                                     | [docs/categories/platform-and-operations/ops/disaster-recovery.md](categories/platform-and-operations/ops/disaster-recovery.md)                         |
| Staging Recovery                      | Staging recovery runbook                         | [docs/categories/platform-and-operations/ops/staging-recovery-runbook.md](categories/platform-and-operations/ops/staging-recovery-runbook.md)           |
| Environment Ops                       | Environment management                           | [docs/categories/platform-and-operations/ops/ENVIRONMENT_OPERATIONS.md](categories/platform-and-operations/ops/ENVIRONMENT_OPERATIONS.md)               |
| Ownership Registry                    | Who owns what                                    | [ops/ownership-registry.md](ops/ownership-registry.md)                                                                                                  |
| Repo Operator Runbook                 | Repo operations                                  | [docs/categories/platform-and-operations/ops/REPO_OPERATOR_RUNBOOK.md](categories/platform-and-operations/ops/REPO_OPERATOR_RUNBOOK.md)                 |
| SRE Dashboard                         | SRE reporting                                    | [ops/sre/](ops/sre/)                                                                                                                                    |
| FinOps                                | Cost management                                  | [ops/finops/](ops/finops/)                                                                                                                              |
| Staging Drift Runbook                 | Drift detection & fix                            | [docs/categories/platform-and-operations/ops/staging-runtime-drift-runbook.md](categories/platform-and-operations/ops/staging-runtime-drift-runbook.md) |
| Financial Service Governance Recovery | Governance blind-spot closure policy             | [ops/FINANCIAL_SERVICE_GOVERNANCE_RECOVERY.md](ops/FINANCIAL_SERVICE_GOVERNANCE_RECOVERY.md)                                                            |
| Financial Runtime Release Policy      | Required financial runtime release gates         | [ops/FINANCIAL_RUNTIME_RELEASE_POLICY.md](ops/FINANCIAL_RUNTIME_RELEASE_POLICY.md)                                                                      |
| Financial Service Release Checklist   | Release go/no-go checklist for financial-service | [ops/FINANCIAL_SERVICE_RELEASE_CHECKLIST.md](ops/FINANCIAL_SERVICE_RELEASE_CHECKLIST.md)                                                                |

## Buyers (Sales, Diligence)

| Document                  | Purpose                      | Location                                                                                                                              |
| ------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Portfolio Overview        | Product portfolio summary    | [docs/categories/stakeholders/buyers/PORTFOLIO_OVERVIEW.md](categories/stakeholders/buyers/PORTFOLIO_OVERVIEW.md)                     |
| Security Summary          | Security posture overview    | [docs/categories/stakeholders/buyers/SECURITY_SUMMARY.md](categories/stakeholders/buyers/SECURITY_SUMMARY.md)                         |
| Reliability Summary       | SRE & reliability overview   | [docs/categories/stakeholders/buyers/RELIABILITY_SUMMARY.md](categories/stakeholders/buyers/RELIABILITY_SUMMARY.md)                   |
| Operating Model           | How Nzila operates           | [docs/categories/stakeholders/buyers/OPERATING_MODEL.md](categories/stakeholders/buyers/OPERATING_MODEL.md)                           |
| Buyer FAQ                 | Common buyer questions       | [docs/categories/stakeholders/buyers/buyer-faq.md](categories/stakeholders/buyers/buyer-faq.md)                                       |
| SLA & Support Model       | Support tiers & SLAs         | [docs/categories/stakeholders/buyers/sla-support-model.md](categories/stakeholders/buyers/sla-support-model.md)                       |
| Deployment Models         | Hosting & deployment options | [docs/categories/stakeholders/buyers/deployment-models.md](categories/stakeholders/buyers/deployment-models.md)                       |
| Integration Readiness     | Integration capabilities     | [docs/categories/stakeholders/buyers/integration-readiness-matrix.md](categories/stakeholders/buyers/integration-readiness-matrix.md) |
| Pilot Readiness           | Pre-pilot checklist          | [docs/categories/stakeholders/buyers/pilot-readiness-checklist.md](categories/stakeholders/buyers/pilot-readiness-checklist.md)       |
| Product Capability Matrix | Feature comparison           | [docs/categories/stakeholders/buyers/product-capability-matrix.md](categories/stakeholders/buyers/product-capability-matrix.md)       |
| Union Eyes Buyer Pack     | UE-specific buyer pack       | [docs/categories/stakeholders/buyers/union-eyes-buyer-pack.md](categories/stakeholders/buyers/union-eyes-buyer-pack.md)               |
| Flow Buyer Pack           | Flow-specific buyer pack     | [docs/categories/stakeholders/buyers/flow-buyer-pack.md](categories/stakeholders/buyers/flow-buyer-pack.md)                           |
| FairCase Buyer Pack       | FairCase buyer pack          | [docs/categories/products-and-market/faircase/buyer-pack.md](categories/products-and-market/faircase/buyer-pack.md)                   |

## Security & Governance

| Document                  | Purpose                  | Location                                                                                                                                                                      |
| ------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security Policy           | Vulnerability disclosure | [SECURITY.md](../SECURITY.md)                                                                                                                                                 |
| Governance Architecture   | Governance system design | [docs/categories/platform-and-operations/governance/GOVERNANCE_ARCHITECTURE.md](categories/platform-and-operations/governance/GOVERNANCE_ARCHITECTURE.md)                     |
| Security Overview         | Security governance      | [docs/categories/platform-and-operations/governance/security-overview.md](categories/platform-and-operations/governance/security-overview.md)                                 |
| Threat Model              | Threat modeling          | [../governance/security/THREAT_MODEL.md](../governance/security/THREAT_MODEL.md)                                                                                              |
| Pentest Scope             | Penetration test scope   | [../governance/security/PENTEST_SCOPE.md](../governance/security/PENTEST_SCOPE.md)                                                                                            |
| Data Residency Policy     | Data residency rules     | [docs/categories/platform-and-operations/platform/DATA_RESIDENCY_POLICY.md](categories/platform-and-operations/platform/DATA_RESIDENCY_POLICY.md)                             |
| Vendor Risk Register      | Third-party risks        | [docs/categories/platform-and-operations/platform/THIRD_PARTY_RISK_REGISTER.md](categories/platform-and-operations/platform/THIRD_PARTY_RISK_REGISTER.md)                     |
| Secure Coding Training    | Secure dev practices     | [docs/categories/platform-and-operations/governance/secure-coding-training.md](categories/platform-and-operations/governance/secure-coding-training.md)                       |
| Audit Logging Model       | Audit trail design       | [docs/categories/platform-and-operations/governance/audit-logging-model.md](categories/platform-and-operations/governance/audit-logging-model.md)                             |
| Change Policy             | Change management        | [docs/categories/platform-and-operations/governance/CHANGE_POLICY.md](categories/platform-and-operations/governance/CHANGE_POLICY.md)                                         |
| Incident Response Summary | Incident procedures      | [docs/categories/platform-and-operations/governance/incident-response-summary.md](categories/platform-and-operations/governance/incident-response-summary.md)                 |
| Vendor Questionnaire      | Vendor assessment pack   | [docs/categories/platform-and-operations/governance/vendor-questionnaire-starter-pack.md](categories/platform-and-operations/governance/vendor-questionnaire-starter-pack.md) |
| Procurement Pack          | Procurement evidence     | [docs/categories/platform-and-operations/governance/procurement-pack.md](categories/platform-and-operations/governance/procurement-pack.md)                                   |
| Enterprise Readiness      | Enterprise checklist     | [docs/categories/platform-and-operations/governance/enterprise-readiness.md](categories/platform-and-operations/governance/enterprise-readiness.md)                           |

## Investors

| Document           | Purpose                 | Location                                                                                                                                      |
| ------------------ | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Investor One-Pager | Executive summary       | [docs/categories/stakeholders/investor/final-investor-onepager.md](categories/stakeholders/investor/final-investor-onepager.md)               |
| Growth Narrative   | 3-year growth story     | [docs/categories/stakeholders/investor/three-year-growth-narrative.md](categories/stakeholders/investor/three-year-growth-narrative.md)       |
| Revenue Scenarios  | Revenue projections     | [docs/categories/stakeholders/investor/revenue-scenarios.md](categories/stakeholders/investor/revenue-scenarios.md)                           |
| Moat Analysis      | Defensible moat         | [docs/categories/stakeholders/investor/defensible-moat-analysis.md](categories/stakeholders/investor/defensible-moat-analysis.md)             |
| Risk Register      | Risk & mitigations      | [docs/categories/stakeholders/investor/risk-register-and-mitigations.md](categories/stakeholders/investor/risk-register-and-mitigations.md)   |
| Platform Leverage  | Shared platform model   | [docs/categories/stakeholders/investor/shared-platform-leverage-model.md](categories/stakeholders/investor/shared-platform-leverage-model.md) |
| Product Expansion  | Expansion strategy      | [docs/categories/stakeholders/investor/product-expansion-strategy.md](categories/stakeholders/investor/product-expansion-strategy.md)         |
| Why Nzila Wins     | Competitive positioning | [docs/categories/stakeholders/investor/why-nzila-os-wins.md](categories/stakeholders/investor/why-nzila-os-wins.md)                           |

## Product-Specific

### Union Eyes

> Engineering and readiness authority is [union-eyes/README.md](union-eyes/README.md) and
> `apps/union-eyes/lib/reality/capability-registry.ts`. Current gate:
> `UE_SAAS_OPERATIONAL_READINESS = NO_GO — RUNTIME_PROOF_REQUIRED`. The user-facing guides below
> describe intended product behaviour and do not assert deployment or runtime verification.

| Document                                   | Location                                                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| README (engineering + readiness authority) | [union-eyes/README.md](union-eyes/README.md)                                                                                                |
| Admin Guide                                | [docs/categories/products-and-market/union-eyes/admin-guide.md](categories/products-and-market/union-eyes/admin-guide.md)                   |
| User Guide                                 | [docs/categories/products-and-market/union-eyes/user-guide.md](categories/products-and-market/union-eyes/user-guide.md)                     |
| Quick Start                                | [docs/categories/products-and-market/union-eyes/quick-start.md](categories/products-and-market/union-eyes/quick-start.md)                   |
| Case Intelligence                          | [docs/categories/products-and-market/union-eyes/case-intelligence.md](categories/products-and-market/union-eyes/case-intelligence.md)       |
| FAQ                                        | [docs/categories/products-and-market/union-eyes/faq.md](categories/products-and-market/union-eyes/faq.md)                                   |
| Pilot Overview                             | [docs/categories/products-and-market/union-eyes/pilot-overview.md](categories/products-and-market/union-eyes/pilot-overview.md)             |
| Integration Playbook                       | [docs/categories/products-and-market/union-eyes/integration-playbook.md](categories/products-and-market/union-eyes/integration-playbook.md) |

### CIVIC

> CIVIC is the second commercial lane: a cautious public-institution discovery and
> market-engagement posture, `tier 2 / hold / pre-revenue` in the catalog, with no pilot and no
> paying customer. `apps/civic/` intentionally contains no runtime code. Nothing below should be
> read as an offered product, assessment, or pilot.

| Document                                             | Location                                                                                                                                            |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| CIVIC ↔ OCI alignment (positioning authority)        | [CIVIC_OCI_ALIGNMENT.md](CIVIC_OCI_ALIGNMENT.md)                                                                                                    |
| OCI methodology canon                                | [oci/OCI_METHOD.md](oci/OCI_METHOD.md) · [oci/CANON.md](oci/CANON.md)                                                                               |
| OCI dispositions (superseded / premature / internal) | [oci/SUPERSEDED.md](oci/SUPERSEDED.md)                                                                                                              |
| CIVIC thesis and public-service framing              | [public-service/civic-thesis.md](public-service/civic-thesis.md) · [public-service/civic-one-page-brief.md](public-service/civic-one-page-brief.md) |
| CLEAR method (evidence discipline)                   | [public-service/clear-method-canonical.md](public-service/clear-method-canonical.md)                                                                |
| App placeholder + why it is empty                    | [../apps/civic/README.md](../apps/civic/README.md)                                                                                                  |

### FairCase (prior product framing)

> FairCase is the earlier tribunal-intelligence framing whose lineage now sits under CourtLens
> (`apps/abr`). These documents are retained as commercial lineage, not as a current product
> line. CourtLens posture is `tier 2 / hold` in the portfolio catalog.

| Document             | Location                                                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Executive Summary    | [docs/categories/products-and-market/faircase/executive-summary.md](categories/products-and-market/faircase/executive-summary.md)       |
| Buyer Pack           | [docs/categories/products-and-market/faircase/buyer-pack.md](categories/products-and-market/faircase/buyer-pack.md)                     |
| Demo Script          | [docs/categories/products-and-market/faircase/demo-script.md](categories/products-and-market/faircase/demo-script.md)                   |
| Pilot Plan           | [docs/categories/products-and-market/faircase/pilot-plan.md](categories/products-and-market/faircase/pilot-plan.md)                     |
| Pricing Model        | [docs/categories/products-and-market/faircase/pricing-model.md](categories/products-and-market/faircase/pricing-model.md)               |
| Implementation Guide | [docs/categories/products-and-market/faircase/implementation-guide.md](categories/products-and-market/faircase/implementation-guide.md) |
| Security One-Pager   | [docs/categories/products-and-market/faircase/security-one-pager.md](categories/products-and-market/faircase/security-one-pager.md)     |
| ROI Calculator       | [docs/categories/products-and-market/faircase/roi-calculator.md](categories/products-and-market/faircase/roi-calculator.md)             |

### Flow

| Document        | Location                                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| Revenue Profile | [docs/categories/products-and-market/flow/revenue-profile.md](categories/products-and-market/flow/revenue-profile.md) |
| Buyer Pack      | [docs/categories/stakeholders/buyers/flow-buyer-pack.md](categories/stakeholders/buyers/flow-buyer-pack.md)           |

### Agrimo / Agri

| Document                | Location                                                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview                | [docs/categories/products-and-market/agri/00-overview.md](categories/products-and-market/agri/00-overview.md)                                   |
| Architecture            | [docs/categories/products-and-market/agri/02-architecture.md](categories/products-and-market/agri/02-architecture.md)                           |
| Data Model              | [docs/categories/products-and-market/agri/03-data-model.md](categories/products-and-market/agri/03-data-model.md)                               |
| Security & Isolation    | [docs/categories/products-and-market/agri/05-security-and-isolation.md](categories/products-and-market/agri/05-security-and-isolation.md)       |
| Evidence & Traceability | [docs/categories/products-and-market/agri/06-evidence-and-traceability.md](categories/products-and-market/agri/06-evidence-and-traceability.md) |

### Zonga

| Document       | Location         |
| -------------- | ---------------- |
| Docs directory | [zonga/](zonga/) |

## Platform Reference

| Document                 | Purpose                | Location                                                                                                                                                |
| ------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What is Nzila            | Platform overview      | [docs/categories/platform-and-operations/platform/what-is-nzila.md](categories/platform-and-operations/platform/what-is-nzila.md)                       |
| Portfolio Matrix         | Product matrix         | [platform/portfolio-matrix.md](platform/portfolio-matrix.md)                                                                                            |
| Platform Operating Model | How the platform works | [docs/categories/platform-and-operations/platform/PLATFORM_OPERATING_MODEL.md](categories/platform-and-operations/platform/PLATFORM_OPERATING_MODEL.md) |
| Shared Services          | Shared service catalog | [docs/categories/platform-and-operations/platform/SHARED_SERVICES.md](categories/platform-and-operations/platform/SHARED_SERVICES.md)                   |
| App Lifecycle Process    | App lifecycle rules    | [docs/categories/platform-and-operations/platform/APP_LIFECYCLE_PROCESS.md](categories/platform-and-operations/platform/APP_LIFECYCLE_PROCESS.md)       |
| Onboarding               | Platform onboarding    | [docs/categories/platform-and-operations/platform/ONBOARDING.md](categories/platform-and-operations/platform/ONBOARDING.md)                             |
| Package Ownership Matrix | Package owners         | [docs/categories/platform-and-operations/platform/PACKAGE_OWNERSHIP_MATRIX.md](categories/platform-and-operations/platform/PACKAGE_OWNERSHIP_MATRIX.md) |
| Command Catalog          | All commands           | [docs/categories/platform-and-operations/platform/COMMAND_CATALOG.md](categories/platform-and-operations/platform/COMMAND_CATALOG.md)                   |
| Coverage Reporting       | Test coverage          | [docs/categories/platform-and-operations/platform/COVERAGE_REPORTING.md](categories/platform-and-operations/platform/COVERAGE_REPORTING.md)             |

## Proof Center

| Document              | Location                                                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Portfolio Proof Index | [proof-center/portfolio-proof-index.md](proof-center/portfolio-proof-index.md)                                                          |
| Union Eyes Proof      | [docs/categories/products-and-market/proof-center/union-eyes-proof.md](categories/products-and-market/proof-center/union-eyes-proof.md) |
| Flow Proof            | [docs/categories/products-and-market/proof-center/flow-proof.md](categories/products-and-market/proof-center/flow-proof.md)             |

## Completed programme records

The `docs/nzila-*` trees (tier-2 hardening, residual closure, sovereignty proving, runtime
integrity, infrastructure convergence, finalization, field operations, live audit, operational
proving, rollout governance, tier-3 operating infrastructure) are **programme records**: each
documents a named convergence programme and its evidence at the time it ran. Several are still
read by validators (`pnpm validate:tier2-hardening`, `validate:residual-closure`,
`validate:sovereignty-proving`, `validate:runtime-integrity`, `validate:infra-convergence`,
`validate:final-convergence`, `field-ops:validate`), so they stay in place rather than moving to
the archive.

They are not a substitute for current authority. For current platform state read
[../ARCHITECTURE.md](../ARCHITECTURE.md); for current product posture read the portfolio
catalog; for current Union Eyes readiness read [union-eyes/README.md](union-eyes/README.md).
A `PASS` recorded inside a programme record is evidence about that programme run, not a
statement about today's runtime.

---

_Hand-maintained. The generated exhaustive listing is [documentation-index.md](documentation-index.md),
produced by `pnpm docs:index` (`scripts/docs/build-docs-index.ts`)._
