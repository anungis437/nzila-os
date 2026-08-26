# Trade

> Cross-border trade infrastructure: deals, financing states, listings,
> shipments, parties, commissions, invoices, and settlement with tamper-
> evident evidence sealing. Trade sits alongside — not as a replacement for
> — the 3CUO/DiasporaCore banking heritage.

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

End-to-end cross-border trade lifecycle: deal origination, financing states,
vehicle and goods listings, party management, shipment tracking, invoicing,
and commission settlement, with tamper-evident evidence sealing for
compliance.

**Portfolio boundary.** Trade covers cross-border trade and commercial-deal
infrastructure. It is distinct from — not a successor to — the
3CUO / DiasporaCore banking heritage (retail/business banking, lending,
remittances, cards, KYC/AML admin, fraud & disputes, member administration).
See `docs/categories/platform-and-operations/migration/app-alignment/3cuo.md`.
