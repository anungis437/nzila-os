# Orchestrator API

> Fastify-based API server for workflow orchestration, job dispatch, and platform proof-center operations.

## Stack

- **Framework:** Fastify 5 (tsx runtime — no build step)
- **Auth:** API key + org/actor scope headers on mutation endpoints
- **DB:** Drizzle ORM + postgres.js
- **Port:** 4000

## Quick Start

```bash
cd apps/orchestrator-api && pnpm dev    # tsx watch mode
```

Copy `.env` and fill required values (`ORCHESTRATOR_API_KEY`, `DATABASE_URL`).

## Routes

| Path | Purpose |
|------|---------|
| `/health` | Health check |
| `/commands` | Command dispatch |
| `/workflows` | Workflow management |
| `/jobs` | Background job orchestration |
| `/runs` | Automation run tracking |
| `/execute` | Canonical execution lifecycle (submit, query, retry, cancel) |
| `/proof-center` | Procurement proof operations |
| `/metrics` | Telemetry metrics |
| `/status` | System status |

## Key Packages

- `@nzila/platform-event-fabric` — event bus integration
- `@nzila/platform-procurement-proof` — evidence & proof artifacts
- `@nzila/platform-observability` — OpenTelemetry tracing

## Domain

Central orchestration service for the Nzila platform. Handles workflow dispatch, job scheduling, automation run tracking, and procurement proof-center operations. Protected by API key auth and Helmet security headers with rate limiting.

## Environment Variables

See `.env.example` in this directory. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `ORCHESTRATOR_API_KEY` | Yes | API key for authenticating requests |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | OpenTelemetry collector endpoint |

## Execution Contract

- `POST /execute` is the only authoritative workflow submission endpoint.
- Non-dry-run submissions require `authorizationDecisionId` from Control Plane.
- Execution requests must include `x-org-id` and `x-actor-id` headers and match body scope.
- Idempotency is DB-native and enforced by unique key `(org_id, idempotency_key)`.
- Lifecycle transitions are guarded by explicit FSM rules (`pending -> approved/dispatched/cancelled/failed/succeeded`, etc.).
- State transitions use optimistic concurrency (`version`) and reject stale writes.
- Multi-instance ownership is coordinated with per-run leases (`execution_owner`, `lease_expires_at`, heartbeat timestamps).
- Recovery loop automatically re-queues abandoned runs after restart/instance failure.

## Execution Endpoints

| Method | Path | Notes |
|------|------|------|
| `POST` | `/execute` | Create or dedupe run by org + idempotency key |
| `GET` | `/execute/:runId` | Fetch a single execution run |
| `GET` | `/execute` | List runs (supports `orgId`, `workflowId`, `status`, `limit`) |
| `POST` | `/execute/:runId/retry` | Retry failed/dead-letter run (role/scoped) |
| `POST` | `/execute/:runId/cancel` | Cancel active run (role/scoped) |

## Runtime Semantics

- Duplicate requests in the same org return the original run (`idempotent: true`) without creating a second command.
- Retries use bounded exponential backoff and classify failures into contract-level failure classes.
- Exhausted retries are represented as terminal `failed` state with `result.deadLettered=true`.
- Every transition emits append-only automation events for timeline/audit reconstruction.

## Metrics

`GET /metrics` exposes both API telemetry and execution KPIs:

- `queue_depth`
- `p95_latency_ms`
- `failure_rate`
- `retries_total`
- `stuck_count`

These metrics are used by the operator console to surface active, failed/dead-letter, and stuck runs.

## Known Exceptions

- **No `@nzila/platform-shell`** — Fastify API server, no UI layer to wrap.

See `governance/exceptions/platform-adoption-exceptions.json` for formal registration.
