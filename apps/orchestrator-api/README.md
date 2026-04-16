# Orchestrator API

> Fastify-based API server for workflow orchestration, job dispatch, and platform proof-center operations.

## Stack

- **Framework:** Fastify 5 (tsx runtime — no build step)
- **Auth:** API key (`ORCHESTRATOR_API_KEY` env var)
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

## Known Exceptions

- **No `@nzila/platform-shell`** — Fastify API server, no UI layer to wrap
- **No `@nzila/platform-auth`** — Uses API key authentication instead of session auth

See `governance/exceptions/platform-adoption-exceptions.json` for formal registration.
