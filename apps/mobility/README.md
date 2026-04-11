# @nzila/mobility

> Investment migration advisory platform — case management, program intelligence, KYC/AML compliance, and document workflows for citizenship-by-investment (CBI) and residency-by-investment (RBI) firms.

## Stack

- **Framework:** Next.js 16 (App Router)
- **Auth:** `@nzila/platform-auth` (email/password + optional Entra SSO)
- **UI:** `@nzila/ui` + Tailwind CSS
- **Packages:** `@nzila/mobility-core`, `mobility-programs`, `mobility-compliance`, `mobility-case-engine`, `mobility-family`
- **Port:** 3010
- **i18n:** `next-intl`

## Quick Start

```bash
cd apps/mobility && pnpm dev
```

No `.env.example` — configure `.env.local` with standard auth vars (`AUTH_SECRET`, `AZURE_AD_*`, `DATABASE_URL`).

## Dashboard Modules

`cases` · `clients` · `compliance` · `documents` · `programs` · `dashboard`

## Domain

Mobility is the **investment migration vertical** — purpose-built for firms (like [TIMC](https://www.timc.ca)) that help high-net-worth individuals and families diversify citizenships and residencies across 25+ countries. The platform manages the full advisory lifecycle: client intake with wealth-tier classification (HNWI/UHNWI), eligibility assessment against 40+ CBI/RBI/Golden Visa programs, KYC/AML screening, document collection, government submission tracking, and post-approval compliance. Integrates with HubSpot (CRM), Microsoft 365, and WhatsApp for client communications.
