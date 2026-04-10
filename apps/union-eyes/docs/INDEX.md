# Union Eyes Documentation Index

> Navigation hub for all Union Eyes documentation.
> Find what you need by audience or topic.

## Audience Guides

> **Non-technical?** Start at the [Union Eyes Hub](../../docs/union-eyes/README.md) instead —
> it has guides written for members, stewards, admins, and partners.

## Quick Start

| I am a... | Start here |
|-----------|-----------|
| **Pilot user (CUPE)** | [CUPE Pilot User Guide](../../docs/pilot/cupe/CUPE_PILOT_USER_GUIDE.md) |
| **Pilot admin** | [CUPE Pilot Admin Runbook](../../docs/pilot/cupe/CUPE_PILOT_ADMIN_RUNBOOK.md) |
| **Steward / Rep** | [Steward Quick Start](#steward-quick-start) |
| **Developer** | [Architecture](./ARCHITECTURE_SHAPE.md) |
| **Platform ops** | [Demo Flow](./CAPE-DEMO-FLOW.md) |

## Documentation Map

### For Users (Pilot)

| Document | Purpose |
|----------|---------|
| [CUPE Pilot User Guide](../../docs/pilot/cupe/CUPE_PILOT_USER_GUIDE.md) | Step-by-step: login → create case → add update → track |
| [CUPE Quick Start](../../docs/pilot/cupe/CUPE_PILOTING_QUICK_START.md) | 2-minute onboarding checklist |
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
| [Enterprise Hardening](./enterprise-hardening-architecture.md) | Security, observability, deployment |
| [CBA Intelligence API](./cba-intelligence-openapi.yaml) | Public source intelligence API spec |
| [Pilot Playbook](./CAPE-PILOT-PLAYBOOK.md) | Adoption and rollout strategy |
| [Pilot Audit Report](./CAPE-PILOT-AUDIT-REPORT.md) | Compliance and security findings |

### Archive

Historical snapshots retained for traceability.

| Document | Purpose |
|----------|---------|
| [TS Error Inventory](./archive/TS_ERROR_INVENTORY.md) | Historical snapshot of 2,795 TS errors after removing `@ts-nocheck` |
| [World Class Plan](./archive/WORLD_CLASS_PLAN.md) | Original hardening plan (2026-03-05), superseded by PILOT_VALIDATION |
| [WhatsApp PTT Transcript](./archive/) | Voice note transcript — union representation protocol discussion |

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
| **Case** | A tracked workplace issue submitted by a member or steward | Dashboard, My Cases, Create Case |
| **Grievance** | A formal dispute initiated under a collective agreement with structured steps | Grievance Queue, Workbench |
| **Claim** | A member-submitted issue requesting union assistance | Submit New, My Cases |
| **Update** | A timestamped note, response, or status change on a case | Case Timeline |
| **Workbench** | A steward's personal workspace showing assigned cases and signals | Sidebar → Workbench |
| **Queue** | A filterable list of grievances by status and priority | Sidebar → Grievances |
| **Signal** | A real-time alert indicating SLA risk, overdue items, or required action | Dashboard Signals Widget |
| **Timeline** | Chronological log of all events and updates on a case | Case Detail View |
| **Deadline** | An SLA or contractual response deadline on a case | Deadline Manager |
| **Pilot** | A time-limited trial deployment with reduced feature scope | Pilot Dashboard |
| **Champion** | A high-engagement user identified for advocacy and adoption support | Internal metric |

## Steward Quick Start

1. **Log in** → You'll see the Pilot Dashboard
2. **Create a case** → Click "Create Case" (green card) → Fill: member name, issue type, description → Submit
3. **Add an update** → Open the case → Add a note in the Timeline
4. **Track progress** → Return to "My Cases" to see all active cases
5. **View signals** → Dashboard shows urgent items requiring attention

> **Terminology note:** In the UI, "Case" is the primary term. "Grievance" appears when a case follows a formal CBA-defined process. "Claim" is what members submit. All three refer to tracked workplace issues.

## Cross-References

- Audience-friendly docs: [Union Eyes Hub](../../docs/union-eyes/README.md)
- Full glossary: [Glossary](../../docs/index/glossary.md)
- Documentation map: [Doc Map](../../docs/index/doc-map.md)
- Main repo README: [../../README.md](../../README.md)
- Platform architecture: [../../ARCHITECTURE.md](../../ARCHITECTURE.md)
- Contributing guide: [../../CONTRIBUTING.md](../../CONTRIBUTING.md)
- Security policy: [../../SECURITY.md](../../SECURITY.md)
