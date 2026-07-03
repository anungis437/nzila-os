# Azure Production Baseline (Phase 5)

- **Captured:** 2026-07-03 via Azure CLI (`az`), operator `support@onelabtech.com`.
- **Method:** live `az` reads only. No secret values printed. IDs redacted.

> Redaction: subscription/tenant/principal IDs truncated. App registration IDs
> are semi-public and shown truncated for correlation only.

## Subscription / tenant

- Subscription: `Azure subscription 1 Nzila` (id `5d819f33-****`)
- Tenant: `One Lab Technologies Corp.` (`onelabtech.com`, id `5082b8be-****`)
- Operator: `support@onelabtech.com` (read-oriented; write operations may be permission-limited).

## Resource groups (relevant)

| RG | Location | Role |
| --- | --- | --- |
| `nzila-canada-staging-rg` | canadacentral | staging |
| `nzila-canada-demo-rg` | canadacentral | demo |
| `nzila-canada-pilot-rg` | canadacentral | pilot |
| `nzila-canada-prod-rg` | canadacentral | **production (dedicated)** |
| `nzila-staging-rg` | eastus | legacy/older staging |

## Container App environments

| Env | RG |
| --- | --- |
| `nzila-canada-staging-env` | staging-rg |
| `nzila-canada-demo-env` | demo-rg |
| `nzila-canada-pilot-env` | pilot-rg |
| **`nzila-canada-prod-env`** | **prod-rg** |

## Container apps (placement)

- **Production env (`nzila-canada-prod-env` / prod-rg):** `nzila-os-union-eyes-prod`
  (image **tag-pinned** `nzila-os-union-eyes:6262e38…`, not `@sha256`).
- **Staging env:** web, console, partners, zonga, control-plane, platform-admin,
  flow, cfo, agrimo, cora, trade, mobility, orchestrator-api, abr, union-eyes-staging
  (most **digest-pinned** `@sha256:…`).
- **Demo env:** `nzila-os-union-eyes-demo`. **Pilot env:** `nzila-os-union-eyes-pilot` + django backend.

> Key fact: only **union-eyes** has an isolated production runtime. `web`/`partners`
> run **only** in staging-env despite `prod-approved` status.

## Databases (Postgres flexible servers)

| Server | RG | Version | Role |
| --- | --- | --- | --- |
| `nzila-os-union-eyes-prod-db` | prod-rg | 16 | **production (30d retention, geo-redundant, Zone-redundant HA, 256GB)** |
| `nzila-ue-prod-db-drill-20260520` | prod-rg | 16 | **restore-drill evidence** |
| `nzila-canada-pilot-db` | pilot-rg | 16 | pilot |
| `nzila-os-union-eyes-demo-db` | demo-rg | 16 | demo |
| `nzila-staging-db` | staging-rg | 15 | staging |

## OIDC / identity

- App registrations: `nzila-os-deploy-prod` (`5d05ed4c-****`), `nzila-os-deploy-staging`,
  `nzila-os-deploy-pilot`, `nzila-os-deploy-demo`, `nzila-os-build`, `nzila-os-cicd`.
- `nzila-os-deploy-prod` federated credential `gha-production`: issuer
  `token.actions.githubusercontent.com`, subject
  `repo:anungis437/nzila-os:environment:production` (environment-scoped, not wildcard).
- No user-assigned managed identities (`az identity list` empty) — deploy uses App-registration federation.

## Monitoring

- Log Analytics: dedicated **`nzila-canada-prod-law`** (prod-rg), plus staging/demo/pilot workspaces.
- `az monitor app-insights component list` — CLI subcommand not available in this
  environment (extension); App Insights presence not confirmed via this path.

## ACR

- `nzilacanadaacr.azurecr.io` (shared registry across environments).

## Permission gaps observed

- `az monitor app-insights` extension subcommand unavailable (tooling gap, not permission).
- Write operations (RG creation, federated-credential edits, revision image swaps)
  not attempted — operator is read-oriented; any change is `PERMISSION-LIMITED` and
  recorded with exact remediation in the relevant certification.
