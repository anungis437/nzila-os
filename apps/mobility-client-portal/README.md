# Mobility Client Portal

> Client-facing portal for investment migration applicants to track cases, upload documents, manage family members, and communicate with their advisory team.

## Stack

- **Framework:** Next.js 16 (App Router)
- **Auth:** `@nzila/platform-auth` (email/password + optional Entra SSO)
- **UI:** `@nzila/ui` + Tailwind CSS v4 + Framer Motion
- **Port:** 3011

## Quick Start

```bash
pnpm dev:mobility-client-portal   # or: cd apps/mobility-client-portal && pnpm dev
```

No `.env.example` — see `@nzila/os-core` env schema for required variables.

## Key Packages

- `@nzila/mobility-core` — shared mobility domain logic
- `@nzila/mobility-programs` — CBI/RBI program definitions
- `@nzila/mobility-family` — family member management

## Domain

Self-service portal for HNWI/UHNWI clients going through citizenship-by-investment or residency-by-investment programs. Covers document uploads, family member management, case status tracking ("my cases"), and secure messaging — the applicant-facing complement to the internal mobility advisory app.

## Environment Variables

See `.env.example` in this directory for required variables (`AUTH_SECRET`, `DATABASE_URL`, Entra SSO config).

## Known Exceptions

- **No `@nzila/platform-shell`** — Custom client-facing portal UI with distinct branding

See `governance/exceptions/platform-adoption-exceptions.json` for formal registration.
