# Nzila OS Documentation

Welcome to the Nzila OS documentation. This documentation follows the
[Diátaxis framework](https://diataxis.fr/) — four distinct types of documentation,
each serving a different user need.

---

## Documentation Map

### [Tutorials](tutorials/README.md)

**Learning-oriented** — Walk through practical exercises to get started.

| Tutorial | Audience | Time |
|----------|----------|------|
| [Your First App](tutorials/first-app.md) | New developer | 15 min |
| [Adding AI to an App](tutorials/adding-ai.md) | Developer | 20 min |

### [How-To Guides](how-to/README.md)

**Task-oriented** — Step-by-step instructions for specific goals.

| Guide | Category |
|-------|----------|
| [Rotate Secrets](how-to/rotate-secrets.md) | Security |
| [Create Model Card](how-to/create-model-card.md) | AI Governance |

### [Reference](reference/README.md)

**Information-oriented** — Technical descriptions of the system.

| Reference | Scope |
|-----------|-------|
| [Package Catalogue](reference/packages.md) | All packages |

### [Explanation](explanation/README.md)

**Understanding-oriented** — Discuss concepts and design decisions.

| Topic | Domain |
|-------|--------|
| [Why Evidence-First](explanation/evidence-first.md) | Architecture |
| [AI Risk Management](explanation/ai-risk-management.md) | AI Governance |

### [Runbooks](../ops/runbooks/README.md)

**Operational** — Incident response and operational procedures.

All runbooks are consolidated in [`ops/runbooks/`](../ops/runbooks/):

| Category | Location | Contents |
|----------|----------|----------|
| Platform incidents | [`ops/runbooks/platform/`](../ops/runbooks/platform/) | Orchestrator, integration, AI, event fabric, observability failures, secret compromise, SLO breach |
| Numbered procedures | [`ops/runbooks/numbered/`](../ops/runbooks/numbered/) | DB pool exhaustion, DLQ backlog, provider outage, latency regression, error rate, org isolation, deployment failure, cert/secret expiry, hash chain integrity |
| Commerce | [`ops/runbooks/commerce/`](../ops/runbooks/commerce/) | Audit gap, evidence pack, governance override, org isolation, saga compensation, stuck state |
| Security | [`ops/runbooks/security/`](../ops/runbooks/security/) | Data breach, key rotation |

---

## Architecture

System design, boundaries, and technical strategy.

| Document | Topic |
|----------|-------|
| [ARCHITECTURE.md](../ARCHITECTURE.md) | System architecture overview (root) |
| [Architectural Layers](architecture/ARCHITECTURAL_LAYERS.md) | 4-layer model |
| [Architectural Boundaries](architecture/ARCHITECTURAL_BOUNDARIES.md) | Layer boundary rules |
| [Control Plane Architecture](architecture/CONTROL_PLANE_ARCHITECTURE.md) | Control plane design |
| [Control Plane Principles](architecture/CONTROL_PLANE_PRINCIPLES.md) | Control plane tenets |
| [Decision Layer Architecture](architecture/DECISION_LAYER_ARCHITECTURE.md) | Decision engine |
| [AI Intelligence Layer](architecture/AI_INTELLIGENCE_LAYER.md) | AI subsystem design |
| [AI Platform Contract](architecture/AI_PLATFORM_CONTRACT.md) | AI platform boundaries |
| [Environment Architecture](architecture/ENVIRONMENT_ARCHITECTURE.md) | Env model |
| [Domain vs Audit Model](architecture/DOMAIN_VS_AUDIT_MODEL.md) | Separation of concerns |
| [Policy Engine](architecture/policy-engine.md) | RBAC & zero-trust |
| [Stack Authority](architecture/STACK_AUTHORITY.md) | Technology authority |
| [Stack Fragmentation Matrix](architecture/STACK_FRAGMENTATION_MATRIX.md) | Tech debt tracking |
| [Org Isolation](architecture/ORG_ISOLATION.md) | Multi-org isolation |
| [Org-Scoped Tables](architecture/ORG_SCOPED_TABLES.md) | Data isolation |
| [Polyglot Persistence](architecture/POLYGLOT_PERSISTENCE.md) | Data layer strategy |
| [Evidence Lifecycle](architecture/EVIDENCE_LIFECYCLE.md) | Audit evidence model |
| [Platform Event Bus](architecture/platform-event-bus.md) | Event-driven architecture |
| [Observability](architecture/observability.md) | Monitoring & tracing |
| [Integration Control Plane](architecture/integration-control-plane.md) | Integration layer |
| [Vertical Scaffolding](architecture/VERTICAL_SCAFFOLDING.md) | Vertical app patterns |
| [Build Strategy](architecture/build-strategy.md) | Monorepo build approach |
| [Multi-Product Operating Architecture](architecture/multi-product-operating-architecture.md) | Operating model |
| [CTO Technical Strategy](architecture/tools-nzila-cto-technical-strategy-summary.md) | Strategy summary |
| [Innovation & Future Tech](architecture/innovation-future-tech-investments-strategy.md) | R&D investments |

## Governance

Policy, compliance, lifecycle management, and decision frameworks.

| Document | Topic |
|----------|-------|
| [Governance Architecture](governance/GOVERNANCE_ARCHITECTURE.md) | Governance overview |
| [App Gold Standard](governance/APP_GOLD_STANDARD.md) | App quality bar |
| [App Lifecycle Matrix](governance/APP_LIFECYCLE_MATRIX.md) | Tier classification |
| [Package Lifecycle Policy](governance/PACKAGE_LIFECYCLE_POLICY.md) | Package management |
| [Package Ownership](governance/PACKAGE_OWNERSHIP.md) | Ownership model |
| [Platform Surface Responsibilities](governance/PLATFORM_SURFACE_RESPONSIBILITIES.md) | Surface boundaries |
| [Platform vs App Decision Rule](governance/PLATFORM_VS_APP_DECISION_RULE.md) | Classification framework |
| [Change Policy](governance/CHANGE_POLICY.md) | Change management |
| [Change Calendar Model](governance/CHANGE_CALENDAR_MODEL.md) | Release cadence |
| [Change Enablement Architecture](governance/CHANGE_ENABLEMENT_ARCHITECTURE.md) | Change enablement |
| [Decision Policy Model](governance/DECISION_POLICY_MODEL.md) | Decision framework |
| [Decision Review Workflow](governance/DECISION_REVIEW_WORKFLOW.md) | Review process |
| [Contracts](governance/contracts.md) | Contract testing |
| [Assurance Dashboard](governance/assurance-dashboard.md) | Compliance dashboard |
| [Enterprise Readiness](governance/enterprise-readiness.md) | Enterprise checklist |
| [Platform Readiness](governance/platform-readiness.md) | Platform GA readiness |
| [Procurement Evidence System](governance/PROCUREMENT_EVIDENCE_SYSTEM.md) | Evidence generation |
| [Procurement Pack](governance/procurement-pack.md) | Procurement artifacts |
| [RFP Generator](governance/rfp-generator.md) | RFP response system |
| [Architecture Governance Index](architecture/ARCHITECTURE_GOVERNANCE_INDEX.md) | Governance index |

## Operations

Deployment, incident response, and operational procedures.

| Document | Topic |
|----------|-------|
| [Deployment Promotion Model](ops/DEPLOYMENT_PROMOTION_MODEL.md) | Promotion pipeline |
| [Environment Operations](ops/ENVIRONMENT_OPERATIONS.md) | Env management |
| [Disaster Recovery](ops/disaster-recovery.md) | DR plan |
| [Incident Response](ops/incident-response.md) | Incident playbook |
| [On-Call](ops/on-call.md) | On-call procedures |
| [Deploy Profiles](deploy/profiles.md) | Deployment profiles |

## SaaS & Platform Strategy

| Document | Topic |
|----------|-------|
| [SaaS Enablement Architecture](architecture/SAAS_ENABLEMENT_ARCHITECTURE.md) | Multi-tenant SaaS strategy |
| [Monetization Architecture](architecture/MONETIZATION_ARCHITECTURE.md) | Revenue model design |
| [Platform Surface Model](platform/PLATFORM_SURFACE_MODEL.md) | Operating shell: Control Plane, Console, Admin |
| [Org Commerce Configuration](commerce/ORG_COMMERCE_CONFIGURATION.md) | Per-org billing & commerce setup |
| [Commercial Integration Report](commerce/COMMERCIAL_INTEGRATION_REPORT.md) | Integration status |
| [App Domain Core Standard](architecture/APP_DOMAIN_CORE_STANDARD.md) | Internal app architecture pattern |
| [Golden Path Developer Guide](how-to/GOLDEN_PATH_DEVELOPER_GUIDE.md) | Developer onboarding |
| [Multi-Org Demo Flow](tutorials/MULTI_ORG_DEMO_FLOW.md) | Demo walkthrough |
| [Union Eyes Current State](reference/UNION_EYES_CURRENT_STATE.md) | UE progress & status |
| [Repo Operator Runbook](ops/REPO_OPERATOR_RUNBOOK.md) | Repository operations |

## CUPE Pilot

| Document | Topic |
|----------|-------|
| [Quick Start](pilot/cupe/CUPE_PILOTING_QUICK_START.md) | Getting started |
| [Readiness Checklist](pilot/cupe/CUPE_READINESS_CHECKLIST.md) | Pre-launch validation |
| [RBAC Matrix](pilot/cupe/CUPE_RBAC_MATRIX.md) | Role assignments |
| [Admin Runbook](pilot/cupe/CUPE_PILOT_ADMIN_RUNBOOK.md) | Admin procedures |
| [User Guide](pilot/cupe/CUPE_PILOT_USER_GUIDE.md) | End-user guide |
| [Support SOP](pilot/cupe/CUPE_PILOT_SUPPORT_SOP.md) | Support procedures |
| [Go/No-Go Review](pilot/cupe/CUPE_PILOT_GO_NO_GO_REVIEW.md) | Launch gate review |
| [Rollback Runbook](pilot/cupe/CUPE_PILOT_ROLLBACK_RUNBOOK.md) | Rollback procedures |
| [Malware Control Boundary](pilot/cupe/CUPE_MALWARE_CONTROL_BOUNDARY.md) | Security boundary |

## Domain-Specific Documentation

### [Decision Layer](decision-layer/OVERVIEW.md)

AI decision engine capabilities, value models, and vertical implementations.

| Document | Topic |
|----------|-------|
| [Overview](decision-layer/OVERVIEW.md) | Architecture & design |
| [Capabilities](decision-layer/CAPABILITIES.md) | Engine features |
| [Governance & Safety](decision-layer/GOVERNANCE_AND_SAFETY.md) | AI guardrails |
| [Value Model](decision-layer/VALUE_MODEL.md) | Value framework |
| Verticals | [Agri Trade](decision-layer/verticals/agri-trade.md) · [Assessments](decision-layer/verticals/assessments.md) · [Unions](decision-layer/verticals/unions.md) |
| Pilots | [Agri Trade](decision-layer/pilots/agri-trade-pilot.md) · [Assessments](decision-layer/pilots/assessments-pilot.md) · [Unions](decision-layer/pilots/unions-pilot.md) |
| Demos | [Agri Trade](decision-layer/demos/agri-trade-demo.md) · [Assessments](decision-layer/demos/assessments-demo.md) · [Unions](decision-layer/demos/unions-demo.md) |

### [Commerce](commerce/README.md)

| Document | Topic |
|----------|-------|
| [Legacy Review](commerce/LEGACY_REVIEW.md) | Legacy assessment |
| [Domain Model Draft](commerce/DOMAIN_MODEL_DRAFT.md) | Commerce domain model |
| [IRAP Technical Design](commerce/IRAP_TECHNICAL_DESIGN.md) | IRAP architecture |
| [ADRs](commerce/ADR/README.md) | Architecture decision records |
| [MEIE Deliverables](commerce/meie/WP_DELIVERABLES.md) | Work package deliverables |

### [Hardening](hardening/BASELINE.md)

| Document | Topic |
|----------|-------|
| [Baseline](hardening/BASELINE.md) | Security baseline |
| [Security Posture](hardening/SECURITY_POSTURE.md) | Current posture |
| [Guard Architecture](hardening/GUARD_ARCHITECTURE.md) | Guard layers |
| [Invariants Reference](hardening/INVARIANTS_REFERENCE.md) | System invariants |
| [Audit Trail Schema](hardening/AUDIT_TRAIL_SCHEMA.md) | Audit data model |
| [Observability Dashboard](hardening/OBSERVABILITY_DASHBOARD.md) | Monitoring setup |
| [Proof Report](hardening/PROOF_REPORT.md) | Proof of compliance |
| [Critical Operations Matrix](hardening/CRITICAL_OPERATIONS_MATRIX.md) | Critical ops map |
| [Deployment Checklist](hardening/DEPLOYMENT_CHECKLIST.md) | Deploy validation |
| [Chaos & Load Test Plan](hardening/CHAOS_LOAD_TEST_PLAN.md) | Resilience testing |

### [Migration](migration/)

| Document | Topic |
|----------|-------|
| [Rollback Runbook](migration/ROLLBACK_RUNBOOK.md) | Rollback procedures |
| [Enforcement Upgrade](migration/ENFORCEMENT_UPGRADE.md) | Enforcement migration |
| App Alignment | [Union-Eyes](migration/app-alignment/union-eyes.md) · [ABR](migration/app-alignment/abr.md) · [Cora](migration/app-alignment/cora.md) · [3CUO](migration/app-alignment/3cuo.md) |
| Trade | [Deliverables](migration/trade/TRADE-DELIVERABLES.md) · [Domain Map](migration/trade/canonical-domain-map.md) |

### [Pilot](pilot/)

| Document | Topic |
|----------|-------|
| [Scope Checklist](pilot/01-scope-checklist.md) | Pilot scope |
| [Data Onboarding](pilot/02-data-onboarding.md) | Data migration |
| [Security & Privacy](pilot/03-security-privacy-packet.md) | Privacy packet |
| [Monitoring & SLOs](pilot/04-monitoring-and-slos.md) | Observability |
| [Demo Script](pilot/05-demo-script.md) | Demo walkthrough |

### [Stress Test](stress-test/)

| Document | Topic |
|----------|-------|
| [Enterprise Stress Test](stress-test/ENTERPRISE_STRESS_TEST.md) | Full stress test |
| [One-Week Sprint](stress-test/ONE_WEEK_SPRINT.md) | Sprint plan |
| [Remediation Plan](stress-test/REMEDIATION_PLAN.md) | Fix plan |
| [Evidence Index](stress-test/EVIDENCE_INDEX.md) | Evidence artifacts |

### [GA](ga/)

| Document | Topic |
|----------|-------|
| [GA Readiness Gate](ga/GA_READINESS_GATE.md) | Launch gate criteria |
| [GA Certification Report](ga/GA_CERTIFICATION_REPORT.md) | Certification status |

### [Platform](platform/)

| Document | Topic |
|----------|-------|
| [GA Readiness](platform/GA_READINESS.md) | Platform readiness |
| [App Adoption Guide](platform/APP_ADOPTION_GUIDE.md) | Platform onboarding |
| [Acceptance Matrix](platform/acceptance-matrix.md) | Feature acceptance |
| [Runtime Classification](platform/runtime-classification.md) | Runtime tiers |
| [Platform Boundaries](platform/platform-boundaries.md) | Boundary rules |
| [Proof Overview](platform/proof/README.md) | Proof system |

### [Risk](risk/)

| Document | Topic |
|----------|-------|
| [AI Risk Register](risk/nzila-ai-risk-register.md) | Risk catalogue |
| [Memora Deferred Items](risk/nzila-ai-risk-register-memora-deferred.md) | Deferred risks |

### [Repo Contract](repo-contract/)

| Document | Topic |
|----------|-------|
| [Invariants](repo-contract/invariants.md) | Structural contracts |
| [Versioning](repo-contract/versioning.md) | Versioning policy |

### [Plans](plans/)

| Document | Topic |
|----------|-------|
| [Implementation Plan](plans/IMPLEMENTATION_PLAN_FINAL.md) | Final implementation roadmap |
| [Repo Assessment](plans/REPO_ASSESSMENT.md) | Repository maturity assessment |
| [UE/ABR Flagship Refactor](plans/UE_ABR_FLAGSHIP_REFACTOR_PLAN.md) | Union-Eyes & ABR refactor |
| [Partner App Validation](plans/partner-app-validation.md) | Partner app validation plan |
| [Studio Maturity](plans/studio-maturity-10-of-10.md) | Studio maturity scorecard |
| [Probabilistic Cardinality](plans/probabilistic-cardinality-replicability-plan.md) | Replicability plan |

### [Agri](agri/)

Agricultural vertical specification (modules 00–08).

### [Backlog](backlog/)

Active backlog items and technical debt.

---

## Canonical Root Documents

| Document | Topic |
|----------|-------|
| [ARCHITECTURE.md](../ARCHITECTURE.md) | System architecture overview |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Contribution guidelines |
| [SECURITY.md](../SECURITY.md) | Security policy |
| [CHANGELOG.md](../CHANGELOG.md) | Release history |
| [README.business.md](../README.business.md) | Business context |
| [TENANT_INVENTORY.md](../TENANT_INVENTORY.md) | Org & tenant inventory |
| [DEFERRED_ITEMS.md](../DEFERRED_ITEMS.md) | Technical debt backlog |
| [ADVERSARIAL_CERTIFICATION_REPORT.md](../ADVERSARIAL_CERTIFICATION_REPORT.md) | Security certification |
| [AUDIT_LEDGER_2026-03-25.md](../AUDIT_LEDGER_2026-03-25.md) | Audit trail |
| [CODEOWNERS](../CODEOWNERS) | Code ownership |

## Related Directories

| Directory | Contents |
|-----------|----------|
| [governance/](../governance/) | Corporate strategy, finance, HR, legal, compliance, AI governance |
| [ops/](../ops/) | Runbooks, incident response, compliance, policies, environments |
| [reports/](../reports/) | Assessment reports, audit results, maturity scorecards |
| [security/](../security/) | Red team profiles & adversarial testing |
| [infrastructure/](../infrastructure/) | Infrastructure as code & deployment configs |
