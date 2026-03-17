# Architecture Shape — zonga

> Domain-core architecture status for the Zonga application.
> See: [APP_DOMAIN_CORE_STANDARD.md](../../../docs/APP_DOMAIN_CORE_STANDARD.md)

## Current Structure

- `lib/workflows/` — workflow definitions
- `lib/actions/` — server actions
- `lib/zonga-services.ts` — consolidated service logic
- `lib/payout-machine.ts` — payout lifecycle state machine
- `lib/commerce-audit.ts` — audit integration
- `components/` — UI components

## Target Structure

| Layer | Status | Notes |
|-------|--------|-------|
| `domain/` | **Missing** | No explicit domain types |
| `services/` | **Missing** | Business logic in zonga-services.ts |
| `workflows/` | **Present** | Workflow definitions exist |
| `queries/` | **Missing** | Read logic in actions and services |
| `events/` | **Missing** | No explicit event layer |
| `ui/` | **Present** | components/ + app/ |

## Gaps

1. No `domain/`, `services/`, `queries/`, or `events/` directories
2. All service logic in single `zonga-services.ts` file
3. `payout-machine.ts` should be in `workflows/`

## Migration Notes

- **Release lifecycle** is the primary domain concept
- **Payout machine** FSM should move to `workflows/`
- `zonga-services.ts` should be decomposed into `services/` directory
- Priority: Create domain types for Release, Creator, Listener, Payout
