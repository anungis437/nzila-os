# Architecture Shape — union-eyes

> Domain-core architecture status for the Union-Eyes application.
> See: [APP_DOMAIN_CORE_STANDARD.md](../../../docs/architecture/APP_DOMAIN_CORE_STANDARD.md)

## Current Structure

union-eyes has the most mature internal architecture of any Nzila OS app:

- `lib/services/` — 60+ service files including claim-workflow-fsm, claims-service, dispatch-engine
- `lib/workflows/` — workflow definitions
- `lib/queries/` — read model queries
- `lib/events/` — event bus and domain events
- `actions/` — Next.js server actions
- `components/` — UI components
- `db/` — Drizzle schemas and migrations
- `contexts/` — React context providers
- `hooks/` — React hooks

## Target Structure

| Layer | Status | Notes |
|-------|--------|-------|
| `domain/` | **Missing** | Entity types scattered across db/ and lib/types/ |
| `services/` | **Present** | Mature — 60+ files in lib/services/ |
| `workflows/` | **Present** | FSMs and lifecycle definitions |
| `queries/` | **Present** | Read models in lib/queries/ |
| `events/` | **Present** | Event bus in lib/events/ |
| `ui/` | **Present** | components/ + app/ |

## Gaps

1. **No explicit `domain/` directory** — entity types are defined inline in db schemas and service files
2. Domain types should be extracted into `domain/` as pure type definitions
3. Some API routes contain business orchestration that should be in services

## Migration Notes

- **Claim FSM** is already well-structured in `lib/services/claim-workflow-fsm.ts`
- **Event emission** was added in the staging hardening pass
- Priority: Extract canonical entity types into `domain/` layer
- Low risk — existing structure is already close to the standard
