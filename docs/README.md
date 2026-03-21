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
| [Architecture Governance Index](ARCHITECTURE_GOVERNANCE_INDEX.md) | Governance index |

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

## Domain-Specific Documentation

### [Decision Layer](decision-layer/)

AI decision engine capabilities, value models, and vertical implementations.

### [Commerce](commerce/)

Commerce domain model, ADRs, IRAP design, and MEIE deliverables.

### [Agri](agri/)

Agricultural vertical specification (modules 00–08).

### [Pilot](pilot/)

Pilot runbook and operational procedures for org rollouts.

### [Migration](migration/)

Legacy migration guides, enforcement upgrades, rollback procedures, and app alignment.

### [Hardening](hardening/)

Security hardening baseline, build reproducibility, logging, observability, and secrets.

### [Stress Test](stress-test/)

Enterprise stress test results and remediation plans.

### [GA](ga/)

General availability readiness gates and certification reports.

### [Platform](platform/)

Platform-level GA readiness and feature assessments.

### [Repo Contract](repo-contract/)

Repository invariants, versioning policy, and structural contracts.

### [Backlog](backlog/)

Active backlog items and technical debt.

---

## Canonical References

- [ARCHITECTURE.md](../ARCHITECTURE.md) — System architecture overview
- [CONTRIBUTING.md](../CONTRIBUTING.md) — Contribution guidelines
- [SECURITY.md](../SECURITY.md) — Security policy
- [README.business.md](../README.business.md) — Business context
- [governance/](../governance/) — Corporate, business, AI, and security governance
- [ops/](../ops/) — Operational policies and all runbooks
- [reports/](../reports/) — Assessment and audit reports
- [plans/](../plans/) — Implementation and assessment plans
