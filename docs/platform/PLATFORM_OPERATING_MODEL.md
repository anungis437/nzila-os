# Nzila OS — Platform Operating Model

## Overview

Nzila OS is a modular, multi-tenant operating system for African institutional infrastructure. The platform layer provides the shared foundation that all vertical products (apps) build upon.

### Design Principles

1. **One org_scope, everywhere** — Every request, mutation, query, and event is scoped to an `orgId`. No data crosses org boundaries without explicit, audited federation.
2. **Deny by default** — All access is denied unless explicitly granted through role assignments, permissions, and entitlements.
3. **Products stay separate** — Each app (union-eyes, flow, cfo, trade, etc.) remains an independent vertical. The platform layer unifies only the shared infrastructure.
4. **Contracts over coupling** — Apps communicate through typed contracts (`@nzila/platform-contracts`), not direct imports of each other's internals.
5. **Governance-first** — Audit trails, evidence chains, and compliance are built into the platform layer, not bolted on.

## Architecture Layers

```
┌──────────────────────────────────────────────────────────────┐
│  Layer 1: Apps (apps/*)                                      │
│  union-eyes · flow · cfo · trade · agrimo · console · ...    │
├──────────────────────────────────────────────────────────────┤
│  Layer 2: Platform Services (packages/platform-*)            │
│  platform-auth · platform-shell · platform-notifications     │
│  platform-billing · platform-contracts                       │
├──────────────────────────────────────────────────────────────┤
│  Layer 3: Shared Packages (packages/*)                       │
│  org · audit · events · db · ui · contracts · ...            │
├──────────────────────────────────────────────────────────────┤
│  Layer 4: Infrastructure (ops/ · scripts/ · tooling/)        │
│  Bicep · GitOps · OPA · CI/CD · Security                     │
└──────────────────────────────────────────────────────────────┘
```

**Dependency rule**: Each layer may only depend on layers below it. Apps never import from other apps.

## Key Platform Packages

| Package | Purpose |
|---------|---------|
| `@nzila/platform-contracts` | Canonical Zod schemas for identity, org scope, roles, errors, pagination, events |
| `@nzila/org` | OrgContext type, guards, schemas, legacy adapters |
| `@nzila/platform-auth` | Shared auth/authorization — Clerk adapter, guards, middleware |
| `@nzila/platform-shell` | OS shell — module registry, context provider, navigation components |
| `@nzila/platform-notifications` | Notification service interface and in-memory implementation |
| `@nzila/platform-billing` | Billing/entitlement service interface |
| `@nzila/audit` | Hash-chain append-only audit trail |
| `@nzila/events` | EventBus, EventEmitter, EventStore |
| `@nzila/db` | Drizzle ORM schemas and scoped query builders |

## Module Lifecycle

Every app follows a defined lifecycle tier:

| Tier | Meaning |
|------|---------|
| `PRODUCTION` | GA — fully governed, SLO-bound |
| `PILOT` | Limited rollout — feature-flagged |
| `INCUBATING` | Active development — not production-ready |
| `EXPERIMENTAL` | Proof of concept |
| `DEPRECATED` | Scheduled for removal |

## Multi-Tenancy

All platform data is scoped by `orgId`. The `@nzila/org` package provides:

- `OrgContext<R>` — the canonical context type with orgId, userId, role, permissions
- `requireOrgScope()` — fail-closed guard
- `assertSameOrg()` — cross-org access prevention
- `withOrgScope()` — higher-order function wrapper

See [ORG_SCOPE_MODEL.md](./ORG_SCOPE_MODEL.md) for the full model.
