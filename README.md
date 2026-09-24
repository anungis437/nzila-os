# Nzila OS

NzilaOS is decision infrastructure: a shared system for capturing, evaluating, proving, replaying, and governing organizational decisions across multiple domains. NzilaOS itself is internal acceleration IP — it is not sold directly.

Every product surface is a thin interface over a shared decision core:

```ts
Decision = Input + Policy + Actor Authority + Outcome + Proof
```

## What NzilaOS is not

- Not a product sold under the name "NzilaOS" — customers buy a product surface (Union Eyes, CIVIC, …), not the platform.
- Not a general-purpose application framework — apps consume platform authorities, they do not re-implement them.
- Not a description of production readiness. Code existing in this repository does not imply a capability is deployed, runtime-verified, or operationally proven. Readiness is asserted only where explicit evidence is on file.

## Where to start

| You are… | Start here |
| --- | --- |
| Reading for the first time | This file, then [ARCHITECTURE.md](ARCHITECTURE.md) |
| Looking for any document | [docs/INDEX.md](docs/INDEX.md) (curated) · [docs/documentation-index.md](docs/documentation-index.md) (generated, exhaustive) |
| Building | [docs/categories/stakeholders/builders/](docs/categories/stakeholders/builders/) |
| Operating / on call | [docs/categories/platform-and-operations/ops/](docs/categories/platform-and-operations/ops/) |
| Reviewing security or governance | [SECURITY.md](SECURITY.md) · [docs/categories/platform-and-operations/governance/](docs/categories/platform-and-operations/governance/) |
| Working on Union Eyes | [docs/union-eyes/README.md](docs/union-eyes/README.md) — read it before touching `apps/union-eyes` |
| Working on CIVIC / OCI | [docs/CIVIC_OCI_ALIGNMENT.md](docs/CIVIC_OCI_ALIGNMENT.md) |
| Looking for history | [docs/categories/historical-archive/README.md](docs/categories/historical-archive/README.md) |

## Commercial spine (two lanes only)

Only two lanes are the active commercial motion:

1. **Union Eyes** — near-term commercial lane. Living engineering and readiness authority:
   [docs/union-eyes/README.md](docs/union-eyes/README.md). Current gate:
   `UE_SAAS_OPERATIONAL_READINESS = NO_GO — RUNTIME_PROOF_REQUIRED`.
2. **CIVIC** — cautious public-institution lane, currently in discovery / market engagement,
   pre-revenue. See [docs/CIVIC_OCI_ALIGNMENT.md](docs/CIVIC_OCI_ALIGNMENT.md) and
   [docs/oci/README.md](docs/oci/README.md).

Everything else is portfolio inventory or an internal surface, not part of the current
commercial spine. Read [governance/portfolio/README.md](governance/portfolio/README.md)
before quoting a tier, GTM posture, or revenue field from the catalog as an active sales motion.

## Product surfaces

The fields below are the current values in the portfolio catalog. They describe **inventory
posture**, not an active sales motion — see the commercial spine above.

| Product | Domain | Tier | GTM posture |
| --- | --- | --- | --- |
| **Union Eyes** | Labour representation & case management | 1 | `sell-now` |
| **CIVIC** | Public-institution continuity | 2 | `hold` |
| **CourtLens** (`apps/abr`) | Access-to-justice & legal matter intelligence; retains FAIRCASE tribunal-intelligence lineage | 2 | `hold` |
| **Flow** | SMB operations & commerce automation | 2 | `hold` |
| **CFO** | Finance workflows | 2 | `maintain` |
| **Partners** | Partner enablement portal | 2 | `maintain` |
| **Console** | Internal ops & governance control surface | 3 | `internal-only` |
| **Control Plane** | Platform governance engine | 3 | `internal-only` |
| **Orchestrator API** | Workflow execution engine | 3 | `internal-only` |
| **Web** | Public marketing & lead generation | 3 | `maintain` |
| **Agrimo** · **Cora** · **Trade** · **Mobility** · **NACP Exams** · **Zonga** | Incubating domain surfaces | 4 | `hold` |
| **Platform Admin** · **Mobility Client Portal** | Being wound down | 5 | `sunset` |

- Editable truth source: [governance/portfolio/product-catalog.json](governance/portfolio/product-catalog.json)
  (the only editable portfolio authority — everything else is generated from it).
- Generated portfolio view: [reports/portfolio-status.md](reports/portfolio-status.md).
- Generated platform/app status manifest: [nzila-truth-manifest.json](nzila-truth-manifest.json).

## Decision core

- `packages/decision-core` defines the canonical decision primitives, registry, and enforcement helper.
- **Control Plane** governs policy evaluation, governance lifecycle, entitlements, workflow definitions, approval policy, and the integration registry.
- **Orchestrator** executes approved workflows and owns command dispatch, event fabric, and job state.
- **Console** is an operator interface: it reviews proof, replay, and operating risk; it does not own policy evaluation or governance writes.
- **Platform Admin** governs org-scoped users, settings, and member roles.
- `@nzila/platform-auth` is the canonical authentication authority.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the authoritative capability-ownership map and the
rules that prevent parallel sources of truth.

## Quick start

```bash
pnpm install            # Install all dependencies
pnpm dev:web            # Start the web app
pnpm dev:console        # Start the console
pnpm test:fast          # Run unit tests (skip contract tests)
pnpm build              # Build everything
```

Bootstrap and seed workflows are idempotent and safe to re-run.

## Repo structure

```
apps/              Product and internal application surfaces
packages/          Shared platform, domain, and infrastructure libraries
services/          Backend services
tooling/           Contract tests, scaffolding, CI tools
governance/        Portfolio catalog, capital model, commercial data
scripts/           Validation, release, SRE, finops tooling
docs/              Documentation (see docs/INDEX.md)
ops/               Environment configs, runbooks, policies
reports/           Generated reports (portfolio, SRE, compliance)
infrastructure/    IaC and deployment configs
```

Counts of apps, packages, workflows, and tests are deliberately not hardcoded here. The
canonical, regenerated inventory is
[tooling/repo-inventory/output/repo-inventory.md](tooling/repo-inventory/output/repo-inventory.md)
(`pnpm docs:sync` verifies docs against it).

## Canonical commands

### Daily development

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start all apps |
| `pnpm build` | Build everything |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm test:fast` | Fast tests (skip contracts) |
| `pnpm test` | Full test suite |

### Validation before review

| Command | Purpose |
|---------|---------|
| `pnpm format:check` | Prettier formatting check |
| `pnpm validate:docs` | Documentation consistency check |
| `pnpm link-check` | Markdown link check (honours `.linkcheckignore`) |
| `pnpm docs:sync` | Verify docs against the canonical repo inventory |
| `pnpm architecture:check` | Layer, authority, contract, and registry checks |
| `pnpm governance:audit` | Doc, ownership, release, and repo audit |

### Release & deploy

| Command | Purpose |
|---------|---------|
| `pnpm release:staging` | Staging gate (audit + smoke + migration safety) |
| `pnpm release:prod` | Production gate (full checks) |
| `pnpm release:rollback` | Roll back production |
| `pnpm release:hotfix` | Initiate hotfix |

### Operations

| Command | Purpose |
|---------|---------|
| `pnpm db:local:up` | Start local PostgreSQL (docker-compose.automation.yml) |
| `pnpm db:doctor` | Database health check |
| `pnpm sre:validate` | Full SRE check (health, synthetics, alerts, audit) |
| `pnpm finops:build` | FinOps portfolio report |
| `pnpm evidence:pack:monthly` | Monthly evidence pack |

### Portfolio & capital

| Command | Purpose |
|---------|---------|
| `pnpm generate:portfolio-artifacts` | Regenerate all portfolio reports from the catalog |
| `pnpm generate:capital-allocation` | Capital allocation engine |
| `pnpm generate:commercial-traction` | Commercial traction reports |

Full command catalog: `pnpm help:commands`.

## Release model

Staging → production promotion with governance gates at every step:

1. **Staging gate** — `pnpm release:staging` runs audit, migration safety, and smoke tests.
2. **Production gate** — `pnpm release:prod` adds secret audit and full deployment resolution.
3. **Rollback** — `pnpm release:rollback` for immediate revert.
4. **Hotfix** — `pnpm release:hotfix` with SLA tracking.

CI enforces portfolio-governance, compliance drift, and reliability checks on every PR.

## Portfolio Governance

- **Single truth source** — [governance/portfolio/product-catalog.json](governance/portfolio/product-catalog.json) drives all portfolio artifacts.
- **Generated status** — [reports/portfolio-status.md](reports/portfolio-status.md).
- **Capital discipline** — allocation weights, runway scenarios, override tracking.
- **Commercial traction** — pipeline, pilot conversion, retention risk, with evidence separation.
- **Evidence packs** — monthly tamper-evident audit packs in [proof-artifacts/](proof-artifacts/).
- **Contract tests** — `tooling/contract-tests/` enforces platform boundaries, security posture, and operating standards.

## Architecture at a glance

- **Decision infrastructure** — `@nzila/decision-core` defines canonical decision records, registry entries, and route-level enforcement helpers.
- **Auth** — `@nzila/platform-auth` is the canonical authority: email/password (Argon2id) plus optional Entra SSO. Legacy Clerk references in `apps/union-eyes` are compatibility-only.
- **Database** — PostgreSQL + Drizzle ORM.
- **Infra** — Azure Container Apps (Canada Central staging).
- **CI** — GitHub Actions covering governance, security, deployment, and compliance.
- **Monorepo** — pnpm workspaces + Turborepo.

Deeper reading: [ARCHITECTURE.md](ARCHITECTURE.md),
[docs/categories/platform-and-operations/architecture/ARCHITECTURE_MAP.md](docs/categories/platform-and-operations/architecture/ARCHITECTURE_MAP.md),
[docs/categories/platform-and-operations/architecture/decision-infrastructure-map.md](docs/categories/platform-and-operations/architecture/decision-infrastructure-map.md).

## Audit guarantees

These are the designed and implemented properties of the audit substrate. Where a property
requires runtime proof for a specific product, that product's readiness page is authoritative.

- Decisions are immutable: each NAR is persisted to append-only storage and immutable Azure Blob retention.
- Proofs are independently verifiable: records include hash, signature, and chain linkage for external validation.
- Records are retained under policy: immutable retention defaults to 7 years with legal-hold support.
- Scoped auditor tokens can verify and export signed evidence packs without mutation access.

## Decision intelligence

- `@nzila/decision-intelligence` aggregates irreversible decision records into analytics-ready models.
- `@nzila/policy-intelligence` scores production policies, detects drift, and suggests rule improvements.
- `/api/intelligence/*` exposes tiered intelligence APIs: Basic for metrics, Pro for policy insights, Enterprise for anonymized benchmarks.
- Exports remain raw; benchmark and recommendation layers stay inside Nzila.

## Documentation map

| Audience | Location |
|----------|----------|
| **Builders** | [docs/categories/stakeholders/builders/](docs/categories/stakeholders/builders/) |
| **Operators** | [docs/categories/platform-and-operations/ops/](docs/categories/platform-and-operations/ops/) · [docs/ops/](docs/ops/) |
| **Buyers** | [docs/categories/stakeholders/buyers/](docs/categories/stakeholders/buyers/) |
| **Security & governance** | [SECURITY.md](SECURITY.md) · [docs/categories/platform-and-operations/governance/](docs/categories/platform-and-operations/governance/) |
| **Investors** | [docs/categories/stakeholders/investor/](docs/categories/stakeholders/investor/) |
| **Products & market** | [docs/categories/products-and-market/](docs/categories/products-and-market/) |
| **Historical archive** | [docs/categories/historical-archive/](docs/categories/historical-archive/) |
| **Everything** | [docs/INDEX.md](docs/INDEX.md) |

## Conventions for contributors and coding agents

- `ARCHITECTURE.md` owns capability ownership and the rules that forbid shadow authorities.
- `governance/portfolio/product-catalog.json` owns product posture; generated artifacts must not be hand-edited.
- `docs/union-eyes/README.md` owns Union Eyes readiness; `apps/union-eyes/lib/reality/capability-registry.ts` owns Union Eyes capability state.
- `docs/oci/SUPERSEDED.md` owns the disposition ledger for OCI/CIVIC doctrine.
- Documents that describe a completed programme or a past state carry a status banner at the top and are not current authority.
- Before changing Union Eyes, read the order stated in [AGENTS.md](AGENTS.md).

See [CONTRIBUTING.md](CONTRIBUTING.md) for the repo contract and PR expectations.
