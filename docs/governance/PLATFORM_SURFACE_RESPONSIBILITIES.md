# Platform Surface Responsibilities — Nzila OS

> Defines the purpose and boundaries of each operational surface in Nzila OS.
> Prevents scope creep and surface duplication across the platform.
>
> Related: [CONTROL_PLANE_PRINCIPLES.md](../architecture/CONTROL_PLANE_PRINCIPLES.md)
> Machine-readable route manifest: `apps/control-plane/route.meta.json`

---

## Surface Definitions

### 1. Control Plane (`apps/control-plane`)

**Purpose**: Executive/operator shell for cross-platform health, governance, and action.

**Scope**:

- Platform-wide health summaries (aggregated, not raw data)
- Governance posture and compliance state
- Intelligence signals and anomaly triage
- Decision queues and approval workflows
- Change management lifecycle
- Environment status and orchestration
- Architecture health and structural entropy
- Procurement evidence generation

**Primary users**: Platform operators, executives, governance leads

**Bucket model**:

- **HEALTH** — Is the platform healthy? (environments, governance, architecture, modules)
- **ATTENTION** — What needs attention? (anomalies, decisions, intelligence, changes)
- **ACTION** — What can I act on? (approvals, exports, review queues, agent recommendations)

**Route governance**: Every route documented in [route.meta.json](../../apps/control-plane/route.meta.json) and [ROUTE_GOVERNANCE.md](../../apps/control-plane/docs/ROUTE_GOVERNANCE.md).

---

### 2. Console (`apps/console`)

**Purpose**: Operator/developer tool shell for diagnostics and deeper system interaction.

**Scope**:

- System diagnostics and operational debugging
- Lower-level operational tooling
- Database and infrastructure inspection
- Log analysis and trace exploration
- Direct service interaction for troubleshooting
- Developer-oriented operational tasks

**Primary users**: Developers, DevOps engineers, platform operators (technical)

**Key distinction from Control Plane**:

- Console is for **technical investigation**, not executive summary
- Console surfaces **detailed operational data**, not aggregated health
- Console supports **direct interaction** with system internals

---

### 3. Platform Admin (`apps/platform-admin`)

**Purpose**: Platform configuration and governance administration.

**Scope**:

- Policy configuration and rule management
- Registry and configuration metadata editing
- Global platform settings
- Feature flag management (administrative)
- Governance profile configuration
- Platform-wide user/role administration

**Primary users**: Platform administrators, governance administrators

**Key distinction from Control Plane**:

- Platform Admin is for **configuration changes**, not monitoring
- Platform Admin is concerned with **how the platform is configured**, not its runtime state
- Platform Admin manages **rules and policies**, not operational responses

---

### 4. App-Specific Admin Surfaces

**Purpose**: Domain-specific operational surfaces that live inside individual applications.

**Examples**:

| App | Admin Surface | Purpose |
|-----|---------------|---------|
| union-eyes | Case Operations | Case lifecycle management, evidence review, grievance intake |
| flow | Commerce Operations | Supplier management, quote approval, production operations |
| zonga | Content Moderation | Creator release approval, moderation queue, content policy |
| trade | Vehicle Operations | Vehicle intake, deal management, trade processing |
| cfo | Financial Operations | Financial report configuration, reconciliation, FX management |
| partners | Partner Operations | Partner onboarding, commission management |

**Primary users**: Domain operators, business users, vertical-specific admins

**Key distinction**:

- These surfaces belong **inside their respective apps**
- They manage **domain-specific workflows**, not platform-wide concerns
- They are **not visible** in Control Plane unless they surface governance-relevant signals

---

## Prohibited Patterns

### Control Plane must NOT

1. **Become a dumping ground for all app admin UIs**
   - App-local admin features (e.g., "manage flow suppliers") do not belong in Control Plane
   - If it only affects one app's domain, it goes in that app

2. **Duplicate what lives in individual apps**
   - Control Plane shows cross-app summaries, not app-specific detail views
   - An app's full case list belongs in the app, not the Control Plane

3. **Host raw data tables**
   - Control Plane is summary-first. Raw tables and data exploration belong in Console or the app.

### Console must NOT

1. **Duplicate Control Plane executive summaries**
   - Console does not need its own "platform health" dashboard
   - If it's a governance summary, it belongs in Control Plane

2. **Become a configuration UI**
   - Configuration changes belong in Platform Admin, not Console
   - Console is for investigation and diagnostics

### Platform Admin must NOT

1. **Swallow every domain setting**
   - Domain-specific configuration (e.g., "set quote expiry for flow") belongs in the app
   - Platform Admin only handles platform-wide configuration

2. **Duplicate operational monitoring**
   - Platform Admin does not need health dashboards
   - That belongs in Control Plane

### App Admin must NOT

1. **Implement platform-wide governance UIs**
   - If it's cross-app governance, it belongs in Control Plane
   - App admin handles domain-specific operations only

2. **Bypass platform services**
   - App admin should use platform services (policy engine, evidence, governance) rather than reimplementing them

---

## Decision Heuristic

When deciding where a new feature or page belongs:

| Question | If YES → |
|----------|----------|
| Is it about platform-wide health or governance? | Control Plane |
| Is it a cross-app summary or aggregation? | Control Plane |
| Does it require deep technical debugging? | Console |
| Does it involve system-level diagnostics? | Console |
| Is it about platform configuration or policies? | Platform Admin |
| Is it about global settings or governance rules? | Platform Admin |
| Is it domain-specific operational work? | App Admin (in the relevant app) |
| Does it only affect one vertical's workflow? | App Admin (in the relevant app) |

---

## Related Documents

- [CONTROL_PLANE_PRINCIPLES.md](../architecture/CONTROL_PLANE_PRINCIPLES.md) — route buckets and control plane design
- [ARCHITECTURAL_LAYERS.md](../architecture/ARCHITECTURAL_LAYERS.md) — layer model and boundary rules
- [PLATFORM_VS_APP_DECISION_RULE.md](PLATFORM_VS_APP_DECISION_RULE.md) — where new capabilities belong
