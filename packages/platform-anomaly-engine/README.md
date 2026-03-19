# @nzila/platform-anomaly-engine

Anomaly detection engine with pluggable detectors and configurable rules for grievance spikes, financial irregularities, and pricing outliers.

## Capabilities

| Area | Functions |
|------|-----------|
| **Detectors** | `detectGrievanceSpike`, `detectFinancialIrregularity`, `detectPricingOutlier` — domain-specific anomaly detectors |
| **Rules** | `getDefaultRules` — configurable detection rule sets |

## Source Layout

```
src/
├── detectors.ts
├── rules.ts
├── types.ts
└── index.ts
```

## Exports

- `.` — barrel exports
- `./types` — anomaly type definitions
- `./detectors` — pluggable anomaly detectors
- `./rules` — detection rule configuration
