# @nzila/abr

> Agricultural Business Review — compliance audits, analytics, and Django-backed AI services for agri-business operations.

## Stack

- **Framework:** Next.js 16 (App Router) + Django backend sidecar
- **Auth:** `@nzila/platform-auth` (email/password + optional Entra SSO)
- **UI:** `@nzila/ui` + Tailwind CSS v4
- **AI:** `@nzila/ai-sdk` + `@nzila/ml-sdk`
- **Port:** 3004

## Quick Start

```bash
pnpm dev:abr          # or: cd apps/abr && pnpm dev
```

Copy `.env.example` → `.env.local` and fill required values.

### Required Env Vars

| Variable | Purpose |
|---|---|
| `AUTH_SECRET` | NextAuth session encryption |
| `AZURE_AD_CLIENT_ID` / `SECRET` / `TENANT_ID` | Entra SSO (optional) |
| `NEXT_PUBLIC_API_URL` | Django backend URL (default `http://localhost:8000`) |

## Django Backend

The `backend/` directory contains a Django app providing AI analytics, billing, compliance, and notification services.

```bash
cd apps/abr/backend
pip install -r requirements.txt
python manage.py runserver 8000
```

## Domain

ABR covers agricultural business review workflows — audit scoring, compliance snapshots, service analytics, and integration with the platform's AI and ML pipelines for agri-business intelligence.
