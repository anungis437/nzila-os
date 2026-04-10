# @nzila/cora

> Agricultural intelligence dashboard — yield forecasting, price signals, risk analysis, cooperative performance, and impact traceability.

## Stack

- **Framework:** Next.js 16 (App Router)
- **Auth:** `@nzila/platform-auth` (email/password + optional Entra SSO)
- **UI:** `@nzila/ui` + Tailwind CSS
- **Packages:** `@nzila/agri-core`, `agri-db`, `agri-forecasting`, `agri-intelligence`, `agri-provenance`, `agri-supply-chain`, `agri-traceability`
- **Port:** 3006

## Quick Start

```bash
pnpm dev:cora         # or: cd apps/cora && pnpm dev
```

Copy `.env.example` → `.env.local` and fill required values.

### Required Env Vars

| Variable | Purpose |
|---|---|
| `AUTH_SECRET` | NextAuth session encryption |
| `AZURE_AD_*` | Entra SSO (optional) |
| `DATABASE_URL` | PostgreSQL (read-only recommended) |
| `OTEL_*` | OpenTelemetry (optional) |

## Dashboard Modules

`yield-forecast` · `price-signals` · `risk-and-resilience` · `cooperative-performance` · `impact-and-traceability` · `data-sources`

## Domain

Cora is the read-only analytics companion to Agrimo — providing agricultural intelligence dashboards for yield forecasting, price signal monitoring, risk/resilience assessment, cooperative performance metrics, and supply-chain impact traceability.
