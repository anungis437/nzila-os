# Scripts

> One-shot and operational scripts for building, seeding, analyzing, and deploying the Nzila OS monorepo.

## Categories

### Build & CI

Release gates, attestation, SBOM, and SLO enforcement.

| Script | Purpose |
|--------|---------|
| `attest-build.ts` | Build attestation / signing |
| `build-baseline.ts` | Captures build baseline metrics |
| `generate-sbom.ts` | Software Bill of Materials generation |
| `release-attestation.ts` | Release attestation for CI pipelines |
| `validate-release-strict.ts` | Strict release gate validation |
| `validate-change-window.ts` | Change window enforcement |
| `validate-runtime.ts` | Runtime validation checks |
| `slo-gate.ts` | SLO gate enforcement |

### Database — Seeds & Migrations

SQL seeds, migration generators, and data fixes.

| Script | Purpose |
|--------|---------|
| `staging-seed.ts` | TypeScript staging seed orchestrator |
| `seed-staging-full.sql` | Full staging seed |
| `seed-staging-autoseed.sql` | Auto-seed for staging environment |
| `seed-cape-data.sql` | Seeds CAPE domain data |
| `seed-commerce-dev.sql` | Seeds commerce dev data |
| `seed-organization-members.sql` | Seeds org member data |
| `seed-ai-profiles-ue.sql` | Seeds AI profiles for UnionEyes |
| `seed-compliance-data.sql` | Seeds compliance data |
| `seed-financial-domains.sql` | Seeds financial domain data |
| `generate-corrective-migration.ts` | Generates corrective migration scripts |
| `generate-stub-migration.ts` | Generates stub migration scaffolds |
| `zonga-seed.ts` | Zonga seed orchestrator |
| `count-populated.sql` | Counts populated rows |
| `create-compliance-tables.sql` | Creates compliance tables |
| `fix-*.sql` | Various data fixes (nulls, FK, stubs, nesting) |
| `seed-staging-*.sql` | Staging seed batches and patches |
| `migrations/` | Sub-scripts for `agri/` and `trade/` |

### Auth Provisioning

Test user and account provisioning for email/password and Entra SSO.

| Script | Purpose |
|--------|---------|
| `provision-entra-test-users.mjs` | Provisions Entra SSO test users |
| `provision-all-test-users.mjs` | Provisions all test users |
| `seed-test-auth-accounts.mjs` | Seeds test auth accounts |
| `seed-zonga-auth-accounts.mjs` | Seeds Zonga auth accounts |
| `migrate-clerk-to-entra.mjs` | Clerk → Entra migration (historical) |
| `clerk-provision-pilot-orgs.mjs` | Legacy: Clerk pilot org provisioning |
| `zonga-clerk-provision.mjs` | Legacy: Zonga Clerk provisioning |
| `seed-console-local-ai.sql` | Seeds local console AI app, profiles, models, deployments, and routes |

### Analysis & Checks

Governance, architecture, and readiness enforcement scripts.

| Script | Purpose |
|--------|---------|
| `governance-check.ts` | Governance enforcement |
| `platform-authority-check.ts` | Enforces authoritative package map and overlap drift rules |
| `governance-snapshot.ts` | Governance snapshot generator |
| `architecture-layer-check.ts` | Architecture layer enforcement |
| `platform-contract-check.ts` | Platform contract validation |
| `dependency-boundary-check.ts` | Dependency boundary enforcement |
| `check-dependency-policy.ts` | Dependency policy validation |
| `validate-readmes.ts` | README completeness check |
| `link-check.ts` | Documentation link checker |
| `schema-audit.ts` | Schema audit |
| `validate-portfolio.ts` | Portfolio validation |
| `platform-health-report.ts` | Platform health report generator |
| `agri-*.ts` | Agrimo-specific checks (7 scripts) |
| `cfo-*.ts` | CFO-specific checks (2 scripts) |
| `zonga-*.ts` | Zonga-specific checks (3 scripts) |
| `control-plane-*.ts` | Control plane checks (3 scripts) |
| `app-*.ts` | App-wide checks (lifecycle, gold-standard, domain) |

### Deployment & Ops

Rollback, health, and pilot readiness.

| Script | Purpose |
|--------|---------|
| `rollback.ts` | Rollback utility |
| `environment-health.ts` | Environment health check |
| `validate-cupe-pilot-readiness.sh` | CUPE pilot readiness validation |

### Utilities

Scaffolding, codemods, and generators.

| Script | Purpose |
|--------|---------|
| `create-nzila-app.ts` | Scaffolds a new Nzila app |
| `generate-package-meta.ts` | Generates package metadata |
| `codemod-console-to-logger.mjs` | Replaces `console.log` with logger |
| `rfp-generate.ts` | RFP document generator |
| `reproduce-evidence.ts` | Reproduces evidence artifacts |
| `demo-golden-path.ts` | Demo: golden path walkthrough |

### Proof Artifacts (`proof/`)

Build proof generation and verification.

| Script | Purpose |
|--------|---------|
| `proof/proof-artifacts.ts` | Proof artifact generator |
| `proof/run-proof.ts` | Proof runner |
| `proof/verify-artifacts.ts` | Proof verifier |
| `proof/clean-proof-artifacts.ts` | Proof cleanup |

## Running

Most scripts use `tsx`:

```bash
npx tsx scripts/<script-name>.ts
```

SQL scripts target the PostgreSQL database:

```bash
psql -U nzila -d nzila_automation -f scripts/<script-name>.sql
```
