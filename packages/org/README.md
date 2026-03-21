# @nzila/org

Canonical organisation context and identity types. Single source of truth for org-scoped request context used across all NzilaOS services.

## Domain context

NzilaOS is a multi-org platform. Every request must carry an `OrgContext` that identifies the organisation, authenticated actor, originating application, and granted permissions. This package defines the canonical shape of that context, enforced at the API boundary and threaded through all service calls.

## Public API surface

| Export | Description |
|---|---|
| `OrgContext<R>` | Per-request context: `orgId`, `actorId`, `appId`, `role` (generic R), `permissions[]`, `requestId`, `correlationId?` |
| `DbContext` | Minimal DB operation context: `orgId`, `actorId`, `correlationId?`, `actorRole?` |
| `isOrgContext(value)` | Type guard for `OrgContext` |
| `isDbContext(value)` | Type guard for `DbContext` |
| `toDbContext(ctx)` | Extract `DbContext` from `OrgContext` |

### Context subpath — `@nzila/org/context`

Same exports as the root, for explicit import when only context types are needed.

### Invariant

`CONTEXT_ORGID_CANONICAL_001` — `orgId` is the canonical org identity field across the entire platform.

## Dependencies

None (dev-only: `typescript`, `vitest`).

## Example usage

```ts
import type { OrgContext } from '@nzila/org'

type MobilityRole = 'lead_advisor' | 'associate' | 'compliance_officer' | 'admin'

async function createCase(ctx: OrgContext<MobilityRole>, data: CaseInput) {
  // ctx.orgId is the org boundary
  // ctx.actorId is the authenticated user
  // ctx.requestId is the correlation ID
}
```

## Downstream consumers

Every app and package that requires org-scoped operations imports `OrgContext` from this package.

## Maturity

Production-grade — Stable identity contract. Zero runtime dependencies. Used by all services.
