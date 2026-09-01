# UnionEyes Documentation Index

> Navigation hub for UnionEyes documentation.
> This index reflects the current workflow model: intake, work, intelligence, and outcomes.

## Audience Guides

> **Non-technical?** Start at the [UnionEyes Hub](../../../docs/union-eyes/README.md).

## Quick Start

| I am a... | Start here |
|-----------|-----------|
| **Pilot user (CUPE)** | [CUPE Pilot User Guide](../../docs/pilot/cupe/CUPE_PILOT_USER_GUIDE.md) |
| **Pilot admin** | [CUPE Pilot Admin Runbook](../../docs/pilot/cupe/CUPE_PILOT_ADMIN_RUNBOOK.md) |
| **Steward / rep** | [Steward Quick Start](#steward-quick-start) |
| **Developer** | [Architecture](./architecture/ARCHITECTURE_SHAPE.md) |
| **Platform ops** | [Operations](./operations/) |

## Documentation Map

### For Users (Pilot)

| Document | Purpose |
|----------|---------|
| [CUPE Pilot User Guide](../../docs/pilot/cupe/CUPE_PILOT_USER_GUIDE.md) | Step-by-step: sign in, submit intake, follow progress |
| [CUPE Quick Start](../../docs/pilot/cupe/CUPE_PILOTING_QUICK_START.md) | Pilot onboarding checklist |
| [CUPE Readiness Checklist](../../docs/pilot/cupe/CUPE_READINESS_CHECKLIST.md) | Pre-pilot environment validation |

### For Admins

| Document | Purpose |
|----------|---------|
| [CUPE Admin Runbook](../../docs/pilot/cupe/CUPE_PILOT_ADMIN_RUNBOOK.md) | Day-to-day pilot administration |
| [CUPE Support SOP](../../docs/pilot/cupe/CUPE_PILOT_SUPPORT_SOP.md) | Issue triage and escalation |
| [CUPE Go/No-Go Review](../../docs/pilot/cupe/CUPE_PILOT_GO_NO_GO_REVIEW.md) | Launch readiness gate |
| [CUPE Rollback Runbook](../../docs/pilot/cupe/CUPE_PILOT_ROLLBACK_RUNBOOK.md) | Emergency rollback procedures |
| [CUPE RBAC Matrix](../../docs/pilot/cupe/CUPE_RBAC_MATRIX.md) | Role permissions reference |

### For Developers

| Document | Purpose |
|----------|---------|
| [Architecture](./architecture/ARCHITECTURE_SHAPE.md) | System architecture and component map |
| [Domain Model](./architecture/DOMAIN_MODEL.md) | Entities, relationships, state machines |
| [Governance Runtime Model](./architecture/GOVERNANCE_RUNTIME_MODEL.md) | Route policy and enforcement architecture |
| [Enterprise Hardening](./architecture/enterprise-hardening-architecture.md) | Security, observability, deployment |
| [FSM Authority](./architecture/FSM_AUTHORITY.md) | Finite state machine governance |
| [Labor Continuity Intelligence API](./architecture/cba-intelligence-openapi.yaml) | Governance-safe labor continuity operations API spec |
| [Terminology Alignment](./governance/TERMINOLOGY_ALIGNMENT.md) | Vocabulary contract across product, docs, and APIs |

### Security & Incident Response

| Document | Purpose |
|----------|---------|
| [Auth Reality Audit](./security/AUTH_REALITY_AUDIT.md) | Auth layer audit findings |
| [Secret Management Validation](./security/SECRET_MANAGEMENT_VALIDATION.md) | Secrets posture evidence |
| [Incident Drill Report](./security/INCIDENT_DRILL_REPORT.md) | Incident response rehearsal results |
| [Backup / Restore Validation](./security/BACKUP_RESTORE_VALIDATION.md) | DR validation evidence |

### Operations

| Document | Purpose |
|----------|---------|
| [Production Topology](./operations/PRODUCTION_TOPOLOGY.md) | Infrastructure topology |
| [Production Cutover Checklist](./operations/PRODUCTION_CUTOVER_CHECKLIST.md) | Go-live runbook |
| [Rollback Validation](./operations/ROLLBACK_VALIDATION.md) | Rollback procedure evidence |
| [Observability Validation](./operations/OBSERVABILITY_VALIDATION.md) | Monitoring and alerting evidence |
| [Demo Runbook](./operations/DEMO_RUNBOOK.md) | Operator pre-flight and demo setup |

### Trust Center

Buyer-facing public-safe trust and procurement evidence summaries.

| Document | Purpose |
|----------|---------|
| [Trust Center Index](./trust-center/INDEX.md) | Evidence summary and claim coverage table |
| [Security and Privacy](./trust-center/SECURITY_AND_PRIVACY_OVERVIEW.md) | Security controls and data privacy posture |
| [Governance and Auditability](./trust-center/GOVERNANCE_AND_AUDITABILITY_OVERVIEW.md) | Runtime governance controls and audit trail |
| [Data Residency and Infrastructure](./trust-center/DATA_RESIDENCY_AND_INFRASTRUCTURE_OVERVIEW.md) | Infrastructure topology and data residency |
| [AI Governance and Human Oversight](./trust-center/AI_GOVERNANCE_AND_HUMAN_OVERSIGHT.md) | AI controls and human review gates |
| [Federation and Sovereignty](./trust-center/FEDERATION_AND_SOVEREIGNTY_OVERVIEW.md) | Multi-tier federation governance architecture |
| [Business Continuity and Recovery](./trust-center/BUSINESS_CONTINUITY_AND_RECOVERY_OVERVIEW.md) | Continuity, rollback, and DR posture |
| [Procurement Evidence Map](./trust-center/PROCUREMENT_EVIDENCE_MAP.md) | Maps procurement questions to evidence artifacts |
| [Public-Safe Architecture Summary](./trust-center/PUBLIC_SAFE_ARCHITECTURE_SUMMARY.md) | External-facing architecture overview |

> Regenerate the trust center index with: `pnpm --filter @nzila/union-eyes trust:center`

### Procurement & Pilot Evidence

| Document | Purpose |
|----------|---------|
| [Product Readiness Report](./procurement/PRODUCT_READINESS_REPORT.md) | Production readiness memo (buyer evidence) |
| [Final Readiness Status](./procurement/FINAL_READINESS_STATUS.md) | Gate sign-off record |
| [Pilot Scope](./procurement/PILOT_SCOPE.md) | Pilot program scope and constraints |
| [Pilot Validation](./procurement/PILOT_VALIDATION.md) | Pilot validation results |
| [CAPE Pilot Playbook](./procurement/CAPE-PILOT-PLAYBOOK.md) | CAPE pilot adoption strategy |
| [CAPE Pilot Audit Report](./procurement/CAPE-PILOT-AUDIT-REPORT.md) | CAPE pilot audit evidence |

### Roadmap

| Document | Purpose |
|----------|---------|
| [Governed Public Experience Layer](./roadmap/governed-public-experience-layer.md) | Vision and plan for public-facing union surfaces |

### Archive

Historical snapshots retained for traceability.

| Document | Purpose |
|----------|---------|
| [TS Error Inventory](./archive/TS_ERROR_INVENTORY.md) | Historical TS error snapshot |
| [World Class Plan](./archive/WORLD_CLASS_PLAN.md) | Original hardening plan, superseded by current validation docs |
| [WhatsApp PTT Transcript](./archive/) | Historical representation protocol notes |

### Platform Operations

| Document | Purpose |
|----------|---------|
| [Scope Checklist](../../docs/pilot/01-scope-checklist.md) | Feature scope for pilot |
| [Data Onboarding](../../docs/pilot/02-data-onboarding.md) | Tenant data setup |
| [Security & Privacy](../../docs/pilot/03-security-privacy-packet.md) | Security controls |
| [Monitoring & SLOs](../../docs/pilot/04-monitoring-and-slos.md) | Observability setup |
| [Demo Script](../../docs/pilot/05-demo-script.md) | Live demo walkthrough |

## Glossary

| Term | Definition | Where used |
|------|-----------|-----------|
| **Intake** | A member-submitted issue awaiting steward review | Inbox, intake flows, grievances API |
| **Case** | Official casework managed by a representative | Work, workbench, case APIs |
| **Grievance** | Formal casework following a grievance-style representation path | Grievance APIs, work surface, formal workflows |
| **Inbox** | Member landing area for updates, requests, and intake-related activity | `/dashboard/inbox` |
| **Priorities** | Rep landing area for what needs action next | `/dashboard/priorities` |
| **Work** | Consolidated steward casework surface | `/dashboard/work` |
| **Intelligence** | Research, analytics, and reporting surface | `/dashboard/intelligence` |
| **Outcomes** | Results and follow-through surface | `/dashboard/outcomes` |
| **Pilot Program** | Officer-facing pilot health and readiness surface | `/dashboard/pilot` |

## Steward Quick Start

1. **Log in** → Stewards typically land in **Priorities**
2. **Review new work** → Check pending intake activity and urgent items
3. **Convert or create casework** → Convert a member intake or create official casework when authorized
4. **Manage progress** → Use **Work** to assign, advance, and document casework
5. **Record outcomes** → Keep resolution and follow-through current

> **Terminology note:** Members submit **intakes**. Reps manage **casework**. "Grievance" is used for the formal representation track.

## Cross-References

- Audience-friendly docs: [UnionEyes Hub](../../../docs/union-eyes/README.md)
- Full glossary: [Glossary](../../docs/index/glossary.md)
- Documentation map: [Doc Map](../../docs/index/doc-map.md)
- Main repo README: [../../README.md](../../../README.md)
- Platform architecture: [../../ARCHITECTURE.md](../../../ARCHITECTURE.md)
- Contributing guide: [../../CONTRIBUTING.md](../../../CONTRIBUTING.md)
- Security policy: [../../SECURITY.md](../../../SECURITY.md)
