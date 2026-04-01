# Architecture Shape — control-plane

> Domain-core architecture status for the Control Plane application.
> See: [APP_DOMAIN_CORE_STANDARD.md](../../../docs/architecture/APP_DOMAIN_CORE_STANDARD.md)

## Current Structure

- `lib/api-auth.ts` — API authentication
- `lib/utils.ts` — utility functions
- `lib/demoSeed.ts` — demo seed data
- `app/api/control-plane/` — API routes for platform operations
- `app/(dashboard)/` — dashboard pages

## Target Structure (Adapted)

The control-plane is not a domain app — it is an operating shell. Its domain-core
adoption is adapted to fit its orchestration role.

| Layer | Status | Notes |
|-------|--------|-------|
| `domain/` | **N/A** | Control Plane orchestrates, does not own domain entities |
| `services/` | **Missing** | Summary/query orchestration in route handlers |
| `workflows/` | **N/A** | No lifecycle state machines — uses platform workflows |
| `queries/` | **Missing** | Summary queries embedded in API routes |
| `events/` | **N/A** | Consumes platform events, does not own domain events |
| `ui/` | **Present** | app/(dashboard)/ pages |

## Gaps

1. Summary/aggregation queries embedded directly in API route handlers
2. No service layer — orchestration logic lives in routes

## Migration Notes

- Extract summary queries from API routes into `queries/`
- Extract orchestration logic into `services/` where it coordinates multiple platform packages
- `domain/` and `workflows/` are not applicable — control-plane does not own domain state
- Priority: Separate read-model queries from route handlers
