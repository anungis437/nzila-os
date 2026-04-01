# NzilaOS / UnionEyes — Final Defensibility Pass: Implementation Plan

> One-train, no-iterations. All 5 platform layers delivered end-to-end.

---

## Discovery Baseline

### Existing Infrastructure

| Layer | Package(s) | Status |
|---|---|---|
| **Event Bus** | `@nzila/commerce-events` (in-memory, typed, saga), `@nzila/integrations-core` (30+ event types) | Commerce-only; no unified platform bus |
| **Integrations** | `@nzila/integrations-core`, `@nzila/integrations-runtime` (dispatcher, retry, circuit breaker, DLQ, rate-limit, chaos, SLO), `@nzila/integrations-db` (5 tables) | Mature but no control-plane surface |
| **Observability** | `@nzila/os-core/telemetry` (JSON logger, PII redaction, requestContext), `@nzila/platform-metrics`, `@nzila/platform-ops` (health, trends, alerts, ops-score) | No correlation middleware, no OpenTelemetry, no /metrics |
| **Evidence** | `@nzila/os-core/evidence` (seal, Merkle, builder, verify, lifecycle, redaction, 7 collectors), `@nzila/evidence` (slim re-export), `@nzila/commerce-evidence` | Full seal/verify system; needs export orchestration layer |
| **Compliance** | `@nzila/db/schema/operations` (audit_events, evidence_packs), `@nzila/platform-proof` | No immutable chained compliance snapshots |
| **DB** | Drizzle ORM 0.39, 20+ schema files, 7 migrations | Tables ready for new platform schemas |
| **Console** | Next.js 16.1.6, 28 nav items, dashboard routes | Ready for new sections |
| **Contract Tests** | 130+ structural invariant tests in `tooling/contract-tests/` | Pattern established |
| **Ops Policies** | SLO, integration, perf budgets, cost, dependency | Consumption-ready |

---

## Phase B: `packages/platform-events`

**Goal:** Canonical domain event envelope + typed bus for all verticals.

### Files to Create
- `packages/platform-events/package.json`
- `packages/platform-events/tsconfig.json`
- `packages/platform-events/vitest.config.ts`
- `packages/platform-events/src/index.ts` — barrel
- `packages/platform-events/src/types.ts` — `PlatformEvent<T>`, `EventEnvelope`, `EventMetadata`
- `packages/platform-events/src/schema.ts` — Zod schemas for envelope validation
- `packages/platform-events/src/bus.ts` — `PlatformEventBus` (typed, in-memory, swappable)
- `packages/platform-events/src/store.ts` — `EventStore` (Drizzle-backed persistence to `platform_events` table)
- `packages/platform-events/src/dispatcher.ts` — async fan-out with error isolation
- `packages/platform-events/src/__tests__/bus.test.ts`
- `packages/platform-events/src/__tests__/store.test.ts`

### DB Schema Addition
- Add `platformEvents` table to `packages/db/src/schema/platform.ts`

### Design Decisions
- Extends `DomainEvent` pattern from commerce-events but adds: `source`, `schemaVersion`, `traceId`, `causationId`
- Compatible with existing `InMemoryEventBus` — same subscribe/emit pattern
- Port pattern for persistence (inject store or use in-memory)

---

## Phase C: `packages/platform-integrations-control-plane`

**Goal:** Admin/ops surface over the existing integrations infrastructure.

### Files to Create
- `packages/platform-integrations-control-plane/package.json`
- `packages/platform-integrations-control-plane/tsconfig.json`
- `packages/platform-integrations-control-plane/vitest.config.ts`
- `packages/platform-integrations-control-plane/src/index.ts` — barrel
- `packages/platform-integrations-control-plane/src/types.ts` — control plane types
- `packages/platform-integrations-control-plane/src/registry.ts` — provider registry + health dashboard
- `packages/platform-integrations-control-plane/src/webhook-verify.ts` — HMAC-SHA256 verification
- `packages/platform-integrations-control-plane/src/dlq.ts` — DLQ management (replay, purge, inspect)
- `packages/platform-integrations-control-plane/src/rate-limiter.ts` — org-scoped rate limiting
- `packages/platform-integrations-control-plane/src/dashboard.ts` — integration health summary
- `packages/platform-integrations-control-plane/src/__tests__/registry.test.ts`
- `packages/platform-integrations-control-plane/src/__tests__/webhook-verify.test.ts`
- `packages/platform-integrations-control-plane/src/__tests__/dlq.test.ts`

### Console Surfaces
- `apps/console/app/(dashboard)/integrations-control-plane/page.tsx`
- `apps/console/app/(dashboard)/integrations-control-plane/dlq/page.tsx`

### Dependencies
- `@nzila/integrations-core`, `@nzila/integrations-runtime`, `@nzila/integrations-db`, `@nzila/db`, `zod`

---

## Phase D: `packages/platform-observability`

**Goal:** Correlation IDs, structured tracing, metrics endpoint.

### Files to Create
- `packages/platform-observability/package.json`
- `packages/platform-observability/tsconfig.json`
- `packages/platform-observability/vitest.config.ts`
- `packages/platform-observability/src/index.ts` — barrel
- `packages/platform-observability/src/types.ts` — trace context types
- `packages/platform-observability/src/correlation.ts` — correlation ID middleware (X-Request-Id, X-Trace-Id propagation)
- `packages/platform-observability/src/metrics.ts` — in-memory metrics registry + Prometheus text exposition
- `packages/platform-observability/src/span.ts` — lightweight span/trace API (compatible with OpenTelemetry W3C Trace Context)
- `packages/platform-observability/src/health.ts` — standard health-check builder
- `packages/platform-observability/src/__tests__/correlation.test.ts`
- `packages/platform-observability/src/__tests__/metrics.test.ts`
- `packages/platform-observability/src/__tests__/span.test.ts`

### Integration Points
- Works with existing `@nzila/os-core/telemetry` logger (injects traceId/requestId)
- Works with existing `@nzila/platform-ops` health-digest

---

## Phase E: `packages/platform-evidence-pack`

**Goal:** Orchestrated evidence pack export with tamper-verification.

### Files to Create
- `packages/platform-evidence-pack/package.json`
- `packages/platform-evidence-pack/tsconfig.json`
- `packages/platform-evidence-pack/vitest.config.ts`
- `packages/platform-evidence-pack/src/index.ts` — barrel
- `packages/platform-evidence-pack/src/types.ts` — pack export types
- `packages/platform-evidence-pack/src/orchestrator.ts` — evidence pack generation orchestrator
- `packages/platform-evidence-pack/src/exporter.ts` — multi-format export (JSON, PDF-ready, CSV)
- `packages/platform-evidence-pack/src/verifier.ts` — pack integrity verification (wraps os-core seal)
- `packages/platform-evidence-pack/src/retention.ts` — retention policy enforcement
- `packages/platform-evidence-pack/src/__tests__/orchestrator.test.ts`
- `packages/platform-evidence-pack/src/__tests__/verifier.test.ts`

### Console Surfaces
- `apps/console/app/(dashboard)/evidence-packs/page.tsx`

### Dependencies
- `@nzila/os-core` (evidence seal, logger), `@nzila/db` (evidence_packs, evidence_pack_artifacts), `zod`

---

## Phase F: `packages/platform-compliance-snapshots`

**Goal:** Immutable, chained compliance snapshots for audit readiness.

### Files to Create
- `packages/platform-compliance-snapshots/package.json`
- `packages/platform-compliance-snapshots/tsconfig.json`
- `packages/platform-compliance-snapshots/vitest.config.ts`
- `packages/platform-compliance-snapshots/src/index.ts` — barrel
- `packages/platform-compliance-snapshots/src/types.ts` — snapshot types
- `packages/platform-compliance-snapshots/src/schema.ts` — Zod schemas + DB table for snapshots
- `packages/platform-compliance-snapshots/src/collector.ts` — cross-system state collector
- `packages/platform-compliance-snapshots/src/chain.ts` — SHA-256 hash chain (immutable append)
- `packages/platform-compliance-snapshots/src/generator.ts` — snapshot generation engine
- `packages/platform-compliance-snapshots/src/verifier.ts` — chain integrity verification
- `packages/platform-compliance-snapshots/src/__tests__/chain.test.ts`
- `packages/platform-compliance-snapshots/src/__tests__/generator.test.ts`
- `packages/platform-compliance-snapshots/src/__tests__/verifier.test.ts`

### DB Schema Addition
- Add `platformComplianceSnapshots` table to `packages/db/src/schema/platform.ts`

### Console Surfaces
- `apps/console/app/(dashboard)/compliance-snapshots/page.tsx`

---

## Phase G: Contract Tests

### New Contract Test Files
- `tooling/contract-tests/platform-events-invariants.test.ts`
- `tooling/contract-tests/platform-control-plane-invariants.test.ts`
- `tooling/contract-tests/platform-observability-invariants.test.ts`
- `tooling/contract-tests/platform-evidence-invariants.test.ts`
- `tooling/contract-tests/platform-compliance-invariants.test.ts`

### Invariants Enforced
1. All platform packages have `package.json`, `tsconfig.json`, `vitest.config.ts`
2. No `console.*` in source files (must use structured logger)
3. No `any` type assertions in source files
4. All exports are typed (no default exports without types)
5. Zod schemas present for all external-facing types
6. No direct DB imports in service layers (port pattern)
7. "org" usage, never "tenant"
8. Event envelope schema validated
9. Evidence pack seal schema validated
10. Compliance snapshot chain integrity validated

---

## Phase H: Docs & Wow Pack

- `docs/platform-readiness.md` — update with new layers
- `docs/architecture/platform-event-bus.md`
- `docs/architecture/integration-control-plane.md`
- `docs/architecture/observability.md`
- `docs/architecture/evidence-packs.md`
- `docs/architecture/compliance-snapshots.md`

---

## Hard Rules (enforced in every file)

1. **"org" everywhere** — never "tenant"
2. **Strict TypeScript** — no `any`, no `as any`, no `@ts-ignore`
3. **Zod validation** on all external boundaries
4. **No `console.*`** — use `createLogger` from `@nzila/os-core/telemetry`
5. **Layered architecture** — ports/adapters, no direct DB in services
6. **Audit events** on all mutations
7. **Evidence packs** for compliance-relevant operations
8. **Tests + docs + console + exports** for every capability
