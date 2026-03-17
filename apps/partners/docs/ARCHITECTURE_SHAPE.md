# Architecture Shape — partners

> Domain-core architecture status for the Partners application.
> See: [APP_DOMAIN_CORE_STANDARD.md](../../../docs/APP_DOMAIN_CORE_STANDARD.md)

## Current Structure

- `lib/actions/` — server actions
- `lib/partner-auth.ts` — partner authentication
- `lib/payments.ts` — payment processing
- `lib/tier-gates.ts` — tier gating logic
- `lib/policy-enforcement.ts` — policy enforcement
- `components/` — UI components

## Target Structure

| Layer | Status | Notes |
|-------|--------|-------|
| `domain/` | **Missing** | Partner types not centralized |
| `services/` | **Missing** | Business logic in root lib/ files |
| `workflows/` | **Missing** | Onboarding lifecycle not explicit |
| `queries/` | **Missing** | Read logic in actions |
| `events/` | **Missing** | No event layer |
| `ui/` | **Present** | components/ + app/ |

## Gaps

1. No canonical layer directories
2. All business logic at lib/ root level
3. Partner onboarding lifecycle not modeled as a workflow

## Migration Notes

- **Partner onboarding lifecycle** is the primary workflow target
- `tier-gates.ts` contains workflow-like gating logic → `workflows/`
- `payments.ts`, `partner-auth.ts` → `services/`
- Priority: Create domain types for Partner, Contract, Commission, Tier
