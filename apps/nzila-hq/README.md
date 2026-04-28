# Nzila HQ

Executive intelligence cockpit for the Nzila OS portfolio. Provides portfolio-wide visibility into venture health, capital allocation, dependency risk, and financial performance across all products.

## Overview

Nzila HQ is an **internal-only** dashboard surface for founders and executive stakeholders. It aggregates signals from across the platform into a single coherent view — no raw DB mutations, just read-aggregate-report.

- **Port**: 3005 (dev)
- **Maturity**: Incubating
- **Exposure**: Internal only

## Architecture

- `server/` — Server-side data layer (DB client, repository, integrations, snapshots)
- `app/` — Next.js App Router pages + API routes
- `components/` — UI components (primitives + dashboard widgets)
- `packages/hq-domain/` — Domain intelligence engines (capital, dependency, finance, portfolio, venture)

## Development

```bash
pnpm --filter @nzila/nzila-hq dev
```

## Database

Uses a narrow `hq_*` table namespace within the shared Postgres instance. Schema in `server/db/schema.ts`. Migrations via Drizzle Kit.

```bash
pnpm --filter @nzila/nzila-hq db:generate
pnpm --filter @nzila/nzila-hq db:migrate
```

## API Routes

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/health` | GET | Public | Health probe |
| `/api/internal/billing/sync` | POST | Bearer token | Trigger Stripe + QBO sync |
| `/api/internal/snapshots/persist` | POST | Bearer token | Persist daily portfolio snapshot |

Internal routes use `NZILA_HQ_SNAPSHOT_TOKEN` bearer auth.
