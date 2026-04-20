# Command Reference

Complete command catalog for Nzila OS. Run `pnpm help:commands` for the machine-generated version.

## Core Development

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start all apps in dev mode |
| `pnpm dev:web` | Start web app only |
| `pnpm dev:console` | Start console only |
| `pnpm dev:flow` | Start Flow app only |
| `pnpm build` | Build all packages and apps |
| `pnpm build:<app>` | Build a specific app (e.g., `build:web`, `build:console`) |
| `pnpm lint` | Lint everything |
| `pnpm typecheck` | Type-check everything |
| `pnpm clean` | Remove all build outputs |
| `pnpm format` | Format all files with Prettier |

## Testing

| Command | Purpose |
|---------|---------|
| `pnpm test` | Full test suite via Turbo |
| `pnpm test:fast` | Unit tests only (skip contract tests) |
| `pnpm test:changed` | Tests for packages changed since last commit |
| `pnpm test:platform` | Platform package tests only |
| `pnpm contract-tests` | Run all 200+ contract tests |
| `pnpm test:coverage` | Tests with coverage |

## Release & Deploy

| Command | Purpose |
|---------|---------|
| `pnpm release:staging` | Staging gate: audit + migration safety + smoke |
| `pnpm release:prod` | Production gate: full checks + deployment |
| `pnpm release:rollback` | Rollback production deployment |
| `pnpm release:rollback:list` | List available rollback targets |
| `pnpm release:hotfix` | Initiate a hotfix |
| `pnpm release:hotfix:sla` | Check hotfix SLA compliance |
| `pnpm release:tag` | Tag a release |
| `pnpm release:audit` | Release governance audit |
| `pnpm release:smoke` | Smoke test staging |
| `pnpm release:dashboard` | Release dashboard |
| `pnpm deploy:evidence` | Build deployment evidence pack |

## Database

| Command | Purpose |
|---------|---------|
| `pnpm db:doctor` | Database health check |
| `pnpm db:doctor:strict` | Strict DB health check |
| `pnpm db:migration:safety` | Validate pending migrations |
| `pnpm db:drift:check` | Check for schema drift |

## Governance & Validation

| Command | Purpose |
|---------|---------|
| `pnpm validate:governance` | Full governance gate (GA, contracts, portfolio, auth, workspace) |
| `pnpm governance:audit` | Docs + ownership + release + repo audit |
| `pnpm governance:check` | Core governance check |
| `pnpm validate:portfolio-governance` | Portfolio truth validation |
| `pnpm validate:all` | All validation checks |
| `pnpm architecture:check` | Full architecture validation |
| `pnpm repo:audit` | Repo excellence audit |

## Portfolio & Capital

| Command | Purpose |
|---------|---------|
| `pnpm generate:portfolio-artifacts` | Regenerate all portfolio reports from catalog |
| `pnpm generate:capital-allocation` | Capital allocation engine |
| `pnpm generate:commercial-traction` | Commercial traction reports |
| `pnpm validate:capital-discipline` | Capital discipline gates |
| `pnpm cash:calendar` | 30/60/90 liquidity report |
| `pnpm runway:model` | Runway scenario evaluation |
| `pnpm capital:override:add` | Add a capital override |

## SRE & Operations

| Command | Purpose |
|---------|---------|
| `pnpm sre:validate` | Full SRE check (health, synthetics, alerts, audit) |
| `pnpm sre:dashboard` | SRE executive dashboard |
| `pnpm sre:audit` | Reliability audit |
| `pnpm finops:build` | FinOps portfolio report |
| `pnpm evidence:pack:monthly` | Monthly evidence pack |
| `pnpm docs:index` | Rebuild documentation index |

## Security

| Command | Purpose |
|---------|---------|
| `pnpm secret-scan` | Gitleaks secret scan |
| `pnpm redteam` | Red-team adversarial tests |
| `pnpm verify:security` | Security headers check |
| `pnpm generate:sbom` | Generate SBOM |

## Scaffolding

| Command | Purpose |
|---------|---------|
| `pnpm create-app` | Scaffold a new governed app |
| `pnpm scaffold:app` | Golden-path app scaffold |
