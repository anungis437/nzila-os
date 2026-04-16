# Nzila OS — Architecture

## Overview

Nzila OS is the internal control backbone for the Nzila platform. It provides:

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

## Monorepo Structure

```
apps/
  console/       Internal ops console (governance, finance, ML, AI)
  partners/      Partner portal (entitlement-gated)
  web/           Public marketing/landing
  union-eyes/    UE case management
  agrimo/         Agri field operations (producers, harvests, lots, quality, warehouse, shipments, payments)
  cora/          Agri intelligence dashboard (yield, pricing, risk, traceability)

packages/
  os-core/       Control backbone (evidence, policy, telemetry, retention, config, secrets)
  db/            Drizzle ORM schema + migrations
  blob/          Azure Blob Storage abstraction
  ai-core/       AI infrastructure (profiles, budget, RAG, actions)
  ai-sdk/        App-facing AI client + ESLint no-shadow-ai rule
  ml-core/       ML infrastructure (registry, scoring, drift monitoring)
  ml-sdk/        App-facing ML client + ESLint no-shadow-ml rule
  payments-stripe/ Stripe integration + webhook handling
  qbo/           QuickBooks Online OAuth + sync
  tax/           Tax calendar + obligation engine
  analytics/     Aggregation + reporting
  ui/            Shared component library
  agri-core/     Agri domain primitives (enums, types, schemas, FSMs)
  agri-db/       Agri database repositories (org-scoped)
  agri-events/   Agri domain event bus + integration dispatch
  agri-intelligence/ Agri computation library (yield, loss, payout)
  agri-traceability/ Agri evidence packs + hash chain verification
  agri-adapters/ Agri external system adapters (weather, market, mobile-money, SMS)

tooling/
  scripts/       CLI tools (thin wrappers over packages)
  contract-tests/ Invariant enforcement tests
  ai-evals/      AI evaluation harness
  ml/            ML training/inference scripts
  security/      Security artifact publishing
  db/            Schema snapshot tooling
  ops/           Ops pack validation

ops/
  incident-response/  Playbooks + templates
  runbooks/           Step-by-step operational guides
  change-management/  Change request templates
  compliance/         Control test plan + evidence schema
  security-operations/ Security runbooks

.github/workflows/
  ci.yml                 Primary CI gate
  control-tests.yml      Scheduled control validation
  codeql.yml             Static analysis
  dependency-audit.yml   CVE scanning
  secret-scan.yml        Secret leak detection
  sbom.yml               Software Bill of Materials
  ops-pack.yml           Ops pack completeness gate
  release-train.yml      Release evidence + SBOM generation
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
See [docs/architecture/STACK_AUTHORITY.md](./docs/architecture/STACK_AUTHORITY.md).
Enforced by `tooling/contract-tests/stack-authority.test.ts` (STACK_AUTHORITY_001).

### 4b. Platform Package Authority
Every shared concern has an authoritative platform package boundary.
Supporting packages may remain for compatibility or domain-specific layering,
but they are not expanded as parallel sources of truth.
See [docs/architecture/PLATFORM_PACKAGE_AUTHORITY.md](./docs/architecture/PLATFORM_PACKAGE_AUTHORITY.md)
and [docs/platform/WHEN_TO_USE_PLATFORM_PACKAGES.md](./docs/platform/WHEN_TO_USE_PLATFORM_PACKAGES.md).
Enforced by `scripts/platform-authority-check.ts` and `scripts/platform-adoption-gate.ts`.

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

> **Added in the Master Alignment Pass (2025)**
> Single canonical execution flow. No policy logic outside Control Plane. No governance logic outside Control Plane.

### App Authority Boundaries

| App | Role | Owns | Does NOT Own |
|-----|------|------|--------------|
| `control-plane` | **Authority layer** | Policy enforcement, governance lifecycle, org lifecycle, entitlements, feature flags, workflow definitions, audit policy, approval policy, integration registry | Any execution, job state, operator UI |
| `orchestrator-api` | **Execution engine** | Workflow execution, job state, command dispatch, event fabric | Policy decisions, governance approval, org lifecycle |
| `console` | **Operator interface** | Operator dashboard, break-glass ops, audit visualization, system monitoring | Policy evaluation (proxied to CP), governance DB writes (proxied to CP) |
| `platform-admin` | **Org-scoped admin** | Org users, org settings, member roles | Cross-org operations, global policy, entitlement grants |

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

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/control-plane/policy/evaluate` | POST | Single canonical policy evaluation for all apps |
| `/api/control-plane/governance/actions` | POST | Create / submit / decide / execute governance actions |
| `/api/control-plane/governance/actions?orgId=` | GET | List governance actions for an org |

All endpoints require `x-api-key` matching `CONTROL_PLANE_API_KEY`.

### Boundary Enforcement

The following invariants are checked in CI by `tests/system/control-plane-boundaries.test.ts`:

1. `console/lib/policy-enforcement.ts` does NOT import `@nzila/platform-policy-engine` — all policy calls are proxied to Control Plane.
2. `console/lib/governance/state-machine.ts` does NOT import `platformDb` — all governance mutations are proxied to Control Plane.
3. `orchestrator-api/src/platform.ts` does NOT export `getPolicyEvaluator` or `getAIRunStore`.
4. `orchestrator-api/src/index.ts` does NOT call `getPolicyEvaluator`.
5. Control Plane governance and policy routes export properly auth-gated `POST`/`GET` handlers.

### Control Manifests

Each app declares its control posture in `control-manifest.json`:

- `console`: `enforcement: false` (delegates to control-plane), `governance: true` (visualizes)
- `orchestrator-api`: `enforcement: false`, `governance: false` (pure execution)
- `control-plane`: `enforcement: true`, `governance: true` (authoritative)
- `platform-admin`: `enforcement: true` (org-scoped only), `governance: true`

