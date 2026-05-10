# Nzila HQ

Executive operating cockpit for **Nzila Ventures**. Built inside the `nzila-os` monorepo at `apps/nzila-hq`.

> **Mission:** reduce founder dependency, increase portfolio visibility, accelerate revenue execution, and coordinate ventures **without duplicating existing systems**.

## Non-negotiable architecture rules

| Rule                                                                                                                                                            | Enforced by                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Never duplicate Console, Platform Admin, or Control Plane.** Nzila HQ aggregates and links — it does not own membership, approvals, or operational telemetry. | `apps/nzila-hq/control-manifest.json`, `app/integrations/*` are deep-link landings, not editors. |
| **No mutations of governed entities from this app.** Every change to an org, seat, approval, or release happens in the authoritative system.                    | RBAC matrix in `lib/rbac.ts` exposes only `view:*` capabilities for v1.                          |
| **Edge middleware stays edge-safe.** No Node-only modules (`node:crypto`, etc.) — auth resolution is server-only.                                               | `proxy.ts` does not import `@nzila/platform-auth`.                                               |
| **Use `resolveOrgContext()` — never bare `auth()`.**                                                                                                            | `ORG_REQUIRED_SERVER_ACTIONS_001` contract; lazy-loaded auth in `lib/resolve-org.ts`.            |
| **Pure-domain logic lives in `@nzila/hq-domain`.** No I/O, no DB, no React in that package.                                                                     | `packages/hq-domain/README.md`.                                                                  |

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      apps/nzila-hq                       │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Next.js 16 (App Router) · port 3020 · server-only │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────┐    ┌─────────────────────────┐   │
│  │ lib/                │   │ server/                  │  │
│  │  - resolve-org      │   │  - seed-data (in-mem v1) │  │
│  │  - rbac (caps)      │◄──┤  - repository singleton  │  │
│  │  - nav, format      │   │  - tests                 │  │
│  └────────────────────┘    └──────────────┬──────────┘   │
│                                            │              │
│  ┌─────────────────────────────────────────▼───────────┐ │
│  │  app/  — server components only (no 'use client')   │ │
│  │   /home  /portfolio  /crm  /pipeline                │ │
│  │   /dependency  /delegation  /finance  /documents    │ │
│  │   /integrations/{control-plane,platform-admin,…}    │ │
│  │   /api/health                                       │ │
│  └─────────────────────────────────────────────────────┘ │
└────────────────────┬─────────────────────────────────────┘
                     │  imports (workspace:*)
                     ▼
        ┌─────────────────────────────┐
        │   @nzila/hq-domain (NEW)    │  ← pure types + algorithms
        │   - types (zod + TS)        │
        │   - dependency-engine       │
        │   - automations             │
        │   - reports                 │
        └─────────────────────────────┘
```

## RBAC

Six roles, capability-gated:

| Role           | Sees                                                      |
| -------------- | --------------------------------------------------------- |
| `founder`      | Everything, including finance and integrations            |
| `president`    | Everything except finance write paths (none yet)          |
| `ops-lead`     | Portfolio, pipeline, delegation, dependency, integrations |
| `partnerships` | Portfolio, CRM, pipeline (read-only), partner queue       |
| `finance`      | Portfolio (rollup), finance, documents, reports           |
| `board-viewer` | Executive home + finance summary only                     |

Capabilities are defined in [lib/rbac.ts](../../apps/nzila-hq/lib/rbac.ts).

## Local dev

```pwsh
pnpm install
pnpm --filter @nzila/nzila-hq dev   # http://localhost:3020
```

In dev, `resolveOrgContext()` falls back to `userId='user-founder'` / `orgId='org-nzila-ventures'` so the app boots without Entra credentials. In production, `AUTH_SECRET` and `AZURE_AD_*` are required (asserted in `instrumentation.ts`).

### Required env vars (production)

See [.env.example](../../apps/nzila-hq/.env.example). The boot assertion lives in [lib/boot-env.ts](../../apps/nzila-hq/lib/boot-env.ts).

## Tests

```pwsh
pnpm --filter @nzila/hq-domain test
pnpm --filter @nzila/nzila-hq test
```

## Deployment

Ship as a Container App (matches platform-admin). Build target = `apps/nzila-hq` Dockerfile (TBD — pattern is identical to platform-admin's). Health probe: `GET /api/health`.

## Where to add things

- **New venture / opportunity / task** → `server/seed-data.ts` (until DB lands)
- **New page** → `app/<slug>/page.tsx` + `lib/nav.ts` + capability in `lib/rbac.ts` + entry in `route.meta.json`
- **New automation rule** → `packages/hq-domain/src/automations.ts`
- **New report** → `packages/hq-domain/src/reports.ts`
- **New UI primitive** → `components/primitives/`
