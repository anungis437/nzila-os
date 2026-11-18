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

Server actions resolve an explicit purpose through `lib/resolve-org.ts`. Partner
records require a current user link to an active partner; multiple partners or
entity grants require an explicit selection. Platform administration uses the
existing verified platform role guard. Personal course progress belongs to the
signed-in actor and does not issue an institutional certification or change a tier.
AI/ML calls require the existing, unexpired `ml:summary` entitlement to an actual
active organization, and resource authorization precedes provider calls.

Historical deal records that used an actor ID as `partnerId` remain personal to
that actor, with platform oversight. They are not automatically assigned to a
current employer or colleague. New roots record the canonical partner separately
from the resource and actor, with no fabricated tenant ID. Commission approval
records an approval; it does not record a payment or transfer. Personal and partner
records retain their primary audit without claiming an organization evidence pack.
