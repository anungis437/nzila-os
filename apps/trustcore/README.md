# TrustCore

Trust & compliance engine for the Nzila OS platform. Provides policy enforcement, audit trails, and governance controls consumed by other platform apps.

## Getting Started

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

## Environment Variables

See [`.env.example`](.env.example) for required variables.

| Variable | Description |
|---|---|
| `AUTH_SECRET` | Session signing secret (32+ chars) |
| `AZURE_AD_CLIENT_ID` | Entra SSO client ID (optional) |
| `AZURE_AD_CLIENT_SECRET` | Entra SSO client secret (optional) |
| `AZURE_AD_TENANT_ID` | Entra tenant ID (optional) |
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXT_PUBLIC_APP_URL` | Public app URL |
| `TRUSTCORE_DEV_ROLE` | Dev-only role override (never set in production) |

## Architecture

- **Tier**: Incubating
- **Domain**: Trust
- **Auth**: `@nzila/platform-auth` (email/password + optional Entra SSO)
- **API prefix**: `/api`
