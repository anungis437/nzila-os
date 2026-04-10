# @nzila/cfo

> CFO finance dashboard — ledger management, tax tools, AI advisory, document intelligence, and integrations with Plaid, Dext, Xero, and QuickBooks.

## Stack

- **Framework:** Next.js 16 (App Router)
- **Auth:** `@nzila/platform-auth` (email/password + optional Entra SSO)
- **UI:** `@nzila/ui` + Tailwind CSS v4
- **AI:** `@nzila/ai-sdk` + `@nzila/ml-sdk`
- **Port:** 3008

## Quick Start

```bash
pnpm dev:cfo          # or: cd apps/cfo && pnpm dev
```

Copy `.env.example` → `.env.local` and fill required values.

### Required Env Vars

| Variable | Purpose |
|---|---|
| `AUTH_SECRET` | NextAuth session encryption |
| `AZURE_AD_*` | Entra SSO (optional) |
| `PLAID_CLIENT_ID` / `PLAID_SECRET` | Open Banking integration |
| `DEXT_API_KEY` | Receipt / invoice OCR |
| `AZURE_DOC_INTEL_*` | Document Intelligence (Azure) |
| `XERO_CLIENT_ID` / `SECRET` | Xero accounting integration |

## Key Docs

- [docs/ARCHITECTURE_SHAPE.md](docs/ARCHITECTURE_SHAPE.md) — Architecture overview
- [docs/demo-flow.md](docs/demo-flow.md) — Demo walkthrough
- [docs/pilot-playbook.md](docs/pilot-playbook.md) — Pilot deployment guide

## Domain

CFO is the finance vertical — general ledger, tax tools, AI-powered advisory insights, audit trails, document processing, client portals, and workflow automation for accounting and finance teams.
