# NACP Exams

> National Anti-Corruption Programme examination and assessment platform.

## Stack

- **Framework:** Next.js 16 (App Router)
- **Auth:** `@nzila/platform-auth` (email/password + optional Entra SSO)
- **UI:** `@nzila/ui` + Tailwind CSS + Radix primitives + Framer Motion
- **Port:** 3005

## Quick Start

```bash
cd apps/nacp-exams && pnpm dev
```

No `.env.example` — see `@nzila/os-core` env schema for required variables.

## Key Packages

- `@nzila/nacp-core` — NACP domain logic
- `@nzila/ai-sdk` / `@nzila/ml-sdk` — AI-assisted exam features
- `@nzila/commerce-audit` / `@nzila/commerce-state` — audit trail & state management
- `@nzila/blob` — file/document storage

## Domain

Anti-corruption examination management — exam creation, candidate dashboards, assessment scoring, and compliance reporting. Integrates AI/ML for question generation and analytics.
