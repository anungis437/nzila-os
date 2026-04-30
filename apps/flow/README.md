# @nzila/flow

> Commerce vertical — end-to-end order management, quoting, invoicing, inventory, supplier management, and Shopify/Zoho integrations.

## Stack

- **Framework:** Next.js 16 (App Router)
- **Auth:** `@nzila/platform-auth` (email/password + optional Entra SSO)
- **UI:** `@nzila/ui` + Tailwind CSS v4
- **AI:** `@nzila/ai-sdk`
- **Packages:** `@nzila/commerce-core`, `commerce-db`, `commerce-services`, `commerce-audit`, `pricing-engine`, `@nzila/flow-engine`, `platform-contracts`, `platform-policy-engine`
- **Port:** 3007
- **Seeding:** `pnpm demo:seed` / `pnpm seed:staging`

## Quick Start

```bash
pnpm dev:flow         # or: cd apps/flow && pnpm dev
```

Copy `.env.example` → `.env.local` and fill required values.

### Required Env Vars

| Variable | Purpose |
|---|---|
| `AUTH_SECRET` | NextAuth session encryption |
| `AZURE_AD_*` | Entra SSO (optional) |
| `NEXT_PUBLIC_CONSOLE_URL` | Console cross-link |
| `NEXT_PUBLIC_WEB_URL` | Web app cross-link |

## Key Docs

- [docs/ARCHITECTURE_SHAPE.md](docs/ARCHITECTURE_SHAPE.md) — Architecture overview
- [docs/DOMAIN_MODEL.md](docs/DOMAIN_MODEL.md) / [DOMAIN_MODEL_HARDENED.md](docs/DOMAIN_MODEL_HARDENED.md) — Domain model
- [docs/WORKFLOW_MODEL.md](docs/WORKFLOW_MODEL.md) — Workflow state machines
- [docs/RUNBOOK.md](docs/RUNBOOK.md) — Operational runbook
- [docs/SHOPMOICA-DEMO-FLOW.md](docs/SHOPMOICA-DEMO-FLOW.md) — Shop Moi Ça demo
- [docs/STAGING_SEED_GUIDE.md](docs/STAGING_SEED_GUIDE.md) — Staging data seeding

## Dashboard Modules

`orders` · `quotes` · `invoices` · `products` · `inventory` · `clients` · `suppliers` · `purchase-orders` · `payments` · `production` · `analytics` · `integrations` · `import` · `settings`

## Domain

Flow is the commerce vertical — managing the full order-to-cash and procure-to-pay lifecycle including quoting, order management, invoicing, inventory, production tracking, and integrations with Shopify, Zoho, and WhatsApp.

The product now consumes shared workflow primitives from `@nzila/flow-engine`; end-user UI and product-specific operating language stay inside `apps/flow`.
