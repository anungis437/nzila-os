# Agri Stack — Architecture

> Product ownership is governed by [ADR-AGRI-001](ADR/ADR-AGRI-001-cora-agrimo-product-boundary.md).
> The diagrams and flows below describe current implementation, not product subordination.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                   │
│                                                                         │
│   ┌──────────────────────┐       ┌──────────────────────┐              │
│   │    apps/agrimo        │       │    apps/cora          │              │
│   │  Agrimo           │       │  Cora                │              │
│   │  operations       │       │  food-economy         │              │
│   │                   │       │  intelligence         │              │
│   │                      │       │                       │              │
│   │  /agrimo/dashboard    │       │  /cora/dashboard      │              │
│   │  /agrimo/producers    │       │  /cora/yield-forecast │              │
│   │  /agrimo/harvests     │       │  /cora/price-signals  │              │
│   │  /agrimo/lots         │       │  /cora/risk           │              │
│   │  /agrimo/quality      │       │  /cora/impact         │              │
│   │  /agrimo/warehouse    │       │  /cora/performance    │              │
│   │  /agrimo/shipments    │       │  /cora/data-sources   │              │
│   │  /agrimo/payments     │       │                       │              │
│   │  /agrimo/certs        │       │                       │              │
│   └──────────┬───────────┘       └───────────┬───────────┘              │
│              │ current execution paths        │ placeholder Cora pages   │
└──────────────┼────────────────────────────────┼─────────────────────────┘
               │                                │
┌──────────────┼────────────────────────────────┼─────────────────────────┐
│              │      SHARED PACKAGE LAYER       │                        │
│              ▼                                ▼                         │
│   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐    │
│   │  agri-core       │  │  agri-db         │  │ agri-intelligence│    │
│   │  types, enums,   │  │  schema, repos,  │  │ yield models,    │    │
│   │  schemas, FSMs   │  │ org predicates  │  │ loss rates,      │    │
│   └──────────────────┘  └──────────────────┘  │ payout sim       │    │
│                                                └──────────────────┘    │
│   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐    │
│   │  agri-events     │  │ agri-traceability│  │  agri-adapters   │    │
│   │  domain events,  │  │  evidence packs, │  │  external system │    │
│   │  outbox, bus     │  │  proof chains    │  │  adapters        │    │
│   └──────────────────┘  └──────────────────┘  └──────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
               │                    │                     │
┌──────────────┼────────────────────┼─────────────────────┼───────────────┐
│              │   PLATFORM LAYER    │                     │              │
│              ▼                    ▼                     ▼               │
│   ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────┐  │
│   │  @nzila/db       │  │  @nzila/os-core  │  │ integrations-      │  │
│   │  scoped, audited │  │  evidence, RBAC, │  │ runtime dispatcher │  │
│   │  Drizzle ORM     │  │  telemetry       │  │ + retry + DLQ      │  │
│   └──────────────────┘  └──────────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Layering Rules

Target layering for data-backed workflows:

```
Route (app/agrimo/*)
  └─▶ Server Action (lib/actions/*.ts)
       └─▶ Service (lib/services/*.ts or agri-core)
            └─▶ Domain Logic (agri-core FSMs, validators)
                 └─▶ Repository (agri-db repositories)
                      └─▶ Scoped DB (@nzila/db/scoped)
```

### Layer Rules

1. **Routes** — UI only, call server actions, never access DB
2. **Server Actions** — `'use server'`, resolve org context, validate input, call services
3. **Services** — business orchestration, emit events, generate evidence
4. **Domain** — pure functions, FSM transitions, validators, no I/O
5. **Repositories** — org-scoped queries, return typed results
6. **Adapters** — external system integration via dispatcher

## Data Flow

### Write Path (Agrimo)

```
User action
  → Server Action (resolveOrgContext + validate)
    → Service (orchestrate + emit audit)
      → Repository (org-scoped insert/update)
        → agri-events outbox (transactional)
          → integrations-runtime dispatcher
            → Email / SMS / Slack / CRM
```

### Current Cora App State

```
Dashboard routes
  → placeholder UI

Platform/auth/health routes
  → shared platform runtime
```

The Phase 0B audit found no live Cora agricultural repository or
intelligence-query call. The shared packages below are available
dependencies/primitives, not proof of an active Cora read path. Future
Cora-owned data flows must be designed behind the ownership and authorization
seams in [ADR-AGRI-002](ADR/ADR-AGRI-002-cora-food-economy-ceiling.md).

## Deployment Profiles

Cora and Agrimo are independently deployable first-class products. The
profiles below describe possible deployment shapes, not product dependency.

| Profile | Agrimo | Cora | DB | Integrations |
|---------|-------|------|-----|-------------|
| **Managed** | Independently deployable | Independently deployable | Governed shared or separate storage | Managed where configured |
| **Sovereign** | Where supported | Where supported | Customer-managed where supported | Customer-managed |
| **Hybrid** | Independent | Independent | Governed split or shared storage | Mixed |

The current Cora surface is read-only, but that is an implementation
contract/test constraint; Cora currently has no live agricultural query
path. Future Cora-owned workflows require separately designed authorization
and data boundaries; this doctrine update does not authorize writes.
