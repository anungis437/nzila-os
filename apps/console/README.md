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
- [docs/production-canary-checklist.md](docs/production-canary-checklist.md) — Post-deploy authz and billing canary gates
- [docs/fortune500-readiness-assessment.md](docs/fortune500-readiness-assessment.md) — Enterprise readiness gap matrix vs Fortune 500 baseline

## Dashboard Modules

`analytics` · `assurance` · `audit-insights` · `automation` · `compliance-snapshots` · `cost` · `evidence-packs` · `governance` · `integrations` · `marketplace` · `ops` · `performance` · `pilot` · `proof-center` · `settings` · `system-health` · `trend-detection`

## Domain

Console is the internal operations hub — providing cross-vertical visibility into governance, compliance, analytics, cost management, and proof artifacts across the entire Nzila platform.

## Request boundaries

API routes authenticate callers, check current platform or organization access,
validate input and format responses. Operations and database queries live in
`lib/services/`. Financial records resolve their organization from the stored
parent, and update inputs reject ownership changes. Public survey submissions
retain their exact share-token and active-survey checks; survey administration
requires the existing operator roles.

Both Stripe webhook routes verify the raw request body before storage. The QBO
callback rechecks organization-admin access before exchanging credentials and
persists the connection and encrypted tokens in its existing transaction. New
production token writes require `QBO_TOKEN_ENCRYPTION_KEY` to contain exactly
32 bytes encoded as 64 hexadecimal characters, including when an Azure Key
Vault URL is configured. Key Vault wrapping remains unimplemented.

Console voting submissions return `501 VERIFIED_VOTING_SOURCE_UNAVAILABLE`:
the current model lacks verified canonical voter, electorate and quorum
bindings. Historical votes and the supported governance read views remain on
their existing paths.
