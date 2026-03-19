# @nzila/platform-rum

Real User Monitoring — Web Vitals collection with OpenTelemetry export. Captures Core Web Vitals (LCP, FID, CLS, FCP, TTFB) and exports to the platform observability stack.

## Capabilities

| Area | Functions |
|------|-----------|
| **Web Vitals** | `initWebVitals`, `flushWebVitals` — Core Web Vitals collection |
| **Reporter** | `processRUMBatch`, `handleRUMBeacon` — server-side RUM data processing |

## Source Layout

```
src/
├── reporter.ts
├── types.ts
├── web-vitals.ts
├── index.ts
└── __tests__/
```

## Exports

- `.` — barrel exports
- `./web-vitals` — client-side Web Vitals collection
- `./reporter` — server-side RUM processing
- `./types` — RUM type definitions
