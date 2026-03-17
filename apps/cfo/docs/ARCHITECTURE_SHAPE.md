# Architecture Shape — cfo

> Domain-core architecture status for the CFO application.
> See: [APP_DOMAIN_CORE_STANDARD.md](../../../docs/APP_DOMAIN_CORE_STANDARD.md)

## Current Structure

- `lib/actions/` — server actions
- `lib/workflow-automation.ts` — workflow automation logic
- `lib/workflow-templates.ts` — workflow template definitions
- `lib/advisory-automation.ts` — advisory automation
- `lib/policy-enforcement.ts` — policy enforcement
- `lib/fx.ts`, `lib/tax.ts`, `lib/qbo.ts` — financial integrations
- `components/` — UI components

## Target Structure

| Layer | Status | Notes |
|-------|--------|-------|
| `domain/` | **Missing** | Financial types scattered across lib/ |
| `services/` | **Missing** | Business logic in root lib/ files |
| `workflows/` | **Missing** | Workflow logic in workflow-automation.ts |
| `queries/` | **Missing** | Read logic in actions |
| `events/` | **Missing** | No explicit event layer |
| `ui/` | **Present** | components/ + app/ |

## Gaps

1. No canonical layer directories exist
2. Business logic distributed across root-level lib/ files
3. Workflow logic not in dedicated workflow directory

## Migration Notes

- **Financial report lifecycle** is the primary domain workflow
- `workflow-automation.ts` and `workflow-templates.ts` → `workflows/`
- `advisory-automation.ts`, `policy-enforcement.ts` → `services/`
- `fx.ts`, `tax.ts`, `qbo.ts` → `services/` (integration services)
- Priority: Create domain types for FinancialReport, Adjustment, Export
