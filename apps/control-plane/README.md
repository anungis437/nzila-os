# @nzila/control-plane

> Platform control plane — multi-tenant governance, workflow orchestration, anomaly detection, procurement proof, and infrastructure oversight.

## Stack

- **Framework:** Next.js 16 (App Router)
- **Auth:** `@nzila/platform-auth` (email/password + optional Entra SSO)
- **UI:** Tailwind CSS v4
- **Packages:** `@nzila/platform-governance`, `platform-intelligence`, `platform-anomaly-engine`, `platform-agent-workflows`, `platform-policy-governance`, `deal-engine`, `observability`
- **Port:** 3010
- **E2E:** Playwright

## Quick Start

```bash
cd apps/control-plane && pnpm dev
```

No `.env.example` — configure `.env.local` with standard auth vars (`AUTH_SECRET`, `AZURE_AD_*`).

## Key Docs

- [docs/ARCHITECTURE_SHAPE.md](docs/ARCHITECTURE_SHAPE.md) — Architecture overview
- [docs/ROUTE_GOVERNANCE.md](docs/ROUTE_GOVERNANCE.md) — Route governance rules
- [docs/demo-flow.md](docs/demo-flow.md) — Demo walkthrough
- [docs/pilot-playbook.md](docs/pilot-playbook.md) — Pilot deployment guide

## Dashboard Modules

`accounts` · `agents` · `anomalies` · `architecture` · `change-calendar` · `decisions` · `environments` · `governance` · `intelligence` · `modules` · `partners` · `pilots` · `pipeline` · `procurement` · `proof` · `proposals`

## Domain

Control Plane is the platform-level governance layer — managing multi-tenant accounts, agent orchestration, anomaly detection, change governance, procurement proof, and cross-vertical decision intelligence.
