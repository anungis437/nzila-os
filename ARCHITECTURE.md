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
  pondu/         Agri field operations (producers, harvests, lots, quality, warehouse, shipments, payments)
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
