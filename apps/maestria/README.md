# Maestria

Premium Canadian SME operating system built on Flow Engine. Maestria provides a portfolio-grade commerce and operations platform for small and medium-sized enterprises, with integrated flow automation, connector management, and AI-assisted readiness tooling.

- **Port**: 3021
- **Stack**: Next.js 16 + next-intl + Flow Engine
- **Auth**: `@nzila/platform-auth` (email/password + Entra SSO)
- **Persistence**: SQLite (`MAESTRIA_DB_PATH`)
- **Portfolio Tier**: 4 (incubating / internal-only)

## Getting Started

```bash
# Install dependencies (from repo root)
pnpm install

# Start development server
pnpm dev
# or, from this directory:
pnpm --filter @nzila/maestria dev
```

Open [http://localhost:3021](http://localhost:3021).

Copy `.env.example` to `.env.local` and fill in the required values before starting.

## Environment Variables

See [`.env.example`](./.env.example) for the full list of required and optional variables.

## Key Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start development server on port 3021 |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript type check |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm db:backup` | Backup SQLite database |
| `pnpm db:restore` | Restore SQLite database from backup |
| `pnpm onboarding:readiness` | Run GA readiness checks |
| `pnpm assets:screenshots` | Capture app screenshots |

## Architecture

Maestria is a multi-locale Next.js application structured around locale-scoped route groups:

- `app/[locale]/marketing/` — Public-facing marketing pages
- `app/[locale]/client/` — Client portal (authenticated)
- `app/[locale]/demo/` — Demo / sandbox environment
- `app/[locale]/internal/` — Internal tooling and admin
- `app/api/` — API routes (connectors, contact, readiness, etc.)

The app integrates `@nzila/flow-engine` for workflow orchestration and exposes connector status/management endpoints.

## Docs

- [`docs/COMMERCIAL-PACK.md`](./docs/COMMERCIAL-PACK.md) — Commercial packaging and GTM posture

## Related

- [Flow Engine package](../../packages/flow-engine/)
- [Platform Auth package](../../packages/platform-auth/)
