# Trade

> Cross-border trade management — deals, listings, shipments, and commission tracking.

## Stack

- **Framework:** Next.js 16 (App Router)
- **Auth:** `@nzila/platform-auth` (email/password + optional Entra SSO)
- **UI:** `@nzila/ui` + Tailwind CSS + Framer Motion
- **Port:** 3009

## Quick Start

```bash
pnpm dev:trade   # or: cd apps/trade && pnpm dev
```

Copy `.env.example` → `.env.local` and fill required values:

| Variable | Purpose |
|----------|---------|
| `AUTH_SECRET` | NextAuth session secret |
| `AZURE_AD_CLIENT_ID/SECRET/TENANT_ID` | Entra SSO |
| `DATABASE_URL` | PostgreSQL connection |
| `EVIDENCE_SEAL_KEY` | HMAC key for evidence pack sealing |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OpenTelemetry (optional) |

## Key Packages

- `@nzila/trade-core` / `@nzila/trade-db` / `@nzila/trade-cars` — trade domain modules
- `@nzila/trade-adapters` — external system adapters
- `@nzila/evidence` — evidence & audit trail
- `@nzila/integrations-runtime` — third-party integration runtime

## Domain

End-to-end trade lifecycle management — deal origination, vehicle/goods listings, party management, shipment tracking, and commission settlement. Includes tamper-evident evidence sealing for compliance.
