# WeekOne

Onboarding and first-week activation surface for new tenants across the NzilaOS portfolio.

## Overview

WeekOne provides a guided onboarding experience for teams joining the platform — day-one task flows, welcome sequences, and contextual product discovery across the suite.

## Local Development

```bash
pnpm install
pnpm dev
```

Runs on **http://localhost:3009** by default.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the required values:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `AUTH_SECRET` | Session signing secret (generate with `openssl rand -base64 32`) |
| `AZURE_AD_CLIENT_ID` | Entra app client ID (optional SSO) |
| `AZURE_AD_CLIENT_SECRET` | Entra app client secret (optional SSO) |
| `AZURE_AD_TENANT_ID` | Entra tenant ID (optional SSO) |
| `DATABASE_URL` | PostgreSQL connection string |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint |

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Auth**: `@nzila/platform-auth` (email/password + optional Entra SSO)
- **Database**: PostgreSQL via `@nzila/db` (Drizzle ORM)
- **UI**: `@nzila/ui` + Tailwind CSS
- **AI**: `@nzila/ai-sdk` (Azure OpenAI)

## Testing

```bash
pnpm test
pnpm typecheck
```
