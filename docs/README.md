# Nzila OS Documentation

## What do you need?

- **I want to use Union Eyes** → [Quick Start](union-eyes/quick-start.md) · [User Guide](union-eyes/user-guide.md)
- **I am part of the CUPE pilot** → [Pilot Overview](union-eyes/pilot-overview.md) · [FAQ](union-eyes/faq.md)
- **I am running the pilot** → [Admin Guide](union-eyes/admin-guide.md) · [Admin Runbook](pilot/cupe/CUPE_PILOT_ADMIN_RUNBOOK.md)
- **I need to explain this to a partner or lawyer** → [Partner Overview](union-eyes/partner-overview.md)
- **I need technical details** → [Architecture](../ARCHITECTURE.md) · [Developer Guide](how-to/GOLDEN_PATH_DEVELOPER_GUIDE.md)
- **Something is broken** → [Runbooks](../ops/runbooks/README.md) · [Support SOP](pilot/cupe/CUPE_PILOT_SUPPORT_SOP.md)

## Union Eyes

All Union Eyes docs for end users live in [union-eyes/](union-eyes/README.md).

| Doc | For | Time |
|---|---|---|
| [Quick Start](union-eyes/quick-start.md) | Members & stewards | 2 min |
| [User Guide](union-eyes/user-guide.md) | Members & stewards | 10 min |
| [Admin Guide](union-eyes/admin-guide.md) | Pilot admins | 5 min |
| [Pilot Overview](union-eyes/pilot-overview.md) | Everyone in the pilot | 5 min |
| [Partner Overview](union-eyes/partner-overview.md) | Partners, lawyers, stakeholders | 10 min |
| [FAQ](union-eyes/faq.md) | Anyone | 3 min |

## CUPE Pilot Operations

- [Admin Runbook](pilot/cupe/CUPE_PILOT_ADMIN_RUNBOOK.md) — Detailed procedures
- [Support SOP](pilot/cupe/CUPE_PILOT_SUPPORT_SOP.md) — Issue triage and escalation
- [Readiness Checklist](pilot/cupe/CUPE_READINESS_CHECKLIST.md) — Pre-launch validation
- [RBAC Matrix](pilot/cupe/CUPE_RBAC_MATRIX.md) — Role permissions

## Platform (developers)

- [Golden Path](how-to/GOLDEN_PATH_DEVELOPER_GUIDE.md) — Developer onboarding
- [Architecture](../ARCHITECTURE.md) — System design
- [Stack Authority](architecture/STACK_AUTHORITY.md) — Technology standards
- [Package Catalogue](reference/packages.md) — All packages
- [Tutorials](tutorials/README.md) · [How-To Guides](how-to/README.md) · [Reference](reference/README.md) · [Explanation](explanation/README.md)

## Runbooks

All operational runbooks are in [`ops/runbooks/`](../ops/runbooks/):
[Platform](../ops/runbooks/platform/) · [Numbered](../ops/runbooks/numbered/) · [Commerce](../ops/runbooks/commerce/) · [Security](../ops/runbooks/security/)

---

## Full Index

For architecture, governance, operations, and SaaS strategy docs, see the [Doc Map](index/doc-map.md) and [Glossary](index/glossary.md).
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
