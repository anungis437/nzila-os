# @nzila/platform-intelligence

Cross-app intelligence layer with event aggregation, operational insight generation, and signal detection.

## Capabilities

| Area | Functions |
|------|-----------|
| **Aggregator** | `aggregateEvent` — aggregate events across platform applications |
| **Insights** | `generateCrossAppInsights` — produce cross-app operational insights |
| **Signals** | `detectOperationalSignals` — detect operational signals and trends |

## Source Layout

```
src/
├── aggregator.ts
├── insights.ts
├── signals.ts
├── types.ts
└── index.ts
```

## Exports

- `.` — barrel exports
- `./types` — intelligence type definitions
- `./aggregator` — event aggregation
- `./insights` — insight generation
- `./signals` — signal detection
