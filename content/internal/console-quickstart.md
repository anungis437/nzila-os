---
title: Console Quickstart
description: How to get up and running with the Nzila internal console.
category: Onboarding
order: 1
---

# Console Quickstart

This guide walks you through setting up and using the Nzila internal console.

## Prerequisites

- A platform account (email/password sign-up or Entra SSO invitation from a platform admin)
- Node.js ≥ 20 and pnpm ≥ 10

## Setup

1. Clone the repo and install dependencies:

```bash
git clone <repo-url>
cd nzila-automation
pnpm install
```

2. Copy the environment file:

```bash
cp apps/console/.env.example apps/console/.env.local
```

3. Fill in `AUTH_SECRET` (required). For Entra SSO, also fill in `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`.

4. Start the console:

```bash
pnpm dev:console
```

5. Open [http://localhost:3001](http://localhost:3001) and sign in.

## Navigation

- **Dashboard** — Overview tiles with quick links
- **Docs** — Internal documentation (this section!)
- **Analytics** — Portfolio analytics (read-only)
- **Automation** — Pipeline status and history
- **Standards** — Scripts Book chapter status

## Roles

Your access level depends on your assigned role:

| Role | Access |
|------|--------|
| `platform_admin` | Full access to everything |
| `studio_admin` | All content + analytics |
| `ops` | Automation pipelines + deployments |
| `analyst` | Analytics dashboards (read-only) |
| `viewer` | Docs only |
