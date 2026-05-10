# Platform Observability — Architecture

> Package: `@nzila/platform-observability`

## Overview

Correlation IDs, structured tracing, Prometheus-compatible metrics, and health-check builder. Integrates with the existing `@nzila/os-core/telemetry` logger.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│              Platform Observability                   │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  Correlation  │  │  Span/Trace  │  │  Health    │ │
│  │  Context      │  │  (W3C TC)    │  │  Checker   │ │
│  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘ │
│         │                 │                │        │
│  ┌──────▼─────────────────▼────────────────▼──────┐ │
│  │            Metrics Registry                     │ │
│  │   Counter / Gauge / Histogram / Prometheus      │ │
│  └────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

## Modules

### Correlation Context

- **Trace ID**: 32-char hex, generated or extracted from `x-trace-id` header
- **Span ID**: 16-char hex, generated or extracted from `traceparent`
- **Request ID**: UUID v4
- **Org ID**: Extracted from `x-org-id` header
- **Priority**: `x-trace-id` > `traceparent` > auto-generate
- **W3C Trace Context**: Full `traceparent` parsing/emission (`00-{traceId}-{spanId}-01`)
- **Child contexts**: `createChildContext()` sets `parentSpanId`

### Metrics

- **Counter**: Monotonically increasing, supports `inc(delta)`, `get()`, `reset()`
- **Gauge**: Bi-directional, supports `set(value)`, `inc()`, `dec()`
- **Histogram**: Observation-based, supports `observe(value)`, `percentile(fraction)`, `count()`, `sum()`
- **MetricsRegistry**: Centralized registry with duplicate-name deduplication
- **Prometheus**: `renderPrometheus()` text exposition format with `# HELP` and `# TYPE` annotations

### Span/Trace

- Lightweight `Span` class compatible with OpenTelemetry concepts
- Auto-generated `spanId`/`traceId`
- Attributes, events, error recording
- Child span creation
- `trace(operation, fn)` helper for automatic span lifecycle

### Health Checker

- Register named health checks with `addCheck()`
- Critical vs non-critical distinction
- Configurable timeout per check
- Overall status derivation: `healthy` / `degraded` / `down`
- Structured `HealthReport` output

## Integration Points

| System | Integration |
|---|---|
| `@nzila/os-core/telemetry` | Logger injects `traceId`/`requestId` |
| `@nzila/platform-ops` | Health digest consumption |
| HTTP middleware | `extractCorrelationContext(headers)` + `buildCorrelationHeaders(ctx)` |

## Test Coverage

51 tests across 4 test files:

- Correlation: 12 tests (trace ID extraction, W3C traceparent, org ID, child context)
- Metrics: 20 tests (counter, gauge, histogram, registry, Prometheus rendering)
- Span: 12 tests (lifecycle, attributes, events, errors, children, trace helper)
- Health: 7 tests (registration, timeout, critical/non-critical, status derivation)
