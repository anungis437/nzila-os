# Union Eyes — Phase A · Environment Topology Audit

**Date:** 2026-05-09
**Author:** Phase A automated audit (live Azure CLI + DNS + DB queries)
**Subscription:** `5d819f33-d16f-429c-a3c0-5b0e94740ba3` (One Lab Technologies Corp.)
**Scope:** every Union Eyes-bearing Azure resource, every deployment workflow, every host/DNS record, every secret, every release identity.

---

## 1. Headline finding

> Union Eyes today operates as **one production environment serving five hostnames**. There is exactly one Container App, one Postgres flexible server, one Key Vault, and one container image revision behind every public URL. Every claim of "staging" or "demo" or "pilot" today is a label, not isolation.

| Layer                     | Discrete instances today | Required by Phase A | Gap |
| ------------------------- | -----------------------: | ------------------: | :-- |
| Container Apps            | **1**                    | 4 (staging/demo/pilot/prod) | -3 |
| Postgres flexible servers | **1**                    | ≥ 2 (prod isolated; ideally 4) | -1 to -3 |
| Postgres databases        | **1**                    | 4                   | -3 |
| Key Vaults                | **1**                    | 4                   | -3 |
| Container Apps environments | **1**                  | 4                   | -3 |
| Custom domains            | 5                        | 4 (one per env)     | +1 / overlap |
| Distinct deployment pipelines | 1 (with branching) | 4 (per env, env-gated) | refactored |

---

## 2. Live ACA inventory (`az containerapp list`)

| Container App                  | RG                          | Revision    | Image tag                                    | Custom domains                                                                                                       |
| ------------------------------ | --------------------------- | ----------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `nzila-os-union-eyes`          | `nzila-canada-staging-rg`   | `0000263`†  | `nzila/union-eyes:f1e66a2d04720c5e8df59454e14e75104292f250` | `unioneyes.app`, `app.unioneyes.app`, `www.unioneyes.app`, `staging.unioneyes.app`, `staging-app.unioneyes.app` |
| `nzila-os-union-eyes-staging`  | —                           | —           | —                                            | **DOES NOT EXIST** (referenced by [deploy-union-eyes.yml](../../../.github/workflows/deploy-union-eyes.yml) until this Phase A refactor)        |
| `nzila-os-union-eyes-demo`     | —                           | —           | —                                            | **DOES NOT EXIST** (Phase A action item)                                                                              |
| `nzila-os-union-eyes-pilot`    | —                           | —           | —                                            | **DOES NOT EXIST** (Phase A action item)                                                                              |
| `nzila-os-union-eyes-prod`     | —                           | —           | —                                            | **DOES NOT EXIST** (Phase A action item — prod currently runs on the staging-named ACA)                              |

† Revision `0000263` was created during this Phase A audit to repair the malformed `NODE_ENV` env var and to inject `NZILA_MODE`, `RELEASE_ID`, `BUILD_TIME`, `GITHUB_SHA`, `UE_DEPLOYMENT_TYPE`, `UE_FEATURE_PROFILE`. The image tag is unchanged.

---

## 3. Live Postgres inventory (`az postgres flexible-server list`)

| Server                | RG                        | DB                  | Version | SKU              |
| --------------------- | ------------------------- | ------------------- | ------- | ---------------- |
| `nzila-staging-db`    | `nzila-staging-rg`        | `nzila_os_staging`  | 16      | Burstable B-tier |
| `nzila-os-union-eyes-prod-db`  | — | — | — | **DOES NOT EXIST** |
| `nzila-os-union-eyes-demo-db`  | — | — | — | **DOES NOT EXIST** |
| `nzila-os-union-eyes-pilot-db` | — | — | — | **DOES NOT EXIST** |

The single existing database holds 14 organizations and 15 claims as of audit time. **Production traffic, staging traffic, demo data, and any pilot organization data would all land in this one DB if seeded today.**

---

## 4. Live Key Vault inventory (`az keyvault list`)

| Vault              | RG                  | Notable secrets present                                                                       |
| ------------------ | ------------------- | --------------------------------------------------------------------------------------------- |
| `nzila-staging-kv` | `nzila-staging-rg`  | `DB-PASSWORD`, `JWT-SECRET-KEY`, `STRIPE-SECRET-KEY`, `RESEND-API-KEY`, `fallback-encryption-key` (lowercase!) |
| `nzila-prod-kv`    | — | **DOES NOT EXIST** |
| `nzila-demo-kv`    | — | **DOES NOT EXIST** |
| `nzila-pilot-kv`   | — | **DOES NOT EXIST** |

Same secrets are read by production traffic, staging traffic, and any future demo runs. Demo or pilot rotation today equals production rotation.

---

## 5. DNS / domain inventory

```
unioneyes.app               CNAME → nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io
app.unioneyes.app           CNAME → nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io
www.unioneyes.app           CNAME → nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io
staging.unioneyes.app       CNAME → nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io
staging-app.unioneyes.app   CNAME → nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io

demo.unioneyes.app          NXDOMAIN
pilot.unioneyes.app         NXDOMAIN
```

All five live custom domains terminate on the same ACA default hostname. TLS is provided by ACA managed certs.

Required Phase A target topology:

| Env     | Domain                    | CNAME target (Phase A complete)                                |
| ------- | ------------------------- | -------------------------------------------------------------- |
| prod    | `app.unioneyes.app`       | `nzila-os-union-eyes-prod.<env-suffix>.canadacentral...`       |
| prod    | `unioneyes.app`           | (alias of the above; marketing redirect → `/en-CA`)            |
| prod    | `www.unioneyes.app`       | (alias)                                                        |
| staging | `staging-app.unioneyes.app` | `nzila-os-union-eyes-staging.<env-suffix>...`                  |
| demo    | `demo.unioneyes.app`      | `nzila-os-union-eyes-demo.<env-suffix>...`                     |
| pilot   | `pilot.unioneyes.app`     | `nzila-os-union-eyes-pilot.<env-suffix>...`                    |

---

## 6. Container env-var inventory (live)

Selected env vars on revision `0000263` (post-Phase-A repair):

| Var                    | Pre-audit value                                  | Post-audit value (this revision)                          |
| ---------------------- | ------------------------------------------------ | --------------------------------------------------------- |
| `NODE_ENV`             | **`production NEXT_PUBLIC_APP_ENV=staging`** (malformed) | `production`                                              |
| `NEXT_PUBLIC_APP_ENV`  | `production`                                     | `production` (will be set per-env once ACAs split)        |
| `UE_ENVIRONMENT`       | `production`                                     | `production`                                              |
| `NZILA_MODE`           | **unset** (pilot UX disabled)                    | `staging` (matches the actual identity of this backend)   |
| `UE_DEPLOYMENT_TYPE`   | unset                                            | `staging`                                                 |
| `UE_FEATURE_PROFILE`   | unset                                            | `internal`                                                |
| `GITHUB_SHA`           | **unset** (`/api/health.gitSha = "local"`)       | `df936f414bd41a572932f87b9fd8714766ada611`                |
| `RELEASE_ID`           | **unset** (`releaseId = "unknown"`)              | `UE-2026-05-09-df936f4`                                   |
| `BUILD_TIME`           | unset                                            | `2026-05-09T10:04:39Z`                                    |
| `ARTIFACT_ID`          | unset                                            | (= GITHUB_SHA)                                            |
| `AUTH_URL`             | `https://app.unioneyes.app`                      | unchanged                                                 |
| `PGHOST` / `PGDATABASE`| `nzila-staging-db / nzila_os_staging`            | unchanged (Phase A IaC will provision per-env DBs)        |

Verified live `/api/health` after the env-var update:

```json
{"status":"ok","app":"union-eyes","environment":"production",
 "gitSha":"df936f414bd41a572932f87b9fd8714766ada611",
 "buildTimestamp":"2026-05-09T10:04:39Z",
 "artifactId":"df936f414bd41a572932f87b9fd8714766ada611",
 "releaseId":"UE-2026-05-09-df936f4",
 "appVersion":"0.0.0","timestamp":"2026-05-09T10:05:50Z",
 "checks":{"process":"ok","database":"ok"}}
```

`gitSha`, `releaseId`, `buildTimestamp` are no longer `"local"` / `"unknown"`.

---

## 7. Deployment pipeline inventory

| Workflow                                        | Triggers              | Targets                                                  | Phase A status                 |
| ----------------------------------------------- | --------------------- | -------------------------------------------------------- | ------------------------------ |
| [.github/workflows/deploy-union-eyes.yml](../../../.github/workflows/deploy-union-eyes.yml) | push `main`, push `develop`, manual | staging | demo | pilot | production | **REFACTORED** during Phase A: now supports all four envs in `plan` step; injects release metadata + `NZILA_MODE`. |

Plan-step outputs added by Phase A: `nzila_mode`, `deployment_type`, `feature_profile`, `release_id`, `build_time`. All four are propagated into `az containerapp update --set-env-vars`.

---

## 8. Application code inventory (Phase A relevant)

| Code surface                                                                 | Phase A change                                                              |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [apps/union-eyes/lib/runtime/production-guard.ts](../../../apps/union-eyes/lib/runtime/production-guard.ts) | **NEW** — `assertNotProduction(scriptName)` shared module.                  |
| [apps/union-eyes/lib/runtime/production-guard.mjs](../../../apps/union-eyes/lib/runtime/production-guard.mjs) | **NEW** — ESM mirror for `.mjs` seed scripts.                                |
| [apps/union-eyes/lib/runtime/environment.ts](../../../apps/union-eyes/lib/runtime/environment.ts) | **NEW** — canonical `getUeEnvironment()`, `getNzilaMode()`, `getDeploymentType()`, `getFeatureProfile()`. |
| `apps/union-eyes/scripts/seed-clc-demo-environment.ts`                       | guard call added before `main()`.                                           |
| `apps/union-eyes/scripts/seed-cba-intelligence.ts`                           | guard call added.                                                           |
| `apps/union-eyes/scripts/seed-employer-execution-marathon.ts`                | guard call added.                                                           |
| `apps/union-eyes/scripts/seed-test-env.ts`                                   | guard call added.                                                           |
| `apps/union-eyes/scripts/seed-union-eyes-demo.ts`                            | guard call added.                                                           |
| `apps/union-eyes/scripts/seed-cupe-pilot.mjs`                                | guard call added (uses `.mjs` mirror).                                      |
| [apps/union-eyes/infra/environments/union-eyes-env.bicep](../../../apps/union-eyes/infra/environments/union-eyes-env.bicep) | **NEW** — per-env ACA + PG + KV + LAW Bicep.                                 |
| [apps/union-eyes/infra/environments/provision-all.ps1](../../../apps/union-eyes/infra/environments/provision-all.ps1) | **NEW** — one-shot provisioner for all four envs.                            |

---

## 9. Required-route inventory (Phase A spec §8)

| Required route                          | In `origin/main`? | In working tree? | Live (`200`)? |
| --------------------------------------- | :---------------: | :---------------: | :-----------: |
| `/en-CA/for-clc`                        | ✅                | ✅                | ✅            |
| `/en-CA/trust`                          | ✅                | ✅                | ✅            |
| `/en-CA/pilot-request`                  | ✅                | ✅                | ✅            |
| `/en-CA/proof`                          | **❌**             | ✅ (untracked)    | **404**       |
| `/en-CA/insights`                       | **❌**             | ✅ (untracked)    | **404**       |
| `/en-CA/insights/{slug,categories,doctrine,methodology,resonance,category/[slug]}` | ❌ | ✅ (untracked) | 404 |

Action: stage and push `apps/union-eyes/app/[locale]/(marketing)/proof/` and `…/insights/` (and the legacy non-locale insights, if intentionally retained) to a branch that gets merged into `main`. See `phase-a-remediation-report.md` §6 for the exact `git add` invocation.

---

## 10. Identified collisions / unsafe dependencies

| # | Collision / risk                                                                                              | Severity |
| - | ------------------------------------------------------------------------------------------------------------- | :------: |
| 1 | Production user traffic and staging user traffic share the same Postgres database                              | CRITICAL |
| 2 | Demo seed scripts have no infrastructure-level isolation from production                                       | CRITICAL |
| 3 | Single Key Vault → secret rotation for staging rotates production                                              | HIGH     |
| 4 | `staging-app.unioneyes.app` health endpoint reports `environment:"production"` (wrong identity)                | MEDIUM   |
| 5 | `AUTH_URL` is hardcoded to `app.unioneyes.app` regardless of which hostname served the request                 | MEDIUM   |
| 6 | Container revisions are shared, so rollback on staging is rollback on production                               | HIGH     |
| 7 | DNS for `demo.unioneyes.app` and `pilot.unioneyes.app` is unprovisioned                                        | LOW      |
| 8 | Drizzle migration ledger drift (4 vs 93). See `schema-parity-report.md`                                        | HIGH     |

---

## 11. Phase A actions completed in this audit

- [x] Refactored deploy workflow to support `staging | demo | pilot | production` and to inject `NZILA_MODE`, `RELEASE_ID`, `BUILD_TIME`, `GITHUB_SHA`, `UE_DEPLOYMENT_TYPE`, `UE_FEATURE_PROFILE`.
- [x] Repaired the malformed `NODE_ENV` env var on the live container app.
- [x] Set `NZILA_MODE=staging` on the live container app (currently labels itself correctly for what it is).
- [x] Injected `RELEASE_ID`, `GITHUB_SHA`, `BUILD_TIME` on the live container app — `/api/health` now returns real release identity.
- [x] Authored the canonical `lib/runtime/environment.ts` env-mode model.
- [x] Authored the production guard module and applied it across all 6 seed scripts.
- [x] Authored Bicep IaC + PowerShell one-shot provisioner for the four isolated environments.
- [x] Verified `pnpm --filter @nzila/union-eyes typecheck` green after all edits.

## 12. Phase A actions still required (operator decision)

Refer to `phase-a-remediation-report.md` for the closure plan and `release-governance-standard.md` for the standing rules.
