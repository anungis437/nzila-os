# Partners

> Partner portal for managing deals, commissions, certifications, and go-to-market operations.

## Stack

- **Framework:** Next.js 16 (App Router)
- **Auth:** `@nzila/platform-auth` (email/password + optional Entra SSO)
- **UI:** `@nzila/ui` + Tailwind CSS + Framer Motion
- **Port:** 3002

## Quick Start

```bash
pnpm dev:partners   # or: cd apps/partners && pnpm dev
```

No `.env.example` — see `@nzila/os-core` env schema for required variables.

## Key Docs

- [docs/ARCHITECTURE_SHAPE.md](docs/ARCHITECTURE_SHAPE.md) — app architecture overview
- [docs/demo-flow.md](docs/demo-flow.md) — demo walkthrough
- [docs/pilot-playbook.md](docs/pilot-playbook.md) — pilot deployment guide

## Key Packages

- `@nzila/platform-policy-engine` — policy-based access control
- `@nzila/payments-stripe` — Stripe payment integration
- `@nzila/ai-sdk` / `@nzila/ml-sdk` — AI/ML features

## Domain

Partner relationship management — deal pipeline, commission tracking, certification programs, GTM (go-to-market) coordination, API hub for partner integrations, and ML-powered analytics. Includes admin and portal views.
