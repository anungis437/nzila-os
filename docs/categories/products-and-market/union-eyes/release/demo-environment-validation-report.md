# Union Eyes — Demo Environment Validation Report

**Environment:** `demo`
**Status:** **Partially validated** — runtime healthy, schema migration **BLOCKED**
**Date:** 2026-05-09
**Operator:** support@onelabtech.com
**Subscription:** Azure subscription 1 Nzila (`5d819f33-d16f-429c-a3c0-5b0e94740ba3`)
**Region:** canadacentral
**Topology:** [Transitional Controlled Shared-Secret Topology (TSOSA)](./transitional-shared-secret-topology.md)
**Last commit at provisioning:** `5429a11fe` (`feat/trustcore-trust-ops-v1`)

---

## 1. Provisioned Resources

| Resource           | Name                                                                                         |
|--------------------|----------------------------------------------------------------------------------------------|
| Resource group     | `nzila-canada-demo-rg`                                                                       |
| Log Analytics      | `nzila-canada-demo-law`                                                                      |
| Container Apps env | `nzila-canada-demo-env`                                                                      |
| Postgres Flex      | `nzila-os-union-eyes-demo-db`                                                                |
| PG database        | `nzila_os_demo`                                                                              |
| PG admin user      | `nzilaadmin`                                                                                 |
| Per-env Key Vault  | `nzila-canada-demo-kv` (`https://nzila-canada-demo-kv.vault.azure.net/`)                     |
| Container App      | `nzila-os-union-eyes-demo`                                                                   |
| ACA FQDN           | `nzila-os-union-eyes-demo.greenmoss-d27e0e19.canadacentral.azurecontainerapps.io`            |
| Active revision    | `nzila-os-union-eyes-demo--0000001`                                                          |
| Image              | `nzilacanadaacr.azurecr.io/nzila-os-union-eyes:production`                                   |
| Managed Identity   | system-assigned, principalId `29f883c1-465d-410a-b7c4-56260d522133`                          |

### 1.1 Role assignments granted

- Demo MI → **AcrPull** on `nzilacanadaacr` (post-provision; required because
  Bicep cannot grant role to an MI it just created in the same deployment).
- Demo MI → **Key Vault Secrets User** on `nzila-canada-demo-kv` (per-env
  vault — DB credentials).
- Demo MI → **Key Vault Secrets User** on `nzila-staging-kv` (TSOSA — 15
  shared app secrets).

---

## 2. Runtime Identity

`/api/health` (HTTP 200):

```json
{
  "status": "ok",
  "app": "union-eyes",
  "environment": "demo",
  "gitSha": "df936f414bd41a572932f87b9fd8714766ada611",
  "buildTimestamp": "2026-05-09T10:04:39Z",
  "artifactId": "df936f414bd41a572932f87b9fd8714766ada611",
  "releaseId": "UE-2026-05-09-df936f4-demo",
  "appVersion": "0.0.0",
  "checks": {
    "process": "ok",
    "database": "ok"
  }
}
```

The payload deliberately does **not** expose secret-topology metadata
publicly. See §3 for runtime topology metadata.

---

## 3. Secret Topology (TSOSA)

The active revision carries:

| Variable                   | Value                                                            |
|----------------------------|------------------------------------------------------------------|
| `SECRET_TOPOLOGY`          | `transitional-shared`                                            |
| `SECRET_AUTHORITY`         | `nzila-staging-kv`                                               |
| `ENVIRONMENT_ISOLATION`    | `partial`                                                        |
| `NZILA_MODE`               | `demo`                                                           |
| `UE_ENVIRONMENT`           | `demo`                                                           |
| `UE_DEPLOYMENT_TYPE`       | `demo`                                                           |
| `UE_FEATURE_PROFILE`       | `demo`                                                           |

### 3.1 Secret bindings

| Secret name (ACA)         | Resolved from                                                   |
|---------------------------|------------------------------------------------------------------|
| `db-password`             | `nzila-canada-demo-kv` / `DB-PASSWORD` (per-env)                 |
| `database-url`            | `nzila-canada-demo-kv` / `database-url` (per-env)                |
| 14 shared app secrets     | `nzila-staging-kv` (TSOSA — see manifest)                        |

All bindings use `keyvaultref:.../secrets/<name>,identityref:system`. No
secret values exist in the Container App definition, in Bicep, or in any
repository file.

---

## 4. Validation Checklist

| # | Check                                  | Result                                                                                |
|---|----------------------------------------|---------------------------------------------------------------------------------------|
| 1 | ACA provisioned                        | ✅ revision `--0000001` Healthy, 1 replica                                            |
| 2 | Image pulled from ACR                  | ✅ AcrPull granted; pull successful after first failure                               |
| 3 | DB TCP connectivity (process → PG)     | ✅ `/api/health` `checks.database = ok`                                               |
| 4 | KV resolution via MI                   | ✅ all 16 secret refs resolved at revision activation                                 |
| 5 | `/api/health` returns 200              | ✅                                                                                    |
| 6 | Release metadata (releaseId/sha)       | ✅ `UE-2026-05-09-df936f4-demo` / `df936f414…`                                        |
| 7 | Environment metadata (env/mode)        | ✅ `environment=demo`                                                                 |
| 8 | Secret topology advertised on revision | ✅ `SECRET_TOPOLOGY=transitional-shared` present                                      |
| 9 | DB schema migration                    | ❌ **BLOCKED** — see §5                                                               |
| 10| Proof routes smoke                     | ⏸ pending §9                                                                          |
| 11| Insights routes smoke                  | ⏸ pending §9                                                                          |
| 12| Locale routing                         | ⏸ pending §9                                                                          |
| 13| Auth flow                              | ⏸ pending §9                                                                          |
| 14| Pilot gating                           | ⏸ pending §9                                                                          |
| 15| Role routing                           | ⏸ pending §9                                                                          |

---

## 5. Blocker — DB Schema Migration

`pnpm --filter @nzila/union-eyes db:migrate` against the freshly
provisioned `nzila_os_demo` database fails on historical drizzle
migrations:

- After enabling `vector`, `uuid-ossp`, `pg_trgm`, `btree_gin`,
  `pgcrypto` extensions and resetting `public` + `drizzle` schemas:
  - First failure: `0008_lean_mother_askani` statement #7105 —
    `relation "knowledge_base" does not exist` (table is created in
    `0006` only inside a `DO $$ IF EXISTS pg_type vector $$` guard;
    that part is now resolved by enabling `vector` ahead of migrate).
  - Second failure (after extensions enabled and re-run from scratch):
    `0008_lean_mother_askani` statement #7329 —
    `column "status" does not exist` on
    `CREATE INDEX "bargaining_proposals_status_idx" ON "bargaining_proposals" ("status")`.
    The `bargaining_proposals` table exists but the column it indexes
    does not; the column appears to be added later or by a conditional
    block not satisfied by a fresh DB.

### 5.1 Architectural finding (root cause)

`apps/union-eyes/drizzle.config.ts` declares:

```
schema: "./db/schema/union-structure-standalone.ts"
```

with the comment:

> Drizzle manages ONLY the frontend edge/cache tables in the
> `ue_cache` namespace. Django ORM manages the backend source-of-truth
> tables.

However, `apps/union-eyes/db/migrations/` still contains 90+ historical
migration files generated when drizzle owned a much wider schema. The
`db:migrate` script (`tooling/scripts/run-union-eyes-drizzle-migrate.mjs`)
replays *every* file in that directory regardless of the current drizzle
config scope. Many of those migrations contain conditional `DO $$ IF
EXISTS … $$` blocks that silently no-op on fresh DBs and leave later
ALTER/INDEX statements pointing at non-existent tables/columns.

The referenced architecture doc `docs/architecture/orm-boundary.md` is
**missing from the repository** — confirming the boundary is declared
but not yet codified.

### 5.2 Operator decision required

`db:migrate` cannot be made to succeed on a fresh demo DB without
either:

1. **Schema dump from a known-good environment** (e.g. staging) and
   restoration into `nzila_os_demo`, then marking all existing journal
   entries as applied. This bypasses the broken historical replay.
2. **Pruning / fixing the historical migrations** so they apply cleanly
   on a fresh DB (substantial engineering work; touches 90+ files).
3. **Switching demo DB ownership to Django migrations** if Django is
   intended to be the source of truth, and reducing the drizzle script
   to only push the `ue_cache` schema.

Option (1) is the lowest-risk path to unblock demo validation; (2) and
(3) are required for a sustainable provisioning story for pilot and
production.

---

## 6. Required Pre-Pilot Remediation

Per operator mandate, demo must be fully validated before pilot is
provisioned. The blocker in §5 must therefore be resolved (operator
decision required) before:

- `nzila-canada-pilot-rg` is created
- `nzila-canada-pilot-kv` is created
- `nzila-os-union-eyes-pilot` ACA is provisioned
- pilot DB migrations are attempted

---

## 7. Required Pre-Production Constraints

Per [TSOSA §4](./transitional-shared-secret-topology.md), production
must be provisioned with:

- A self-sufficient `nzila-canada-production-kv` containing the full
  set of secrets.
- **No** Key Vault Secrets User role on `nzila-staging-kv` for the
  production MI.
- Runtime metadata advertising `SECRET_TOPOLOGY=isolated`,
  `SECRET_AUTHORITY=nzila-canada-production-kv`,
  `ENVIRONMENT_ISOLATION=full`.

These constraints are enforced operationally today and must become
contract-tested before the first production release.

---

## 8. Open Items

- [ ] §5 — operator decision on DB migration approach.
- [ ] Re-run validation checklist items 9–15 after schema is in place.
- [ ] Author `docs/architecture/orm-boundary.md` (declared but missing).
- [ ] Add contract test asserting prod advertises `SECRET_TOPOLOGY=isolated`.
- [ ] Add a Bicep `Microsoft.Authorization/roleAssignments` resource for
      AcrPull on the per-env MI so first-deploy bootstrap is one shot.
- [ ] Optionally extend `packages/os-core/src/health.ts` to surface
      `deploymentType` / `featureProfile` (internal route, not public
      `/api/health`).

---

## 9. What Demo Validation **Has** Proven

- The full provisioning sequence works: RG → LAW → ACA env → PG flex →
  per-env KV → ACA with system MI.
- TSOSA secret wiring works end-to-end through Managed Identity, with
  **no secret values in repository, Bicep, or CI**.
- Image pull from ACR via system MI works (with post-provision AcrPull
  grant).
- Container starts, binds ingress, responds with HTTP 200, identifies
  itself with the correct `environment`, `releaseId`, and `gitSha`,
  and can open a TCP connection to the per-env Postgres.
- Per-env DB credentials are isolated in the per-env vault and are
  never shared.

What demo has **not** yet proven is application-level functionality
above the bare connection — that requires the schema to be in place.
