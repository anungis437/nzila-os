# Zonga

> Africa-first music distribution, streaming, and royalty management platform.

## Stack

- **Framework:** Next.js 16 (App Router + Turbopack)
- **Auth:** `@nzila/platform-auth` (email/password + optional Entra SSO)
- **UI:** `@nzila/ui` + Tailwind CSS + Framer Motion
- **Monitoring:** Sentry
- **Port:** 3011 (dev) / 3006 (production)

## Quick Start

```bash
pnpm dev:zonga   # or: cd apps/zonga && pnpm dev
```

Copy `.env.example` → `.env.local` and fill required values:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection |
| `AUTH_SECRET` | NextAuth session secret |
| `AZURE_AD_CLIENT_ID/SECRET/TENANT_ID` | Entra SSO |
| `STRIPE_SECRET_KEY` | Payments & payouts (optional) |
| `BLOB_CONNECTION_STRING` | Azure Blob for audio storage (optional) |

## Key Docs

- [docs/AFRICA_FIRST_COMMERCIAL_MODEL.md](docs/AFRICA_FIRST_COMMERCIAL_MODEL.md) — commercial strategy
- [docs/DOMAIN_MODEL.md](docs/DOMAIN_MODEL.md) — domain model reference
- [docs/MONETIZATION_MODEL.md](docs/MONETIZATION_MODEL.md) — monetization & pricing
- [docs/ROYALTY_AND_PAYOUT_TRUST.md](docs/ROYALTY_AND_PAYOUT_TRUST.md) — royalty distribution
- [docs/ZONGA-END-TO-END-WORKFLOW.md](docs/ZONGA-END-TO-END-WORKFLOW.md) — full workflow guide
- [docs/GOVERNANCE_POLICY.md](docs/GOVERNANCE_POLICY.md) — content governance
- [docs/PILOT_DEMO_GUIDE.md](docs/PILOT_DEMO_GUIDE.md) — demo walkthrough

## Key Packages

- `@nzila/zonga-core` / `@nzila/zonga-control-plane` — domain logic & control plane
- `@nzila/zonga-intelligence` — ML-powered recommendations
- `@nzila/zonga-payments` / `@nzila/payments-stripe` — payment processing
- `@nzila/ai-sdk` / `@nzila/ml-sdk` — AI features

## Domain

Music industry platform covering artist onboarding, track/release management, catalog browsing, playlist curation, podcast hosting, royalty calculation & payout, subscription management, content moderation, and analytics — built for the African music ecosystem.
