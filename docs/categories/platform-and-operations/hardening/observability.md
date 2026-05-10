# Observability & OpenTelemetry Baseline

**PR 12 — Hardening Pass**  
**Status**: Implemented  
**Owner**: `@nzila/platform`

---

## Summary

This document describes the OpenTelemetry (OTel) observability baseline for all Nzila services — trace propagation, metric collection, and the correlation between distributed traces and audit events.

---

## Instrumentation Architecture

```
Browser / Client
      │ (HTTP headers: traceparent, tracestate)
      ▼
Next.js / Fastify Service
      │ @nzila/os-core/telemetry/otel
      │ → creates new Span (or continues incoming trace context)
      │ → attaches orgId, userId, correlationId as span attributes
      ▼
OTLP Exporter (HTTP/gRPC)
      │
      ▼
Azure Monitor / OpenTelemetry Collector
```

---

## Trace Context Propagation

### Incoming Requests

All services accept the W3C `traceparent` and `tracestate` headers. This is automatic with the OTLP SDK.

**Fastify**: Add `@opentelemetry/instrumentation-fastify` to the orchestrator:

```typescript
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify'
```

**Next.js**: Use `instrumentation.ts` at app root:

```typescript
// apps/console/instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initOtel } = await import('@nzila/os-core/telemetry/otel')
    initOtel('console')
  }
}
```

### Outgoing Requests

Downstream `fetch()` calls must propagate trace context. Use the fetch instrumentation auto-injector:

```typescript
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch'
```

---

## Span Attributes Convention

| Attribute | Where | Description |
|-----------|-------|-------------|
| `nzila.org_id` | All business spans | Opaque entity identifier (never PII) |
| `nzila.app` | All spans | App name (console, partners, …) |
| `nzila.action_type` | AI action spans | e.g., `finance.generate_stripe_monthly_reports` |
| `nzila.risk_tier` | AI action spans | low / medium / high |
| `http.route` | HTTP spans | Route template, e.g., `/api/payments/[id]` |
| `db.system` | DB query spans | `postgresql` |

---

## Health & Readiness

All health endpoints (`/api/health`, `/health`) should emit a `health.check` span with latency. This allows SLO tracking on health check responsiveness.

---

## Alerts (Azure Monitor)

| Alert | Threshold | Severity |
|-------|-----------|----------|
| Error rate > 5% over 5 min | `traces \| where resultCode >= 500` | P2 |
| p95 latency > 2s for 5 min | `performanceCounters` | P3 |
| Audit chain verification failed | Custom event: `audit.chain_broken` | P1 |
| Rate limit hit > 100 times in 1 min | Custom event: `rate_limit.exceeded` | P3 |

---

## Current Status

| Component | Status |
|-----------|--------|
| OTel SDK init (`@nzila/os-core/telemetry/otel`) | ✅ Implemented |
| OTLP exporter to Azure Monitor | ✅ Implemented |
| Next.js `instrumentation.ts` wired up | ⏳ Pending (PR 12 follow-up) |
| Fastify instrumentation plugin | ⏳ Pending |
| Distributed trace context headers | ⏳ Pending |
| SLO dashboards | ⏳ Future |

---

*Part of the Nzila Hardening Pass — Phase 3 (PR 12)*
