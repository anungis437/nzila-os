# Architecture Shape — shop-quoter

> Domain-core architecture status for the Shop-Quoter application.
> See: [APP_DOMAIN_CORE_STANDARD.md](../../../docs/APP_DOMAIN_CORE_STANDARD.md)

## Current Structure

- `lib/services/` — service files for quotes, inventory, production, suppliers
- `lib/workflows/` — workflow definitions
- `lib/schemas/` — Zod validation schemas
- `lib/repositories/` — data access layer
- `lib/quote-machine.ts` — quote lifecycle state machine
- `lib/*-service.ts` — various domain services at lib/ root level
- `lib/*-actions.ts` — server action files
- `components/` — UI components
- `tests/` — test files

## Target Structure

| Layer | Status | Notes |
|-------|--------|-------|
| `domain/` | **Missing** | Types scattered across schemas/ and service files |
| `services/` | **Present** | Service directory + root-level service files |
| `workflows/` | **Present** | Workflow definitions exist |
| `queries/` | **Missing** | Read logic mixed into services and actions |
| `events/` | **Missing** | Event emission via config-events.ts at root |
| `ui/` | **Present** | components/ + app/ |

## Gaps

1. No `domain/` or `queries/` directories
2. Service files split between `lib/services/` and `lib/*-service.ts` root
3. `quote-machine.ts` should be in `workflows/`
4. Event configuration in `config-events.ts` should be in `events/`

## Migration Notes

- **Quote lifecycle FSM** (`quote-machine.ts`) is the highest-value migration target
- Root-level `*-service.ts` files should consolidate into `services/`
- Priority: Create `domain/` with Quote, Supplier, PO entity types
- Create `queries/` for read models currently in actions
- Move `config-events.ts` into `events/`
