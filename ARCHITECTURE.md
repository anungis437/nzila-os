# Nzila OS — Architecture

## Overview

Nzila OS is the internal control backbone for the Nzila platform. NzilaOS itself is internal
acceleration IP, not a directly sold product — the current commercial spine is Union Eyes
(near-term revenue) and CIVIC (cautious public-institution path); see the root
[README.md](./README.md) "Commercial spine" section. For Union Eyes' own living engineering
status and gate state, read [docs/union-eyes/README.md](./docs/union-eyes/README.md) before
changing anything under `apps/union-eyes`.

It provides:

- **Evidence generation** — Tamper-evident audit trails stored in Azure Blob with hash chaining
- **RBAC / Authorization** — Centralized policy engine consumed by all apps
- **Telemetry** — Structured logging, request correlation, OpenTelemetry metrics
- **Retention policy** — Data retention enforcement with audit logging
- **Secrets management** — Azure Key Vault integration
- **Config validation** — Zod-based environment validation at startup
- **AI control plane** — Per-app AI profiles with budget enforcement and audit
- **ML registry** — Versioned model activation with approval workflows
- **Finance controls** — QBO sync, Stripe reconciliation, tax calendar
- **Partner entitlements** — Row-level partner access gating

## Machine-readable authorities

When documentation and these artifacts disagree, these artifacts win.

| Concern                                           | Authority                                                                    |
| ------------------------------------------------- | ---------------------------------------------------------------------------- |
| Capability ownership between apps                 | `apps/control-plane/lib/capability-ownership.ts`                             |
| Operational / integration registry                | `packages/platform-contracts/src/registry.ts`                                |
| Product tier, GTM posture, revenue status         | `governance/portfolio/product-catalog.json` (only editable portfolio source) |
| Platform + app status manifest                    | `nzila-truth-manifest.json` (generated)                                      |
| Repo inventory (apps, packages, workflows, tests) | `tooling/repo-inventory/output/inventory.json` (generated)                   |
| Union Eyes capability state                       | `apps/union-eyes/lib/reality/capability-registry.ts`                         |
| Per-app control posture                           | `apps/<app>/control-manifest.json`                                           |
| Package ownership metadata                        | `packages/<pkg>/package.meta.json`                                           |
| Platform adoption exceptions                      | `governance/exceptions/platform-adoption-exceptions.json`                    |

## Monorepo Structure

The enumerated, always-current inventory of apps, packages, workflows and tests is generated:
[tooling/repo-inventory/output/repo-inventory.md](./tooling/repo-inventory/output/repo-inventory.md)
(regenerate with `pnpm inventory:generate`, verify with `pnpm docs:sync`). The shape below is the
stable layout; it deliberately names authorities rather than listing every workspace.

```
apps/
  control-plane/     Authority layer (policy, governance, entitlements, registries)
  orchestrator-api/  Execution engine (workflow runs, dispatch, event fabric, job state)
  console/           Operator interface (dashboards, break-glass, audit visualisation)
  platform-admin/    Org-scoped administration (org users, settings, member roles)
  union-eyes/        Union Eyes — commercial lane 1 (Django-authoritative)
  abr/               CourtLens — access-to-justice / matter intelligence (Django-authoritative)
  civic/             CIVIC public-institution surface (discovery lane)
  <others>/          Portfolio and internal surfaces — see the generated inventory

packages/
  decision-core/          Canonical decision primitives, registry and enforcement helper
  platform-auth/          Canonical authentication authority (Argon2id + optional Entra SSO)
  platform-contracts/     Cross-app contracts, control-plane client, operational registry
  platform-policy-engine/ Policy evaluation engine (consumed via Control Plane)
  platform-shell/         Shared application shell
  platform-*/             One authoritative package per shared concern (see authority docs)
  os-core/                Control backbone (evidence, telemetry, retention, config, secrets)
  db/                     Drizzle ORM schema + migrations
  blob/                   Azure Blob Storage abstraction
  ai-core/, ai-sdk/       AI infrastructure and app-facing client (no direct provider imports)
  ml-core/, ml-sdk/       ML infrastructure and app-facing client
  <domain packages>/      Domain-specific layering (agri-*, union-eyes-*, trustcore-*, …)

services/     Standalone backend services
tooling/      Contract tests, repo inventory, scaffolding, CI and validation tooling
governance/   Portfolio catalog, capital model, exception registries, commercial data
scripts/      Validation, release, SRE and finops entrypoints referenced by package.json
ops/          Environment configs, runbooks, incident response, compliance packs
reports/      Generated reports — not hand-edited
infrastructure/ IaC and deployment configuration
.github/workflows/ CI, governance, security, compliance and release automation
```

## Key Architectural Decisions

### 1. Evidence-First

All material platform actions produce evidence artifacts in the sealed evidence pack pipeline:
`buildEvidencePackFromAction()` → `processEvidencePack()` → Azure Blob + `evidence_packs` DB row + hash-chained `audit_events`.

### 2. Apps Consume, Not Bypass

Apps consume `@nzila/ai-sdk` and `@nzila/ml-sdk`. They never call provider SDKs directly. This is enforced by ESLint.

### 3. Entitlements as Data

Partner access is granted via `partner_entities` rows. No hardcoded entity lists. No `DEFAULT_ENTITY_ID`.

### 4. Stack Authority

Every app has a formally designated authoritative data layer (Django or TS/Drizzle).
Django-authoritative apps (UE, ABR) must not mutate domain data via Drizzle directly.
TS-authoritative apps must not introduce a Django backend.
See [STACK_AUTHORITY.md](./docs/categories/platform-and-operations/architecture/STACK_AUTHORITY.md).
Enforced by `tooling/contract-tests/stack-authority.test.ts` (STACK_AUTHORITY_001).

### 4b. Platform Package Authority

Every shared concern has an authoritative platform package boundary.
Supporting packages may remain for compatibility or domain-specific layering,
but they are not expanded as parallel sources of truth.
See [PLATFORM_PACKAGE_AUTHORITY.md](./docs/categories/platform-and-operations/architecture/PLATFORM_PACKAGE_AUTHORITY.md)
and [WHEN_TO_USE_PLATFORM_PACKAGES.md](./docs/categories/platform-and-operations/platform/WHEN_TO_USE_PLATFORM_PACKAGES.md).
Ownership mapping is maintained in
[PACKAGE_OWNERSHIP_MATRIX.md](./docs/categories/platform-and-operations/platform/PACKAGE_OWNERSHIP_MATRIX.md).
Enforced by `scripts/platform-authority-check.ts` and `scripts/platform-adoption-gate.ts`.

### 4c. App Lifecycle Governance

Lifecycle tier definitions and promotion rules are documented in
[docs/categories/platform-and-operations/platform/APP_LIFECYCLE_PROCESS.md](docs/categories/platform-and-operations/platform/APP_LIFECYCLE_PROCESS.md),
with machine validation enforced by `pnpm app:lifecycle:check`.

Operational command groupings and script entrypoints are documented in
[docs/categories/platform-and-operations/platform/COMMAND_CATALOG.md](docs/categories/platform-and-operations/platform/COMMAND_CATALOG.md).

### 4d. Evidence Lifecycle Governance

Evidence retention, archival, legal-hold, and deletion policy is defined in
[docs/platform/EVIDENCE_LIFECYCLE_POLICY.md](./docs/platform/EVIDENCE_LIFECYCLE_POLICY.md)
(canonical; the longer background version lives at
[docs/categories/platform-and-operations/platform/EVIDENCE_LIFECYCLE_POLICY.md](./docs/categories/platform-and-operations/platform/EVIDENCE_LIFECYCLE_POLICY.md)),
with fail-closed checks enforced by `pnpm validate:evidence:lifecycle`.

### 4e. Strategic Telemetry Governance

Quarterly adoption/cost/delivery scorecards are defined in
[docs/categories/platform-and-operations/platform/STRATEGIC_TELEMETRY.md](docs/categories/platform-and-operations/platform/STRATEGIC_TELEMETRY.md)
and generated by `pnpm strategic:quarterly`.

### 5. Correlation IDs Everywhere

Every API request carries a `requestId` (UUID) and optional `traceId`. All audit events reference these.

### 6. Fail Fast on Bad Config

Every app validates environment variables at startup using Zod schemas from `@nzila/os-core/config`. An invalid env causes process exit before serving traffic.

## Data Flow: Evidence Pack

```
Governance Action ──► buildEvidencePackFromAction()
                              │
                              ▼
                    EvidencePackRequest (os-core types)
                              │
                              ▼
                    processEvidencePack()
                    ├── uploadBuffer() ──► Azure Blob
                    ├── db.insert(documents)
                    ├── db.insert(auditEvents) + hash chain
                    ├── db.insert(evidencePacks)
                    └── db.insert(evidencePackArtifacts)
                              │
                              ▼
                    EvidencePackResult (packId, indexBlobPath, ...)
```

## Security Architecture

See [SECURITY.md](./SECURITY.md) for threat model, supply chain controls, and incident response.

---

## Control System Unification

> Single canonical execution flow. No policy logic outside Control Plane. No governance logic
> outside Control Plane. This unification is current architecture, enforced by the boundary
> tests listed below — not a historical plan.

### App Authority Boundaries

| App                | Role                   | Owns                                                                                                                                                            | Does NOT Own                                                            |
| ------------------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `control-plane`    | **Authority layer**    | Policy enforcement, governance lifecycle, org lifecycle, entitlements, feature flags, workflow definitions, audit policy, approval policy, integration registry | Any execution, job state, operator UI                                   |
| `orchestrator-api` | **Execution engine**   | Workflow execution, job state, command dispatch, event fabric                                                                                                   | Policy decisions, governance approval, org lifecycle                    |
| `console`          | **Operator interface** | Operator dashboard, break-glass ops, audit visualization, system monitoring                                                                                     | Policy evaluation (proxied to CP), governance DB writes (proxied to CP) |
| `platform-admin`   | **Org-scoped admin**   | Org users, org settings, member roles                                                                                                                           | Cross-org operations, global policy, entitlement grants                 |

### Canonical Execution Flow

```
Console / PlatformAdmin
       │
       │  (user initiates action)
       ▼
Control Plane ──► evaluatePolicies()   [POST /api/control-plane/policy/evaluate]
       │               │
       │          blocked? → reject
       │          needsApproval? → createGovernanceAction() → pending_approval
       │               │
       │          all approved?
       ▼
Orchestrator API ──► executes workflow
       │
       ▼
State Update ──► Orchestrator stores job state
       │
       ▼
Control Plane ──► recordAuditEvent() + hash chain
       │
       ▼
UI (Console / PlatformAdmin polls or subscribes)
```

### Capability Ownership Map

Defined in `apps/control-plane/lib/capability-ownership.ts` — the single source of truth.
Enforced by `tests/system/control-plane-boundaries.test.ts`.

```
policyEnforcement    → control-plane  (authoritative)
governanceActions    → control-plane  (authoritative)
orgLifecycle         → control-plane  (authoritative)
auditPolicy          → control-plane  (authoritative)
entitlements         → control-plane  (authoritative, readable by others)
featureFlags         → control-plane  (authoritative, readable by others)
workflowDefinitions  → control-plane  (authoritative, readable by others)
approvalPolicy       → control-plane  (authoritative)
integrationRegistry  → control-plane  (authoritative, readable by others)
contracts            → control-plane  (authoritative, readable by others)

workflowExecution    → orchestrator   (authoritative)
commandDispatch      → orchestrator   (authoritative)
eventFabric          → orchestrator   (authoritative)
jobState             → orchestrator   (authoritative, readable by others)

operatorDashboard    → console        (authoritative)
breakGlass           → console        (authoritative)
auditVisualization   → console        (authoritative)
systemMonitoring     → console        (authoritative, readable by others)

orgUsers             → platform-admin (authoritative)
orgSettings          → platform-admin (authoritative)
memberRoles          → platform-admin (authoritative)
```

### Control Plane API Surface

| Endpoint                                       | Method | Purpose                                               |
| ---------------------------------------------- | ------ | ----------------------------------------------------- |
| `/api/control-plane/policy/evaluate`           | POST   | Single canonical policy evaluation for all apps       |
| `/api/control-plane/governance/actions`        | POST   | Create / submit / decide / execute governance actions |
| `/api/control-plane/governance/actions?orgId=` | GET    | List governance actions for an org                    |

All endpoints require `x-api-key` matching `CONTROL_PLANE_API_KEY`.

### Boundary Enforcement

The following invariants are checked in CI by `tests/system/control-plane-boundaries.test.ts`:

1. `console/lib/policy-enforcement.ts` does NOT import `@nzila/platform-policy-engine` — all policy calls are proxied to Control Plane.
2. `console/lib/governance/state-machine.ts` does NOT import `platformDb` — all governance mutations are proxied to Control Plane.
3. `orchestrator-api/src/platform.ts` does NOT export `getPolicyEvaluator` or `getAIRunStore`.
4. `orchestrator-api/src/index.ts` does NOT call `getPolicyEvaluator`.
5. Control Plane governance and policy routes export properly auth-gated `POST`/`GET` handlers.

### Control Manifests

Each app declares its control posture in `apps/<app>/control-manifest.json`. Every app in
`apps/` carries one; the manifests are read by the platform surface and adoption checks
(`pnpm platform:surface:model:check`, `pnpm platform:adoption:check`).

### Authority Services (Control Plane)

All authorization decisions are made in `apps/control-plane/server/authority/`:

| Service                    | File                     | Purpose                                          |
| -------------------------- | ------------------------ | ------------------------------------------------ |
| `resolveEntitlements`      | `entitlements.ts`        | Resolve feature entitlements for an org/actor    |
| `authorizeWorkflowTrigger` | `workflow-authorizer.ts` | Entitlement + policy check → authorization token |
| `recordDecisionEvent`      | `decision.ts`            | Hash-chained immutable audit decision log        |
| `getDecisionsForOrg`       | `decision.ts`            | Retrieve decision history for an org             |

**Consumers** (Console, Platform Admin) MUST use `@nzila/platform-contracts/control-plane-client`
(`createControlPlaneClient` / `getControlPlaneClient`) — never call CP authority APIs directly.

### Execution Engine (Orchestrator)

The canonical execution entry point is `apps/orchestrator-api/src/execution-engine.ts`:

- `executeWorkflow(input)` — idempotent, deduplicates by `requestId` + `idempotencyKey`
- `cancelWorkflowRun(runId, cancelledBy)` — cancels in-flight runs
- `getWorkflowRun(runId)` / `listWorkflowRuns(filter?)` — read access

Non-dry-run executions require an `authorizationDecisionId` from the Control Plane. Requests
missing it are rejected with `auth_failure` status. This enforces the invariant: **the
Orchestrator never executes unapproved workflows**.

### Observability: Correlation IDs

All three Next.js apps (`control-plane`, `console`, `platform-admin`) propagate:

- `x-correlation-id` — stable ID for a logical operation spanning services (echoed from inbound or generated)
- `x-request-id` — unique per HTTP request

Set in each app's `middleware.ts`. The Orchestrator reads/forwards `x-correlation-id` on all
emitted events via `ExecutionRunSchema.correlationId`.
