# @nzila/agrimo

> Agricultural field operations — harvest tracking, production management, logistics, warehousing, and certifications with a Django backend.

**Product boundary:** Agrimo is a first-class product for cooperative,
offline-first, and emerging-market agricultural operations, principally in
the DRC. It is neither a Cora tenant nor a Cora deployment profile. Cora is
a separate first-class product for food-economy intelligence and
coordination. See [ADR-AGRI-001](../../docs/categories/products-and-market/agri/ADR/ADR-AGRI-001-cora-agrimo-product-boundary.md).

## Stack

- **Framework:** Next.js 16 (App Router) + Django backend sidecar
- **Auth:** `@nzila/platform-auth` (email/password + optional Entra SSO)
- **UI:** `@nzila/ui` + Tailwind CSS
- **Packages:** Shared `@nzila/agri-core`; Agrimo operational packages include `agri-db`, `agri-intelligence`, `agri-supply-chain`, `agri-traceability`, and `agri-forecasting`
- **Port:** 3010

## Quick Start

```bash
pnpm dev:agrimo       # or: cd apps/agrimo && pnpm dev
```

Copy `.env.example` → `.env.local` and fill required values.

### Required Env Vars

| Variable | Purpose |
|---|---|
| `AUTH_SECRET` | NextAuth session encryption |
| `AZURE_AD_*` | Entra SSO (optional) |
| `DATABASE_URL` | PostgreSQL connection string |
| `EVIDENCE_SEAL_KEY` | HMAC secret for evidence pack sealing |
| `OTEL_*` | OpenTelemetry (optional) |

## Django Backend

The `backend/` directory provides Django services for harvests, production, logistics, warehousing, certifications, payments, and intelligence.

```bash
cd apps/agrimo/backend
pip install -r requirements.txt
python manage.py runserver 8000
```

## Domain

Agrimo is the field-operations vertical — managing the full agricultural supply chain from production and harvest through logistics and warehousing, with traceability, forecasting, and certification workflows.
