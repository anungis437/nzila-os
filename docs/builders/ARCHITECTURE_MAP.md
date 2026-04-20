# Architecture Map

How the Nzila OS monorepo is organized and how the pieces connect.

## Layer Model

```
┌─────────────────────────────────────────────────┐
│  Apps (17)          Next.js / Fastify / Django   │
│  apps/web, console, union-eyes, flow, ...        │
├─────────────────────────────────────────────────┤
│  Domain Packages    Business logic per product   │
│  agri-*, zonga-*, trade-*, commerce-*, ...       │
├─────────────────────────────────────────────────┤
│  Platform Packages  Shared infrastructure        │
│  platform-auth, platform-events, os-core, db, ui │
├─────────────────────────────────────────────────┤
│  Tooling            CI, contracts, scaffolding   │
│  tooling/contract-tests, golden-path, ...        │
├─────────────────────────────────────────────────┤
│  Governance         Truth sources & policies     │
│  governance/portfolio, capital, commercial, ...   │
└─────────────────────────────────────────────────┘
```

## Apps

| App | Port | Stack | Domain |
|-----|------|-------|--------|
| `web` | 3000 | Next.js | Marketing, public site |
| `console` | 3001 | Next.js | Internal ops, governance, finance |
| `union-eyes` | 3002 | Next.js + Django sidecar | Labour representation, case management |
| `flow` | 3003 | Next.js | SMB operations, commerce |
| `partners` | 3004 | Next.js | Partner portal |
| `abr` (FairCase) | — | Next.js | Justice & equity |
| `cfo` | — | Next.js | Finance workflows |
| `agrimo` | — | Next.js | Agricultural operations |
| `cora` | — | Next.js | Agri intelligence |
| `zonga` | — | Next.js | Creator economy |
| `trade` | — | Next.js | Cross-border trade |
| `control-plane` | — | Fastify | Platform governance API |
| `orchestrator-api` | — | Fastify | Shared orchestration |

## Key Platform Packages

| Package | Purpose |
|---------|---------|
| `platform-auth` | Email/password + Entra SSO auth |
| `os-core` | Evidence, policy, telemetry, retention, secrets |
| `db` | Drizzle ORM schema + migrations |
| `ui` | Shared React component library |
| `platform-events` | Domain event bus |
| `platform-governance` | Policy engine |
| `platform-observability` | OpenTelemetry, logging |
| `platform-evidence-pack` | Tamper-evident audit packs |
| `ai-core` / `ai-sdk` | AI infrastructure + app client |
| `ml-core` / `ml-sdk` | ML registry + scoring |

## Dependency Rules

1. **Apps depend on packages, never on other apps**
2. **Platform packages are shared infrastructure** — domain packages depend on them
3. **Domain packages** are product-specific — apps import their own domain packages
4. **Tooling** is independent — used by CI only, not imported by app code
5. **No circular dependencies** — enforced by contract tests

## Data Flow

```
Browser → Next.js App → Platform Auth → Domain Logic → Drizzle ORM → PostgreSQL
                          ↓
                    Evidence Chain → Azure Blob
                          ↓
                    OpenTelemetry → Observability
```

## CI/CD Pipeline

```
PR → lint + typecheck + tests + governance gates
                ↓
merge to main → GitOps deploy to staging
                ↓
manual promote → Production (with evidence pack)
```

## Key Files

| File | Purpose |
|------|---------|
| `turbo.json` | Turborepo task configuration |
| `pnpm-workspace.yaml` | Workspace package globs |
| `governance/portfolio/product-catalog.json` | Single source of portfolio truth |
| `nzila-truth-manifest.json` | Generated truth manifest |
| `vitest.config.ts` | Test configuration |
| `lefthook.yml` | Git hook configuration |
