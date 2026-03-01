# Nzila OS

> Monorepo for the Nzila digital-venture platform — 13 apps, 58+ packages, polyglot (TypeScript + Python/Django), with evidence-first governance, contract-enforced invariants, and org-scoped multi-tenancy.

For a non-technical overview, see [README.business.md](README.business.md).

---

## Repository Map

```
apps/                      13 deployable applications
├── web/                   Public marketing site (Next.js, port 3000)
├── console/               Internal ops console — governance, finance, ML, AI (Next.js, port 3001)
├── partners/              Partner portal — entitlement-gated (Next.js, port 3002)
├── union-eyes/            UE case management (Next.js + Django backend, port 3003)
├── abr/                   ABR app (Next.js + Django backend, port 3004)
├── nacp-exams/            NACP exams (Next.js, port 3005)
├── cora/                  Agri intelligence dashboard (Next.js, port 3006)
├── shop-quoter/           Shop quoter (Next.js, port 3007)
├── cfo/                   CFO / finance (Next.js, port 3008)
├── trade/                 Trade management (Next.js, port 3009)
├── pondu/                 Agri field operations (Next.js, port 3010)
├── zonga/                 Zonga (Next.js, port 3011)
└── orchestrator-api/      Fastify API orchestrator (rate-limited, helmet-secured)

packages/                  58+ shared packages (see Packages section below)

tooling/
├── contract-tests/        Invariant enforcement tests (stack authority, governance, etc.)
├── ai-evals/              AI evaluation harness
├── ml/                    ML training / inference scripts
├── ga-check/              GA readiness checker
├── scripts/               CLI tools (thin wrappers)
├── security/              Security artifact publishing
├── db/                    Schema snapshot tooling
└── ops/                   Ops pack validation

content/
├── public/                Curated markdown → nzila.app/resources/{slug}
└── internal/              Curated markdown → console.nzila.app/docs/{slug} (auth required)

governance/                Raw source-of-truth strategy & corporate docs (NEVER rendered by apps)
ops/                       Runbooks, incident response, change management, compliance
docs/                      Architecture decisions, domain docs, migration guides
platform/                  Platform architecture documentation
security/                  Red-team profiles, security tooling
.github/workflows/         15 CI/CD pipelines (see CI section)
```

### Key Rules

| Rule | Detail |
|------|--------|
| **Org-scoped everything** | All data queries, mutations, and API routes are scoped to `orgId` |
| **Evidence-first** | Material actions produce tamper-evident audit trails with hash chaining |
| **Content boundary** | Apps read from `content/` — NEVER from `governance/` |
| **SDK-only AI/ML** | Apps consume `@nzila/ai-sdk` and `@nzila/ml-sdk` — never provider SDKs directly |
| **Auth on all routes** | Every API route calls `authorize()` from `@nzila/os-core/policy` |
| **Stack authority** | Django-authoritative apps (ABR, UE) must not mutate domain data via Drizzle |
| **Package manager** | pnpm 10 with workspaces |
| **Build orchestration** | Turborepo |
| **Styling** | Tailwind CSS v4 |

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 10 — `npm i -g pnpm`
- **Python** ≥ 3.11 (for ABR/UE Django backends and `packages/automation`)
- **Clerk account** — [clerk.com](https://clerk.com)

### 1. Install & run

```bash
pnpm install           # all TS/JS dependencies
pnpm dev               # all apps in parallel
pnpm dev:web           # → http://localhost:3000
pnpm dev:console       # → http://localhost:3001
```

### 2. Configure environment

Each app and Django backend has a `.env.example`. Copy and fill:

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/console/.env.example apps/console/.env.local
# … repeat for each app you need locally
```

### 3. Build & validate

```bash
pnpm build             # all apps + packages via Turborepo
pnpm lint              # ESLint across all workspaces
pnpm typecheck         # tsc --noEmit across all workspaces
pnpm test              # Vitest unit tests
pnpm contract-tests    # invariant enforcement tests
```

---

## Apps

### Next.js Apps (11)

All Next.js apps use Clerk auth, Tailwind CSS v4, and the `@nzila/ui` component library.

| App | Port | Purpose |
|-----|------|---------|
| `web` | 3000 | Public marketing / landing |
| `console` | 3001 | Internal ops console (governance, finance, ML, AI, NACP integrity) |
| `partners` | 3002 | Partner portal with row-level entitlement gating |
| `union-eyes` | 3003 | UE case management (**Django-authoritative backend**) |
| `abr` | 3004 | ABR app (**Django-authoritative backend**) |
| `nacp-exams` | 3005 | NACP examinations |
| `cora` | 3006 | Agri intelligence — yield, pricing, risk, traceability |
| `shop-quoter` | 3007 | Shop quoter — bridges legacy ShopMoiÇa quoting |
| `cfo` | 3008 | CFO finance dashboard |
| `trade` | 3009 | Trade management |
| `pondu` | 3010 | Agri field ops — producers, harvests, lots, QA, warehouse, shipments |
| `zonga` | 3011 | Zonga |

### API

| App | Runtime | Purpose |
|-----|---------|---------|
| `orchestrator-api` | Fastify | Central API orchestrator — rate-limited (200 req/min), helmet-secured |

### Django Backends

`apps/abr/backend/` and `apps/union-eyes/backend/` are full Django REST Framework applications. They are the **authoritative data layer** for their domains. See [docs/architecture/STACK_AUTHORITY.md](docs/architecture/STACK_AUTHORITY.md).

---

## Packages by Domain

### Platform Core

| Package | Purpose |
|---------|---------|
| `@nzila/os-core` | Control backbone — evidence, policy, telemetry, retention, config, secrets |
| `@nzila/db` | Drizzle ORM schema + migrations |
| `@nzila/blob` | Azure Blob Storage abstraction |
| `@nzila/evidence` | Evidence pack sealing and verification |
| `@nzila/org` | Organization management |
| `@nzila/config` | Shared TS, ESLint, Prettier configs |
| `@nzila/ui` | Shared React component library |
| `@nzila/cli` | CLI tooling |
| `@nzila/webhooks` | Webhook handling |
| `@nzila/data-lifecycle` | Data retention / lifecycle management |

### Platform Infrastructure

| Package | Purpose |
|---------|---------|
| `@nzila/platform-export` | Platform data export |
| `@nzila/platform-isolation` | Org-level tenant isolation |
| `@nzila/platform-metrics` | Platform metrics collection |
| `@nzila/platform-ops` | Operational snapshots |
| `@nzila/platform-performance` | Performance envelopes |
| `@nzila/platform-proof` | NACP integrity proofs, real DB-backed verification |
| `@nzila/tools-runtime` | Tools execution runtime |

### AI / ML

| Package | Purpose |
|---------|---------|
| `@nzila/ai-core` | AI infrastructure — profiles, budget enforcement, RAG, actions |
| `@nzila/ai-sdk` | App-facing AI client + `no-shadow-ai` ESLint rule |
| `@nzila/ml-core` | ML infrastructure — registry, scoring, drift monitoring |
| `@nzila/ml-sdk` | App-facing ML client + `no-shadow-ml` ESLint rule |

### Agriculture

| Package | Purpose |
|---------|---------|
| `@nzila/agri-core` | Domain primitives — enums, types, schemas, FSMs |
| `@nzila/agri-db` | Database repositories (org-scoped) |
| `@nzila/agri-events` | Domain event bus + integration dispatch |
| `@nzila/agri-intelligence` | Computation library — yield, loss, payout |
| `@nzila/agri-traceability` | Evidence packs + hash chain verification |
| `@nzila/agri-adapters` | External adapters — weather, market, mobile-money, SMS |

### Commerce

| Package | Purpose |
|---------|---------|
| `@nzila/commerce-core` | Commerce engine core |
| `@nzila/commerce-db` | Database layer |
| `@nzila/commerce-events` | Event bus |
| `@nzila/commerce-state` | State machines |
| `@nzila/commerce-services` | Business services |
| `@nzila/commerce-audit` | Audit layer |
| `@nzila/commerce-evidence` | Evidence packs |
| `@nzila/commerce-governance` | Governance rules |
| `@nzila/commerce-observability` | Observability |
| `@nzila/commerce-integration-tests` | Cross-package integration tests |
| `@nzila/pricing-engine` | Pricing engine |
| `@nzila/shop-quoter` | Legacy ShopMoiÇa quoting bridge |

### Trade

| Package | Purpose |
|---------|---------|
| `@nzila/trade-core` | Trade domain core |
| `@nzila/trade-db` | Database layer |
| `@nzila/trade-adapters` | External adapters |
| `@nzila/trade-cars` | Cars domain |

### Finance

| Package | Purpose |
|---------|---------|
| `@nzila/payments-stripe` | Stripe integration + webhooks |
| `@nzila/qbo` | QuickBooks Online OAuth + sync |
| `@nzila/tax` | Tax calendar + obligation engine |
| `@nzila/fx` | Foreign exchange |

### Communications & Integrations

| Package | Purpose |
|---------|---------|
| `@nzila/comms-email` | Email |
| `@nzila/comms-sms` | SMS |
| `@nzila/comms-push` | Push notifications |
| `@nzila/chatops-slack` | Slack ChatOps |
| `@nzila/chatops-teams` | Teams ChatOps |
| `@nzila/crm-hubspot` | HubSpot CRM |
| `@nzila/integrations-core` | Integrations framework |
| `@nzila/integrations-db` | Integrations database layer |
| `@nzila/integrations-runtime` | Integrations execution runtime |

### Domain

| Package | Purpose |
|---------|---------|
| `@nzila/nacp-core` | NACP domain core |
| `@nzila/zonga-core` | Zonga domain core |

### Python (outside pnpm workspace)

| Directory | Purpose |
|-----------|---------|
| `packages/automation/` | Python automation pipelines |
| `packages/analytics/` | Python analytics & reporting |

---

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full architectural overview.

### Key Decisions

- **Evidence-first**: All material actions produce evidence artifacts via `buildEvidencePackFromAction()` → Azure Blob + hash-chained `audit_events`
- **Ports-and-adapters**: Domain logic depends on port interfaces, not concrete implementations
- **Polyglot persistence**: TypeScript/Drizzle for platform core, Python/Django for domain verticals (ABR, UE)
- **Stack authority**: Each app has a formally designated authoritative data layer — enforced by contract tests
- **RBAC**: Clerk session claims (`publicMetadata.nzilaRole`) — five roles: `platform_admin`, `studio_admin`, `ops`, `analyst`, `viewer`
- **Governance separation**: Raw strategy docs in `governance/` are never imported by app code; curated versions go to `content/`
- **Contract-enforced invariants**: `tooling/contract-tests/` runs 5000+ tests verifying architectural rules at CI time
- **SLO gating**: Deploy to pilot/prod blocked if real SLO metrics fail thresholds

---

## CI / CD

15 GitHub Actions workflows:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | PR, push | Primary gate — lint, typecheck, test, contract tests, build |
| `control-tests.yml` | Schedule | Scheduled control/invariant validation |
| `deploy-web.yml` | Push to main | Deploy public site to Azure SWA |
| `deploy-console.yml` | Push to main | Deploy console to Azure SWA |
| `deploy-partners.yml` | Push to main | Deploy partner portal |
| `deploy-union-eyes.yml` | Push to main | Deploy UE |
| `release-train.yml` | Tag | Release evidence + SBOM generation |
| `ops-pack.yml` | PR | Ops pack completeness gate |
| `dependency-audit.yml` | PR, weekly | CVE scanning via `pnpm audit` |
| `sbom.yml` | Release | CycloneDX Software Bill of Materials |
| `secret-scan.yml` | PR | TruffleHog + Gitleaks |
| `codeql.yml` | PR, weekly | CodeQL static analysis (TS + Python) |
| `trivy.yml` | Dockerfile changes, weekly | Container image vulnerability scanning |
| `red-team.yml` | Manual | Red-team security testing |
| `nzila-governance.yml` | PR | Governance automation checks |

### Required GitHub Secrets

| Secret | Purpose |
|--------|---------|
| `AZURE_SWA_TOKEN_WEB` | SWA deploy token — public website |
| `AZURE_SWA_TOKEN_CONSOLE` | SWA deploy token — console |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |

---

## Content Authoring

### Public (`content/public/`)

Rendered at `nzila.app/resources/{slug}`:

```md
---
title: Getting Started
description: How to onboard onto the Nzila platform
category: Guides
order: 1
---

Your content here…
```

### Internal (`content/internal/`)

Rendered at `console.nzila.app/docs/{slug}` (requires Clerk auth). Same frontmatter format.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Key points:

- Read the [repo contract](docs/repo-contract/README.md) first
- PRs must pass: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm contract-tests`, `turbo run build`
- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`)
- New apps must pass the App Alignment Checklist

## Security

See [SECURITY.md](SECURITY.md). Report vulnerabilities to security@nzila.app (not public issues).

## License

Proprietary — Nzila Digital Ventures. All rights reserved.
