# @nzila/mobility-compliance

Mobility compliance workflows, risk assessment scoring, and evidence pack generation.

## Capabilities

| Area | Functions |
|------|-----------|
| **Workflows** | `initWorkflow` — compliance workflow initialization and state management |
| **Risk** | `computeRiskScore` — risk assessment scoring engine |
| **Evidence** | `buildEvidenceEntry` — evidence pack construction for compliance audits |

## Source Layout

```
src/
├── evidence.ts
├── risk.ts
├── workflows.ts
└── index.ts
```

## Exports

- `.` — barrel exports
- `./workflows` — compliance workflow management
- `./risk` — risk assessment utilities
