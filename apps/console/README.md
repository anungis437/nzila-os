# @nzila/console

> Internal operations console — platform governance, compliance, analytics, integrations management, and proof-center for multi-vertical oversight.

## Stack

- **Framework:** Next.js 16 (App Router)
- **Auth:** `@nzila/platform-auth` (email/password + optional Entra SSO)
- **UI:** `@nzila/ui` + Tailwind CSS
- **Packages:** `@nzila/platform-ops`, `platform-metrics`, `platform-proof`, `platform-export`, `payments-stripe`, `qbo`, `tax`
- **Port:** 3001

## Quick Start

```bash
pnpm dev:console      # or: cd apps/console && pnpm dev
```

Copy `.env.example` → `.env.local` and fill required values.

### Required Env Vars

| Variable | Purpose |
|---|---|
| `AUTH_SECRET` | NextAuth session encryption |
| `AZURE_AD_*` | Entra SSO (optional) |

## Key Docs

- [docs/DOMAIN_MODEL.md](docs/DOMAIN_MODEL.md) — Domain model reference

## Dashboard Modules

`analytics` · `assurance` · `audit-insights` · `automation` · `compliance-snapshots` · `cost` · `evidence-packs` · `governance` · `integrations` · `marketplace` · `ops` · `performance` · `pilot` · `proof-center` · `settings` · `system-health` · `trend-detection`

## Domain

Console is the internal operations hub — providing cross-vertical visibility into governance, compliance, analytics, cost management, and proof artifacts across the entire Nzila platform.
