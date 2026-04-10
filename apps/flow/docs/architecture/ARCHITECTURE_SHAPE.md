# Architecture Shape — Flow

> Domain-core architecture status for the Flow application (full commerce vertical).
> See: [APP_DOMAIN_CORE_STANDARD.md](../../../docs/architecture/APP_DOMAIN_CORE_STANDARD.md)

## Current Structure

- `lib/services/` — service files for quotes, inventory, production, suppliers
- `lib/workflows/` — workflow definitions
- `lib/schemas/` — Zod validation schemas
- `lib/repositories/` — data access layer
- `lib/control/` — Control Layer (guards, policies, decision integration)
- `lib/commands/` — CQRS command handlers
- `lib/events/` — event definitions and handlers
- `lib/integrations/` — external integrations (Shopify, Zoho)
- `lib/platform-adapters/` — platform service adapters
- `lib/quote-machine.ts` — quote lifecycle state machine
- `lib/*-service.ts` — domain services at lib/ root level
- `lib/*-actions.ts` — server action files
- `components/` — UI components
- `tests/` — test files

## Target Structure

| Layer | Status | Notes |
|-------|--------|-------|
| `domain/` | **Missing** | Types scattered across schemas/ and service files |
| `services/` | **Present** | Service directory + root-level service files |
| `workflows/` | **Present** | Workflow definitions exist |
| `commands/` | **Present** | CQRS command handlers |
| `events/` | **Present** | Event definitions and handlers |
| `control/` | **Present** | Control Layer — guards, policies, decision integration |
| `queries/` | **Missing** | Read logic mixed into services and actions |
| `ui/` | **Present** | components/ + app/ |

## Gaps

1. No `domain/` directory — types scattered across schemas/ and service files
2. Service files split between `lib/services/` and `lib/*-service.ts` root
3. `quote-machine.ts` should be in `workflows/`

## Migration Notes

- Root-level `*-service.ts` files should consolidate into `services/`
- Priority: Create `domain/` with Quote, Supplier, PO entity types
- Create `queries/` for read models currently in actions
