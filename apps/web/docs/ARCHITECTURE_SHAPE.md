# Architecture Shape — web

> Domain-core architecture status for the Web application.
> See: [APP_DOMAIN_CORE_STANDARD.md](../../../docs/APP_DOMAIN_CORE_STANDARD.md)

## Current Structure

- `lib/api-guards.ts` — API authentication guards
- `lib/docs.ts` — documentation utilities
- `lib/logger.ts` — logging
- `lib/sanitize.ts` — input sanitization
- `lib/policy-enforcement.ts` — policy enforcement
- `lib/demoSeed.ts` — demo seed data
- `components/` — UI components

## Target Structure (Lighter Alignment)

The web app is the primary user-facing portal. It has lighter domain-core needs
because most business logic lives in domain-specific apps (union-eyes, flow, etc.).

| Layer | Status | Notes |
|-------|--------|-------|
| `domain/` | **N/A** | Web delegates domain logic to vertical apps |
| `services/` | **Minimal** | Thin service layer for portal-level operations |
| `workflows/` | **N/A** | No lifecycle state machines |
| `queries/` | **N/A** | Read logic delegates to app APIs |
| `events/` | **N/A** | Consumes events, does not own domain events |
| `ui/` | **Present** | components/ + app/ |

## Gaps

None significant — web app's primary role is authentication, navigation, and delegation.

## Migration Notes

- Web app alignment is intentionally light
- Focus on platform contract compliance (health, metrics adapters)
- No structural migration needed beyond contract adapters
