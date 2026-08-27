# Nzila OS

NzilaOS is decision infrastructure: a shared system for capturing, evaluating, proving, replaying, and governing organizational decisions across multiple domains.

Every product surface is a thin interface over a shared decision core:

```ts
Decision = Input + Policy + Actor Authority + Outcome + Proof
```

## Domain Interfaces

| Product | Domain | Status | Tier |
|---------|--------|--------|------|
| **Union Eyes** | Labour representation & case management | Pilot — sell-now | 1 |
| **CourtLens** | Access-to-justice & legal matter intelligence (on ABR substrate; retains FAIRCASE tribunal-intelligence lineage) | Pilot — sell-now | 1 |
| **Flow** | SMB operations & commerce automation | Pilot — sell-now | 1 |
| **CFO** | Finance workflows | Pilot | 2 |
| **Partners** | Partner enablement portal | Pilot | 2 |
| **Console** | Internal ops & governance control surface | Internal | 3 |
| **Control Plane** | Platform governance engine | Internal | 3 |
| **Web** | Public marketing & lead generation | Maintain | 3 |
| **Agrimo** | Agricultural field operations | Incubating | 4 |
| **Cora** | Agri intelligence dashboard | Incubating | 4 |
| **Zonga** | Creator economy platform | Incubating | 4 |
| **Trade** | Cross-border trade & deal infrastructure (distinct from 3CUO/DiasporaCore banking) | Incubating | 4 |
| **Mobility** | Immigration & mobility | Incubating | 4 |
| **NACP Exams** | DRC national education & examination infrastructure | Incubating | 4 |

Portfolio truth source: [governance/portfolio/product-catalog.json](governance/portfolio/product-catalog.json)

## Decision Core

- `packages/decision-core` defines the canonical decision primitives, registry, and enforcement helper
- Control Plane governs decision integrity and policy evaluation
- Orchestrator executes approved decision workflows
- Console reviews proof, replay, and operating risk
- Platform Admin governs tenants, authority, and policy activation

## Quick Start

```bash
pnpm install            # Install all dependencies
pnpm dev:web            # Start the web app
pnpm dev:console        # Start the console
pnpm test:fast          # Run unit tests (skip contract tests)
pnpm build              # Build everything
```

Bootstrap and seed workflows are idempotent and safe to re-run multiple times.

## Repo Structure

```
apps/              27 applications
packages/          canonical inventory (platform, domain, infra)
services/          Backend services
tooling/           Contract tests, scaffolding, CI tools
governance/        Portfolio catalog, capital model, commercial data
scripts/           Validation, release, SRE, finops tooling
docs/              Documentation (builders, buyers, operators, security)
ops/               Environment configs, runbooks, policies
reports/           Generated reports (capital, SRE, compliance)
infrastructure/    IaC and deployment configs
```

Canonical repo inventory: [tooling/repo-inventory/output/repo-inventory.md](tooling/repo-inventory/output/repo-inventory.md)

## Canonical Commands

### Daily Development

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start all apps |
| `pnpm build` | Build everything |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm test:fast` | Fast tests (skip contracts) |
| `pnpm test` | Full test suite |

### Release & Deploy

| Command | Purpose |
|---------|---------|
| `pnpm release:staging` | Staging gate (audit + smoke + migration safety) |
| `pnpm release:prod` | Production gate (full checks) |
| `pnpm release:rollback` | Roll back production |
| `pnpm release:hotfix` | Initiate hotfix |

### Governance & Audit

| Command | Purpose |
|---------|---------|
| `pnpm validate:governance` | Full governance gate |
| `pnpm governance:audit` | Doc, ownership, release, and repo audit |
| `pnpm decision:coverage` | Warn-only decision registration coverage check |
| `pnpm decision:coverage -- --strict` | Blocking decision-proof coverage gate |
| `pnpm audit:pack:verify -- --input=<pack.json|pack.zip>` | External audit-pack integrity verification |
| `pnpm repo:audit` | Repo excellence audit |
| `pnpm docs:index` | Rebuild documentation index |

### Operations

| Command | Purpose |
|---------|---------|
| `pnpm db:local:up` | Start local PostgreSQL (docker-compose.automation.yml) |
| `pnpm db:doctor` | Database health check |
| `pnpm sre:validate` | Full SRE check (health, synthetics, alerts, audit) |
| `pnpm finops:build` | FinOps portfolio report |
| `pnpm evidence:pack:monthly` | Monthly evidence pack |

### Portfolio & Capital

| Command | Purpose |
|---------|---------|
| `pnpm generate:portfolio-artifacts` | Regenerate all portfolio reports |
| `pnpm generate:capital-allocation` | Capital allocation engine |
| `pnpm generate:commercial-traction` | Commercial traction reports |

Full command catalog: `pnpm help:commands`

## Release Model

Staging → Production promotion with governance gates at every step:

1. **Staging gate** — `pnpm release:staging` runs audit, migration safety, and smoke tests
2. **Production gate** — `pnpm release:prod` adds secret audit and full deployment resolution
3. **Rollback** — `pnpm release:rollback` for immediate revert
4. **Hotfix** — `pnpm release:hotfix` with SLA tracking

CI enforces portfolio-governance, compliance drift, and reliability checks on every PR.

## Portfolio Governance

- **Single truth source** — [governance/portfolio/product-catalog.json](governance/portfolio/product-catalog.json) drives all portfolio artifacts
- **Portfolio status** — Generated report at [reports/portfolio-status.md](reports/portfolio-status.md)
- **Capital discipline** — Allocation weights, runway scenarios, override tracking
- **Commercial traction** — Pipeline, pilot conversion, retention risk with evidence separation
- **Evidence packs** — Monthly tamper-evident audit packs in [proof-artifacts/](proof-artifacts/)
- **200+ contract tests** — Enforcing platform boundaries, security posture, and operating standards

## Architecture

- **Decision infrastructure**: `@nzila/decision-core` defines canonical decision records, registry entries, and route-level enforcement helpers
- **Auth**: `@nzila/platform-auth` — email/password (Argon2id) + optional Entra SSO. All apps use `@nzila/platform-auth` as the canonical auth authority; legacy Clerk references in `apps/union-eyes` are compatibility-only.
- **Database**: PostgreSQL + Drizzle ORM
- **Infra**: Azure Container Apps (Canada Central staging)
- **CI**: 47 GitHub Actions workflows covering governance, security, deployment, and compliance
- **Monorepo**: pnpm workspaces + Turborepo

See [ARCHITECTURE.md](ARCHITECTURE.md) for full technical overview, [docs/architecture/ARCHITECTURE_MAP.md](docs/architecture/ARCHITECTURE_MAP.md) for the decision-infrastructure architecture map, and [docs/architecture/decision-infrastructure-map.md](docs/architecture/decision-infrastructure-map.md) for product-to-decision mapping.

## Audit Guarantees

- Decisions are immutable: each NAR is persisted to append-only storage and immutable Azure Blob retention.
- Proofs are independently verifiable: records include hash, signature, and chain linkage for external validation.
- Records are retained under policy: immutable retention defaults to 7 years with legal-hold support.
- System is audit-ready: scoped auditor tokens can verify and export signed evidence packs without mutation access.

## Decision Intelligence

- `@nzila/decision-intelligence` aggregates irreversible decision records into analytics-ready models.
- `@nzila/policy-intelligence` scores production policies, detects drift, and suggests rule improvements.
- `/api/intelligence/*` exposes tiered intelligence APIs: Basic for metrics, Pro for policy insights, Enterprise for anonymized benchmarks.
- Intelligence is the moat: exports remain raw; benchmark and recommendation layers are only available inside Nzila.

## Documentation

| Audience | Location | Contents |
|----------|----------|----------|
| **Builders** | [docs/builders/](docs/builders/) | Setup, commands, architecture, contributing |
| **Operators** | [docs/ops/](docs/ops/) | Release, incidents, staging, runbooks |
| **Buyers** | [docs/buyers/](docs/buyers/) | Product packs, security, reliability, pricing |
| **Security** | [SECURITY.md](SECURITY.md), [docs/governance/](docs/governance/) | Policies, threat model, vendor assessment |
| **Investors** | [docs/investor/](docs/investor/) | Growth narrative, moat analysis, revenue scenarios |
| **All** | [docs/INDEX.md](docs/INDEX.md) | Complete documentation index |

## Maturity Signals

- 170+ governed packages with lifecycle classification
- Board-grade capital allocation with live signal connectors
- SOC 2 / ISO 27001 compliance automation
- SBOM generation, Trivy container scans, DAST via OWASP ZAP
- Red-team adversarial testing (nightly)
- Game-day chaos engineering (weekly)
- Evidence-first proof packs for buyer diligence
