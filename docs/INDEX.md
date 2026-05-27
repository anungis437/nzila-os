# Documentation Index

Complete index of all documentation in Nzila OS, organized by audience.

> Historical planning and iteration docs have been moved to [archive/iterations](archive/iterations/).
> Keep this index focused on active, maintained documentation.

## Category-First Navigation

| Category | Purpose | Location |
|----------|---------|----------|
| Stakeholders | Audience-first docs (builders, operators, buyers, investors) | [categories/stakeholders/README.md](categories/stakeholders/README.md) |
| Platform & Operations | Architecture, platform, governance, runtime ops | [categories/platform-and-operations/README.md](categories/platform-and-operations/README.md) |
| Products & Market | Product surfaces, pilots, commercial and GTM docs | [categories/products-and-market/README.md](categories/products-and-market/README.md) |
| Historical Archive | Archived iterations and historical reference | [categories/historical-archive/README.md](categories/historical-archive/README.md) |

## Builders (Engineering)

| Document | Purpose | Location |
|----------|---------|----------|
| Quick Start | 5-minute setup guide | [docs/builders/QUICKSTART.md](builders/QUICKSTART.md) |
| Contributing | How to contribute | [docs/builders/CONTRIBUTING.md](builders/CONTRIBUTING.md) |
| Commands | Full command reference | [docs/builders/COMMANDS.md](builders/COMMANDS.md) |
| Architecture Map | Repo structure & layers | [docs/builders/ARCHITECTURE_MAP.md](builders/ARCHITECTURE_MAP.md) |
| Architecture (Full) | Technical architecture | [ARCHITECTURE.md](../ARCHITECTURE.md) |
| Golden Path Guide | Developer golden path | [GOLDEN_PATH_DEVELOPER_GUIDE.md](GOLDEN_PATH_DEVELOPER_GUIDE.md) |
| Platform Boundaries | App vs platform rules | [platform/platform-boundaries.md](platform/platform-boundaries.md) |
| When to Use Platform | Platform package guide | [platform/WHEN_TO_USE_PLATFORM_PACKAGES.md](platform/WHEN_TO_USE_PLATFORM_PACKAGES.md) |
| Shell Architecture | App shell model | [platform/SHELL_ARCHITECTURE.md](platform/SHELL_ARCHITECTURE.md) |
| Auth Migration | Auth system notes | [platform/auth-migration-architecture.md](platform/auth-migration-architecture.md) |
| Contracts | Platform contracts | [platform/CONTRACTS.md](platform/CONTRACTS.md) |

## Operators (Release, SRE, Incidents)

| Document | Purpose | Location |
|----------|---------|----------|
| Deployment Model | Staging → prod promotion | [ops/DEPLOYMENT_PROMOTION_MODEL.md](ops/DEPLOYMENT_PROMOTION_MODEL.md) |
| Release Governance | Release process & gates | [ops/release-governance/](ops/release-governance/) |
| Rollback Runbook | How to rollback | [migration/ROLLBACK_RUNBOOK.md](migration/ROLLBACK_RUNBOOK.md) |
| Incident Response | Incident procedures | [ops/incident-response.md](ops/incident-response.md) |
| On-Call | On-call playbook | [ops/on-call.md](ops/on-call.md) |
| Disaster Recovery | DR playbooks | [ops/disaster-recovery.md](ops/disaster-recovery.md) |
| Staging Recovery | Staging recovery runbook | [ops/staging-recovery-runbook.md](ops/staging-recovery-runbook.md) |
| Environment Ops | Environment management | [ops/ENVIRONMENT_OPERATIONS.md](ops/ENVIRONMENT_OPERATIONS.md) |
| Ownership Registry | Who owns what | [ops/ownership-registry.md](ops/ownership-registry.md) |
| Repo Operator Runbook | Repo operations | [ops/REPO_OPERATOR_RUNBOOK.md](ops/REPO_OPERATOR_RUNBOOK.md) |
| SRE Dashboard | SRE reporting | [ops/sre/](ops/sre/) |
| FinOps | Cost management | [ops/finops/](ops/finops/) |
| Staging Drift Runbook | Drift detection & fix | [ops/staging-runtime-drift-runbook.md](ops/staging-runtime-drift-runbook.md) |
| Financial Service Governance Recovery | Governance blind-spot closure policy | [ops/FINANCIAL_SERVICE_GOVERNANCE_RECOVERY.md](ops/FINANCIAL_SERVICE_GOVERNANCE_RECOVERY.md) |
| Financial Runtime Release Policy | Required financial runtime release gates | [ops/FINANCIAL_RUNTIME_RELEASE_POLICY.md](ops/FINANCIAL_RUNTIME_RELEASE_POLICY.md) |
| Financial Service Release Checklist | Release go/no-go checklist for financial-service | [ops/FINANCIAL_SERVICE_RELEASE_CHECKLIST.md](ops/FINANCIAL_SERVICE_RELEASE_CHECKLIST.md) |

## Buyers (Sales, Diligence)

| Document | Purpose | Location |
|----------|---------|----------|
| Portfolio Overview | Product portfolio summary | [buyers/PORTFOLIO_OVERVIEW.md](buyers/PORTFOLIO_OVERVIEW.md) |
| Security Summary | Security posture overview | [buyers/SECURITY_SUMMARY.md](buyers/SECURITY_SUMMARY.md) |
| Reliability Summary | SRE & reliability overview | [buyers/RELIABILITY_SUMMARY.md](buyers/RELIABILITY_SUMMARY.md) |
| Operating Model | How Nzila operates | [buyers/OPERATING_MODEL.md](buyers/OPERATING_MODEL.md) |
| Buyer FAQ | Common buyer questions | [buyers/buyer-faq.md](buyers/buyer-faq.md) |
| SLA & Support Model | Support tiers & SLAs | [buyers/sla-support-model.md](buyers/sla-support-model.md) |
| Deployment Models | Hosting & deployment options | [buyers/deployment-models.md](buyers/deployment-models.md) |
| Integration Readiness | Integration capabilities | [buyers/integration-readiness-matrix.md](buyers/integration-readiness-matrix.md) |
| Pilot Readiness | Pre-pilot checklist | [buyers/pilot-readiness-checklist.md](buyers/pilot-readiness-checklist.md) |
| Product Capability Matrix | Feature comparison | [buyers/product-capability-matrix.md](buyers/product-capability-matrix.md) |
| Union Eyes Buyer Pack | UE-specific buyer pack | [buyers/union-eyes-buyer-pack.md](buyers/union-eyes-buyer-pack.md) |
| Flow Buyer Pack | Flow-specific buyer pack | [buyers/flow-buyer-pack.md](buyers/flow-buyer-pack.md) |
| FairCase Buyer Pack | FairCase buyer pack | [faircase/buyer-pack.md](faircase/buyer-pack.md) |

## Security & Governance

| Document | Purpose | Location |
|----------|---------|----------|
| Security Policy | Vulnerability disclosure | [SECURITY.md](../SECURITY.md) |
| Governance Architecture | Governance system design | [governance/GOVERNANCE_ARCHITECTURE.md](governance/GOVERNANCE_ARCHITECTURE.md) |
| Security Overview | Security governance | [governance/security-overview.md](governance/security-overview.md) |
| Threat Model | Threat modeling | [../governance/security/THREAT_MODEL.md](../governance/security/THREAT_MODEL.md) |
| Pentest Scope | Penetration test scope | [../governance/security/PENTEST_SCOPE.md](../governance/security/PENTEST_SCOPE.md) |
| Data Residency Policy | Data residency rules | [platform/DATA_RESIDENCY_POLICY.md](platform/DATA_RESIDENCY_POLICY.md) |
| Vendor Risk Register | Third-party risks | [platform/THIRD_PARTY_RISK_REGISTER.md](platform/THIRD_PARTY_RISK_REGISTER.md) |
| Secure Coding Training | Secure dev practices | [governance/secure-coding-training.md](governance/secure-coding-training.md) |
| Audit Logging Model | Audit trail design | [governance/audit-logging-model.md](governance/audit-logging-model.md) |
| Change Policy | Change management | [governance/CHANGE_POLICY.md](governance/CHANGE_POLICY.md) |
| Incident Response Summary | Incident procedures | [governance/incident-response-summary.md](governance/incident-response-summary.md) |
| Vendor Questionnaire | Vendor assessment pack | [governance/vendor-questionnaire-starter-pack.md](governance/vendor-questionnaire-starter-pack.md) |
| Procurement Pack | Procurement evidence | [governance/procurement-pack.md](governance/procurement-pack.md) |
| Enterprise Readiness | Enterprise checklist | [governance/enterprise-readiness.md](governance/enterprise-readiness.md) |

## Investors

| Document | Purpose | Location |
|----------|---------|----------|
| Investor One-Pager | Executive summary | [investor/final-investor-onepager.md](investor/final-investor-onepager.md) |
| Growth Narrative | 3-year growth story | [investor/three-year-growth-narrative.md](investor/three-year-growth-narrative.md) |
| Revenue Scenarios | Revenue projections | [investor/revenue-scenarios.md](investor/revenue-scenarios.md) |
| Moat Analysis | Defensible moat | [investor/defensible-moat-analysis.md](investor/defensible-moat-analysis.md) |
| Risk Register | Risk & mitigations | [investor/risk-register-and-mitigations.md](investor/risk-register-and-mitigations.md) |
| Platform Leverage | Shared platform model | [investor/shared-platform-leverage-model.md](investor/shared-platform-leverage-model.md) |
| Product Expansion | Expansion strategy | [investor/product-expansion-strategy.md](investor/product-expansion-strategy.md) |
| Why Nzila Wins | Competitive positioning | [investor/why-nzila-os-wins.md](investor/why-nzila-os-wins.md) |

## Product-Specific

### Union Eyes

| Document | Location |
|----------|----------|
| README | [union-eyes/README.md](union-eyes/README.md) |
| Admin Guide | [union-eyes/admin-guide.md](union-eyes/admin-guide.md) |
| User Guide | [union-eyes/user-guide.md](union-eyes/user-guide.md) |
| Quick Start | [union-eyes/quick-start.md](union-eyes/quick-start.md) |
| Case Intelligence | [union-eyes/case-intelligence.md](union-eyes/case-intelligence.md) |
| FAQ | [union-eyes/faq.md](union-eyes/faq.md) |
| Pilot Overview | [union-eyes/pilot-overview.md](union-eyes/pilot-overview.md) |
| Integration Playbook | [union-eyes/integration-playbook.md](union-eyes/integration-playbook.md) |

### FairCase

| Document | Location |
|----------|----------|
| Executive Summary | [faircase/executive-summary.md](faircase/executive-summary.md) |
| Buyer Pack | [faircase/buyer-pack.md](faircase/buyer-pack.md) |
| Demo Script | [faircase/demo-script.md](faircase/demo-script.md) |
| Pilot Plan | [faircase/pilot-plan.md](faircase/pilot-plan.md) |
| Pricing Model | [faircase/pricing-model.md](faircase/pricing-model.md) |
| Implementation Guide | [faircase/implementation-guide.md](faircase/implementation-guide.md) |
| Security One-Pager | [faircase/security-one-pager.md](faircase/security-one-pager.md) |
| ROI Calculator | [faircase/roi-calculator.md](faircase/roi-calculator.md) |

### Flow

| Document | Location |
|----------|----------|
| Revenue Profile | [flow/revenue-profile.md](flow/revenue-profile.md) |
| Buyer Pack | [buyers/flow-buyer-pack.md](buyers/flow-buyer-pack.md) |

### Agrimo / Agri

| Document | Location |
|----------|----------|
| Overview | [agri/00-overview.md](agri/00-overview.md) |
| Architecture | [agri/02-architecture.md](agri/02-architecture.md) |
| Data Model | [agri/03-data-model.md](agri/03-data-model.md) |
| Security & Isolation | [agri/05-security-and-isolation.md](agri/05-security-and-isolation.md) |
| Evidence & Traceability | [agri/06-evidence-and-traceability.md](agri/06-evidence-and-traceability.md) |

### Zonga

| Document | Location |
|----------|----------|
| Docs directory | [zonga/](zonga/) |

## Platform Reference

| Document | Purpose | Location |
|----------|---------|----------|
| What is Nzila | Platform overview | [platform/what-is-nzila.md](platform/what-is-nzila.md) |
| Portfolio Matrix | Product matrix | [platform/portfolio-matrix.md](platform/portfolio-matrix.md) |
| Platform Operating Model | How the platform works | [platform/PLATFORM_OPERATING_MODEL.md](platform/PLATFORM_OPERATING_MODEL.md) |
| Shared Services | Shared service catalog | [platform/SHARED_SERVICES.md](platform/SHARED_SERVICES.md) |
| App Lifecycle Process | App lifecycle rules | [platform/APP_LIFECYCLE_PROCESS.md](platform/APP_LIFECYCLE_PROCESS.md) |
| Onboarding | Platform onboarding | [platform/ONBOARDING.md](platform/ONBOARDING.md) |
| Package Ownership Matrix | Package owners | [platform/PACKAGE_OWNERSHIP_MATRIX.md](platform/PACKAGE_OWNERSHIP_MATRIX.md) |
| Command Catalog | All commands | [platform/COMMAND_CATALOG.md](platform/COMMAND_CATALOG.md) |
| Coverage Reporting | Test coverage | [platform/COVERAGE_REPORTING.md](platform/COVERAGE_REPORTING.md) |

## Proof Center

| Document | Location |
|----------|----------|
| Portfolio Proof Index | [proof-center/portfolio-proof-index.md](proof-center/portfolio-proof-index.md) |
| Union Eyes Proof | [proof-center/union-eyes-proof.md](proof-center/union-eyes-proof.md) |
| Flow Proof | [proof-center/flow-proof.md](proof-center/flow-proof.md) |

---

*This index is generated by `pnpm exec tsx scripts/docs/build-docs-index.ts`. Last updated: 2026-04-20.*
