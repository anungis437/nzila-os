# @nzila/platform-cost

Org-scoped cost telemetry, budget enforcement, and denial-of-wallet controls. Tracks cost events, enforces budgets, and projects monthly burn rates.

## Capabilities

| Area | Functions |
|------|-----------|
| **Events** | `recordCostEvent` — record org-scoped cost events |
| **Budget** | `checkOrgBudget` — budget enforcement and threshold checks |
| **Rollup** | `computeDailyRollups` — aggregate cost data into daily rollups |
| **Projection** | `projectMonthlyBurn` — project monthly spend from current usage |

## Source Layout

```
src/
├── budget.ts
├── cost-events.ts
├── rollup.ts
└── index.ts
```

## Exports

- `.` — barrel exports
- `./rollup` — daily cost rollup computation
- `./budget` — budget enforcement
