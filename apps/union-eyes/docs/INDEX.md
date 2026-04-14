# UnionEyes Documentation Index

> Navigation hub for UnionEyes documentation.
> This index reflects the current workflow model: intake, work, intelligence, and outcomes.

## Audience Guides

> **Non-technical?** Start at the [UnionEyes Hub](../../docs/union-eyes/README.md).

## Quick Start

| I am a... | Start here |
|-----------|-----------|
| **Pilot user (CUPE)** | [CUPE Pilot User Guide](../../docs/pilot/cupe/CUPE_PILOT_USER_GUIDE.md) |
| **Pilot admin** | [CUPE Pilot Admin Runbook](../../docs/pilot/cupe/CUPE_PILOT_ADMIN_RUNBOOK.md) |
| **Steward / rep** | [Steward Quick Start](#steward-quick-start) |
| **Developer** | [Architecture](./ARCHITECTURE_SHAPE.md) |
| **Platform ops** | [Demo Flow](./CAPE-DEMO-FLOW.md) |

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
| [Architecture](./ARCHITECTURE_SHAPE.md) | System architecture and component map |
| [Domain Model](./DOMAIN_MODEL.md) | Entities, relationships, state machines |
| [Terminology Alignment](./TERMINOLOGY_ALIGNMENT.md) | Vocabulary contract across product, docs, and APIs |
| [Enterprise Hardening](./enterprise-hardening-architecture.md) | Security, observability, deployment |
| [CBA Intelligence API](./cba-intelligence-openapi.yaml) | Public source intelligence API spec |
| [Pilot Playbook](./CAPE-PILOT-PLAYBOOK.md) | Adoption and rollout strategy |
| [Pilot Audit Report](./CAPE-PILOT-AUDIT-REPORT.md) | Historical audit reference |

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

- Audience-friendly docs: [UnionEyes Hub](../../docs/union-eyes/README.md)
- Full glossary: [Glossary](../../docs/index/glossary.md)
- Documentation map: [Doc Map](../../docs/index/doc-map.md)
- Main repo README: [../../README.md](../../README.md)
- Platform architecture: [../../ARCHITECTURE.md](../../ARCHITECTURE.md)
- Contributing guide: [../../CONTRIBUTING.md](../../CONTRIBUTING.md)
- Security policy: [../../SECURITY.md](../../SECURITY.md)
