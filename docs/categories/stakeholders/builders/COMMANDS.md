# Command Reference

Complete command catalog for Nzila OS. Run `node tooling/scripts/show-command-catalog.mjs` for the machine-generated version.

## Core Development

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start all apps in dev mode |
| `pnpm dev:web` | Start web app only |
| `pnpm dev:console` | Start console only |
| `pnpm dev:flow` | Start Flow app only |
| `pnpm build` | Build all packages and apps |
| `pnpm exec turbo build --filter=@nzila/<app>...` | Build a specific app (e.g., `@nzila/web`, `@nzila/console`) |
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
| `pnpm exec tsx scripts/release/generate-governance-audit.ts && pnpm exec tsx scripts/release/validate-migration-safety.ts && pnpm exec tsx scripts/release/run-smoke.ts --env staging --apps web,console,partners,union-eyes,cfo,flow,abr` | Staging gate: audit + migration safety + smoke |
| `pnpm exec tsx scripts/release/generate-governance-audit.ts && pnpm exec tsx scripts/release/audit-secrets.ts && tsx scripts/release/resolve-deploy-apps.ts --env production --apps all` | Production gate: full checks + deployment |
| `pnpm exec tsx scripts/release/rollback-prod.ts` | Rollback production deployment |
| `pnpm exec tsx scripts/release/rollback-prod.ts --list` | List available rollback targets |
| `pnpm exec tsx scripts/release/hotfix-initiate.ts` | Initiate a hotfix |
| `pnpm exec tsx scripts/release/hotfix-sla.ts` | Check hotfix SLA compliance |
| `pnpm exec tsx scripts/release/tag-release.ts` | Tag a release |
| `pnpm exec tsx scripts/release/generate-governance-audit.ts` | Release governance audit |
| `pnpm exec tsx scripts/release/run-smoke.ts --env staging --apps web,console,partners,union-eyes,cfo,flow,abr` | Smoke test staging |
| `pnpm exec tsx scripts/release/portfolio-dashboard.ts` | Release dashboard |
| `pnpm exec tsx scripts/release/build-deploy-evidence.ts --env staging` | Build deployment evidence pack |

## Database

| Command | Purpose |
|---------|---------|
| `pnpm exec tsx scripts/db/doctor.ts` | Database health check |
| `pnpm exec tsx scripts/db/doctor.ts -- --strict` | Strict DB health check |
| `pnpm exec tsx scripts/db/migration-safety.ts` | Validate pending migrations |
| `pnpm exec tsx scripts/db/drift-check.ts` | Check for schema drift |

## Governance & Validation

| Command | Purpose |
|---------|---------|
| `pnpm exec tsx tooling/ga-check/ga-check.ts && pnpm contract-tests && pnpm inventory:check && pnpm exec tsx scripts/check-brand-leakage.ts && pnpm exec tsx scripts/validate-product-catalog.ts && pnpm exec tsx scripts/validate-portfolio.ts && pnpm exec tsx scripts/validate-canonical-truth.ts && pnpm exec tsx scripts/validate-truth-authority.ts && pnpm exec tsx scripts/validate-auth-authority.ts && pnpm exec tsx scripts/validate-ga-state.ts && pnpm exec tsx scripts/validate-workspace-links.ts && pnpm exec tsx scripts/validate-release-strict.ts && pnpm exec tsx scripts/generate-commercial-traction.ts` | Full governance gate (GA, contracts, portfolio, auth, workspace) |
| `pnpm exec tsx packages/platform-validation/src/doc-consistency.ts && tsx scripts/build-ownership-registry.ts && pnpm exec tsx scripts/docs/build-docs-index.ts && pnpm exec tsx scripts/release/generate-governance-audit.ts && pnpm exec tsx scripts/release/audit-secrets.ts && pnpm exec tsx scripts/repo/build-excellence-audit.ts && pnpm exec tsx scripts/check-ue-db-import-guard.ts && pnpm exec tsx scripts/financial-service-health.ts` | Docs + ownership + release + repo audit |
| `pnpm exec tsx scripts/governance-check.ts` | Core governance check |
| `pnpm exec tsx scripts/check-brand-leakage.ts && pnpm exec tsx scripts/validate-product-catalog.ts && pnpm exec tsx scripts/validate-portfolio.ts && pnpm exec tsx scripts/validate-canonical-truth.ts && pnpm exec tsx scripts/validate-truth-authority.ts` | Portfolio truth validation |
| `pnpm exec tsx packages/platform-validation/src/run-all.ts` | All validation checks |
| `pnpm exec tsx scripts/architecture-layer-check.ts && pnpm exec tsx scripts/app-domain-core-check.ts && pnpm exec tsx scripts/platform-surface-model-check.ts && pnpm exec tsx scripts/platform-authority-check.ts && pnpm exec tsx scripts/platform-contract-check.ts && pnpm exec tsx scripts/registry-consistency-check.ts && pnpm exec tsx scripts/control-plane-coherence-check.ts && pnpm exec tsx scripts/platform-adoption-gate.ts` | Full architecture validation |
| `pnpm exec tsx scripts/repo/build-excellence-audit.ts` | Repo excellence audit |

## Portfolio & Capital

| Command | Purpose |
|---------|---------|
| `pnpm exec tsx scripts/generate-portfolio-artifacts.ts` | Regenerate all portfolio reports from catalog |
| `pnpm exec tsx scripts/generate-capital-allocation.ts` | Capital allocation engine |
| `pnpm exec tsx scripts/generate-commercial-traction.ts` | Commercial traction reports |
| `pnpm exec tsx scripts/validate-capital-discipline.ts` | Capital discipline gates |
| `pnpm exec tsx scripts/cash-calendar.ts` | 30/60/90 liquidity report |
| `pnpm exec tsx scripts/runway-model.ts` | Runway scenario evaluation |
| `pnpm exec tsx scripts/add-capital-override.ts` | Add a capital override |

## SRE & Operations

| Command | Purpose |
|---------|---------|
| `pnpm exec tsx scripts/sre/validate-health-contract.ts && pnpm exec tsx scripts/sre/synthetic-dry-run.ts && pnpm exec tsx scripts/sre/alert-routing-dry-run.ts && pnpm exec tsx scripts/sre/audit-reliability.ts && pnpm exec tsx scripts/sre/generate-executive-dashboard.ts` | Full SRE check (health, synthetics, alerts, audit) |
| `pnpm exec tsx scripts/sre/generate-executive-dashboard.ts` | SRE executive dashboard |
| `pnpm exec tsx scripts/sre/audit-reliability.ts` | Reliability audit |
| `pnpm exec tsx scripts/finops/build-portfolio-finops.ts` | FinOps portfolio report |
| `pnpm exec tsx scripts/proof/build-monthly-evidence-pack.ts` | Monthly evidence pack |
| `pnpm exec tsx scripts/docs/build-docs-index.ts` | Rebuild documentation index |

## Security

| Command | Purpose |
|---------|---------|
| `pnpm secret-scan` | Gitleaks secret scan |
| `pnpm exec tsx security/redteam/profile-runner.ts` | Red-team adversarial tests |
| `pnpm exec tsx tooling/security-headers-check.ts` | Security headers check |
| `pnpm exec tsx scripts/generate-sbom.ts` | Generate SBOM |

## Scaffolding

| Command | Purpose |
|---------|---------|
| `pnpm exec tsx scripts/create-nzila-app.ts` | Scaffold a new governed app |
| `pnpm exec tsx tooling/golden-path/scaffold-governed-app.ts` | Golden-path app scaffold |
