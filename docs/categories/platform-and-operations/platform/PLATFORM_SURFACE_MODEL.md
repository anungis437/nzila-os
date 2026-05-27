# Platform Surface Model — Nzila OS

> Canonical definition of the operating-shell model for all platform-facing surfaces.
> This document supersedes informal surface conventions and establishes enforceable boundaries.
>
> Machine-readable registry: `platform/registry/platform-surfaces.json`
> Existing detail: `docs/governance/PLATFORM_SURFACE_RESPONSIBILITIES.md`

---

## Surface Architecture

Nzila OS operates four distinct platform-facing surfaces, each with a clear mandate.
Features **must** be placed in the correct surface. Overlap is a governance violation.

---

### 1. Control Plane (`apps/control-plane`)

**Role**: Operating Shell — cross-platform awareness, prioritization, and action.

| Attribute | Value |
|-----------|-------|
| **Intended users** | Platform operators, executives, governance leads |
| **Bucket model** | HEALTH / ATTENTION / ACTION |

**Allowed feature classes**:

- Platform-wide health summaries (aggregated, never raw)
- Governance posture and compliance state
- Environment status and orchestration
- Change management lifecycle and calendar
- Intelligence signals and anomaly triage
- Decision queues and approval workflows
- Module status and feature coverage
- Procurement evidence generation
- Architecture health dashboard

**Forbidden feature classes**:

- Deep app-level domain operations (belongs in App Admin)
- Full app admin replacement UIs
- Raw data tables or data exploration (belongs in Console)
- App-specific configuration (belongs in App Admin or Platform Admin)
- Duplicate executive summaries already in Console

**Examples from repo**:

| Route | Bucket | Purpose |
|-------|--------|---------|
| `/overview` | HEALTH | Platform health summary |
| `/governance` | HEALTH | Governance posture |
| `/environments` | HEALTH | Environment status |
| `/changes` | ATTENTION | Pending change review |
| `/anomalies` | ATTENTION | Anomaly triage |
| `/agents` | ACTION | Agent recommendation review |
| `/procurement` | ACTION | Evidence pack generation |
| `/architecture` | HEALTH | Architecture health dashboard |

---

### 2. Console (`apps/console`)

**Role**: Operator/Developer Shell — diagnostics, maintenance, and deep system interaction.

| Attribute | Value |
|-----------|-------|
| **Intended users** | Developers, DevOps engineers, platform operators (technical) |

**Allowed feature classes**:

- System diagnostics and operational debugging
- Lower-level operational tooling and maintenance
- Database and infrastructure inspection
- Log analysis and trace exploration
- Direct service interaction for troubleshooting
- AI model interaction, prompt engineering, and RAG tooling
- Evidence pack generation and proof center
- Performance analysis and regression detection
- Developer-oriented support tools

**Forbidden feature classes**:

- Executive status home or platform governance summary duplication
- Cross-platform governance summary (belongs in Control Plane)
- Platform configuration changes (belongs in Platform Admin)
- Domain-specific operational dashboards (belongs in App Admin)

**Examples from repo**:

| Route | Purpose |
|-------|---------|
| `/system-health` | Detailed system health diagnostics |
| `/performance` | Performance analysis and regression checks |
| `/proof-center` | Evidence pack generation |
| `/ai/*` | AI chat, RAG, prompt management |
| `/scale-simulation` | Load and scale testing |
| `/trend-detection` | Trend analysis tooling |

---

### 3. Platform Admin (`apps/platform-admin`)

**Role**: Platform Configuration — governance administration and platform-wide settings.

| Attribute | Value |
|-----------|-------|
| **Intended users** | Platform administrators, governance administrators |

**Allowed feature classes**:

- Policy configuration and rule management
- Registry and configuration metadata editing
- Global platform settings
- Compliance administration
- Knowledge graph and ontology management
- Entity graph configuration
- Data fabric administration
- Event fabric administration
- AI run management and reasoning configuration
- Integration operations management

**Forbidden feature classes**:

- Domain-specific operations dashboards (belongs in App Admin)
- General system status home (belongs in Control Plane)
- Operational debugging or diagnostics (belongs in Console)
- Runtime monitoring (belongs in Control Plane)

**Examples from repo**:

| Route | Purpose |
|-------|---------|
| `/ontology` | Platform ontology management |
| `/entity-graph` | Entity graph configuration |
| `/knowledge` | Knowledge registry admin |
| `/data-fabric` | Data fabric administration |
| `/decisions` | Decision engine configuration |
| `/events` | Event fabric administration |
| `/integration-ops` | Integration operations |
| `/reasoning` | Reasoning engine configuration |

---

### 4. App Admin (within each `apps/<app>`)

**Role**: Domain-specific operations that belong inside each application.

| Attribute | Value |
|-----------|-------|
| **Intended users** | Domain operators, business users, vertical-specific admins |

**Allowed feature classes**:

- Domain-specific workflow management
- Business entity CRUD and lifecycle operations
- Domain reporting and analytics
- Application-level settings
- Domain-specific approval workflows

**Forbidden feature classes**:

- Cross-platform summary responsibilities (belongs in Control Plane)
- Platform-wide governance UIs (belongs in Control Plane)
- Platform configuration (belongs in Platform Admin)
- Bypassing platform services (use `@nzila/platform-*` packages)

**Examples from repo**:

| App | Admin Surface | Purpose |
|-----|---------------|---------|
| union-eyes | Case Operations | Case lifecycle, evidence review, grievance intake |
| flow | Commerce Operations | Quote approval, production operations |
| zonga | Content Moderation | Release approval, moderation queue |
| cfo | Financial Operations | Report configuration, reconciliation |
| partners | Partner Operations | Onboarding, commission management |

---

## Decision Heuristic

| Question | If YES → |
|----------|----------|
| Is it about platform-wide health or governance? | Control Plane |
| Is it a cross-app summary or aggregation? | Control Plane |
| Does it require deep technical debugging? | Console |
| Does it involve system-level diagnostics? | Console |
| Is it about platform configuration or policies? | Platform Admin |
| Is it about global settings or governance rules? | Platform Admin |
| Is it domain-specific operational work? | App Admin |
| Does it only affect one vertical's workflow? | App Admin |

---

## Enforcement

- Machine-readable registry: `platform/registry/platform-surfaces.json`
- Route manifests: `apps/<surface>/route.meta.json`
- Check script: `pnpm exec tsx scripts/platform-surface-model-check.ts`
- See also: `docs/governance/PLATFORM_SURFACE_RESPONSIBILITIES.md`

---

## Related Documents

- [PLATFORM_SURFACE_RESPONSIBILITIES.md](../governance/PLATFORM_SURFACE_RESPONSIBILITIES.md)
- [CONTROL_PLANE_PRINCIPLES.md](../architecture/CONTROL_PLANE_PRINCIPLES.md)
- [PLATFORM_VS_APP_DECISION_RULE.md](../governance/PLATFORM_VS_APP_DECISION_RULE.md)
- [APP_DOMAIN_CORE_STANDARD.md](../architecture/APP_DOMAIN_CORE_STANDARD.md)
