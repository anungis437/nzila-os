# @nzila/platform-performance

Request-level metrics tracking, performance envelope validation, and synthetic load testing for the NzilaOS platform.

## Capabilities

| Area | Functions |
|------|-----------|
| **Metrics** | `trackRequestMetrics` — request-level latency and throughput tracking |
| **Scale Harness** | `runScaleEnvelope` — synthetic load testing and scale envelope validation |
| **Reports** | `generateScaleReport` — performance test result reporting |

## Source Layout

```
src/
├── metrics.ts
├── scale-harness.ts
├── scale-report.ts
└── index.ts
```

## Exports

- `.` — barrel exports
- `./scale-harness` — load testing harness
- `./scale-report` — scale report generation
