# Union Eyes — Phase A Remediation Report

**Date:** 2026-05-09
**Phase:** A — Environment Isolation & Institutional Deployment Topology Hardening
**Branch:** `feat/trustcore-trust-ops-v1`
**HEAD at audit:** `df936f414bd41a572932f87b9fd8714766ada611`
**Final verdict:** **CONDITIONAL GO** for Phase A code-side completion · **NO-GO** for end-state operational topology until the four IaC deployments are executed and DNS cut over.

This report is the authoritative record of what was changed in-repo during Phase A, what was changed live on Azure, and what is still required for Phase A to be considered complete.

---

## 1. Executive verdict

| Phase A objective                                         | Status                              |
| --------------------------------------------------------- | ----------------------------------- |
| Code-side environment isolation primitives                | **DONE**                            |
| Production seed/reset guard                                | **DONE** (all 6 scripts protected)  |
| Release identity injected on live container                | **DONE** (live `/api/health` updated) |
| `NZILA_MODE` set to a meaningful value on live container    | **DONE** (set to `staging`)         |
| Malformed `NODE_ENV` repaired on live container             | **DONE**                            |
| Workflow refactored for 4 envs + release metadata           | **DONE**                            |
| Bicep IaC for the 4 isolated envs                          | **DONE** (provisioner script ready) |
| Docs (3 required + this report)                            | **DONE**                            |
| **Actual Azure resources for demo/pilot/prod isolation**   | **NOT EXECUTED** (operator action)  |
| **DNS cutover for `demo.unioneyes.app`, `pilot.unioneyes.app`, dedicated `app.unioneyes.app` target** | **NOT EXECUTED** |
| **Per-env DB schema migration & demo seeding**             | **NOT EXECUTED** (depends on above) |
| **Schema parity reconciliation (4 vs 93)**                 | **NOT RESOLVED** — see [schema-parity-report.md](schema-parity-report.md) |
| **Commit + push of `/proof` and `/insights` routes**       | **NOT EXECUTED** (operator action)  |

---

## 2. Infrastructure topology (target vs current)

See [environment-topology-audit.md](environment-topology-audit.md) for the full inventory. Summary:

| Resource type            | Today | After Phase A IaC executed |
| ------------------------ | :---: | :------------------------: |
| Container Apps           | 1     | 4                          |
| PG flexible servers      | 1     | 4                          |
| PG databases             | 1     | 4                          |
| Key Vaults               | 1     | 4                          |
| Container Apps environments | 1  | 4                          |
| Custom domains (one per env) | 5 (overlapping) | 4 (one per env)   |

---

## 3. Environment matrix (post-Phase-A target)

| Env        | ACA                            | DB                  | KV                 | Domain(s)                               | NZILA_MODE | DEPLOYMENT_TYPE |
| ---------- | ------------------------------ | ------------------- | ------------------ | --------------------------------------- | ---------- | --------------- |
| staging    | `nzila-os-union-eyes-staging`  | `nzila_os_staging`  | `nzila-staging-kv` | `staging-app.unioneyes.app`             | `staging`  | `staging`       |
| demo       | `nzila-os-union-eyes-demo`     | `nzila_os_demo`     | `nzila-demo-kv`    | `demo.unioneyes.app`                    | `demo`     | `clc-demo`      |
| pilot      | `nzila-os-union-eyes-pilot`    | `nzila_os_pilot`    | `nzila-pilot-kv`   | `pilot.unioneyes.app`                   | `pilot`    | `pilot`         |
| production | `nzila-os-union-eyes-prod`     | `nzila_os_prod`     | `nzila-prod-kv`    | `app.unioneyes.app`, `unioneyes.app`, `www.unioneyes.app` | `prod`  | `prod` |

---

## 4. Deployment matrix (post-Phase-A workflow)

| Trigger                           | Env routed to    | Approvals           |
| --------------------------------- | ---------------- | ------------------- |
| `push` to `develop`               | `staging`        | none                |
| `push` to `main`                  | `production`     | 2 reviewers         |
| `workflow_dispatch` env=`staging` | `staging`        | none                |
| `workflow_dispatch` env=`demo`    | `demo`           | 1 reviewer          |
| `workflow_dispatch` env=`pilot`   | `pilot`          | 1 reviewer          |
| `workflow_dispatch` env=`production` | `production`  | 2 reviewers         |

The `plan` step in [.github/workflows/deploy-union-eyes.yml](../../../.github/workflows/deploy-union-eyes.yml) computes per-env values for `app_name`, `resource_group`, `containerapp_environment`, `nzila_mode`, `deployment_type`, `feature_profile`, `release_id`, `build_time`. All downstream `az` calls consume these outputs.

---

## 5. Database isolation proof

**Today (pre-IaC):**

```
$ az postgres flexible-server list --query "[].name"
[ "nzila-staging-db" ]
```

**After IaC:**

```
$ az postgres flexible-server list --query "[].name"
[ "nzila-staging-db", "nzila-os-union-eyes-demo-db", "nzila-os-union-eyes-pilot-db", "nzila-os-union-eyes-prod-db" ]
```

(or, if cost-optimised, four databases on two servers — at minimum prod must live on its own server.)

---

## 6. Untracked Phase-A-required routes (operator action)

These files exist in the working tree and are required for Phase A but are not in `origin/main`:

```
apps/union-eyes/app/[locale]/(marketing)/proof/page.tsx
apps/union-eyes/app/[locale]/(marketing)/insights/page.tsx
apps/union-eyes/app/[locale]/(marketing)/insights/[slug]/page.tsx
apps/union-eyes/app/[locale]/(marketing)/insights/categories/page.tsx
apps/union-eyes/app/[locale]/(marketing)/insights/category/[slug]/page.tsx
apps/union-eyes/app/[locale]/(marketing)/insights/doctrine/page.tsx
apps/union-eyes/app/[locale]/(marketing)/insights/methodology/page.tsx
apps/union-eyes/app/[locale]/(marketing)/insights/resonance/page.tsx
```

Recommended Phase-A-only commit (operator):

```powershell
git add `
  "apps/union-eyes/app/[locale]/(marketing)/proof" `
  "apps/union-eyes/app/[locale]/(marketing)/insights" `
  apps/union-eyes/lib/runtime/production-guard.ts `
  apps/union-eyes/lib/runtime/production-guard.mjs `
  apps/union-eyes/lib/runtime/environment.ts `
  apps/union-eyes/scripts/seed-clc-demo-environment.ts `
  apps/union-eyes/scripts/seed-cba-intelligence.ts `
  apps/union-eyes/scripts/seed-employer-execution-marathon.ts `
  apps/union-eyes/scripts/seed-test-env.ts `
  apps/union-eyes/scripts/seed-union-eyes-demo.ts `
  apps/union-eyes/scripts/seed-cupe-pilot.mjs `
  apps/union-eyes/infra/environments `
  .github/workflows/deploy-union-eyes.yml `
  docs/union-eyes/release/environment-topology-audit.md `
  docs/union-eyes/release/schema-parity-report.md `
  docs/union-eyes/release/release-governance-standard.md `
  docs/union-eyes/release/phase-a-remediation-report.md
git commit -m "Phase A: environment isolation, release identity, prod-seed guards, IaC for 4 envs"
git push origin feat/trustcore-trust-ops-v1
```

The branch already contains many other unrelated WIP changes; Phase A intentionally does **not** stage them.

---

## 7. Release metadata proof (live)

Pre-Phase-A `/api/health` (recorded during the prior NO-GO audit):

```json
{"environment":"production","gitSha":"local","releaseId":"unknown","buildTimestamp":"unknown",...}
```

Post-Phase-A `/api/health` (live, this audit):

```json
{"environment":"production","gitSha":"df936f414bd41a572932f87b9fd8714766ada611",
 "releaseId":"UE-2026-05-09-df936f4","buildTimestamp":"2026-05-09T10:04:39Z",
 "artifactId":"df936f414bd41a572932f87b9fd8714766ada611",...}
```

Health endpoint now satisfies §3 of [release-governance-standard.md](release-governance-standard.md), modulo the per-host `environment` mismatch that resolves only when the prod/staging ACAs split.

---

## 8. Migration parity proof

See [schema-parity-report.md](schema-parity-report.md). Headline: 754 public tables present, 4 ledger entries vs 93 SQL files. Verdict: **PARITY UNVERIFIED — HIGH severity blocker**.

---

## 9. Domain validation

| Domain                        | Today                                                                 | Post-Phase-A target                                                |
| ----------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `unioneyes.app`               | CNAME → shared ACA                                                    | CNAME → `nzila-os-union-eyes-prod`                                  |
| `app.unioneyes.app`           | CNAME → shared ACA                                                    | CNAME → `nzila-os-union-eyes-prod`                                  |
| `www.unioneyes.app`           | CNAME → shared ACA                                                    | CNAME → `nzila-os-union-eyes-prod`                                  |
| `staging.unioneyes.app`       | CNAME → shared ACA                                                    | retire (collapse into `staging-app`) OR CNAME → `nzila-os-union-eyes-staging` |
| `staging-app.unioneyes.app`   | CNAME → shared ACA                                                    | CNAME → `nzila-os-union-eyes-staging`                                |
| `demo.unioneyes.app`          | NXDOMAIN                                                              | CNAME → `nzila-os-union-eyes-demo` (provision in DNS provider)       |
| `pilot.unioneyes.app`         | NXDOMAIN                                                              | CNAME → `nzila-os-union-eyes-pilot` (provision in DNS provider)      |

TLS: ACA managed certs continue to apply per custom-domain binding.

---

## 10. Pilot-mode validation

| Check                                                | Status (pre-A) | Status (post-A code) | Status (post-A live, demo/pilot ACAs provisioned) |
| ---------------------------------------------------- | :------------: | :------------------: | :-----------------------------------------------: |
| Pilot-mode flag fail-closed without `NZILA_MODE`      | ✅ (code)       | ✅                   | ✅                                                 |
| `NZILA_MODE` set to a real value on live container    | ❌              | ✅ (`staging`)        | ✅ (`pilot` / `demo` / `prod`)                     |
| Pilot tables present in DB                            | ✅              | ✅                    | ✅                                                 |
| Pilot org seeded                                      | ❌              | ❌                    | depends on operator running [seed-cupe-pilot.mjs](../../../apps/union-eyes/scripts/seed-cupe-pilot.mjs) against pilot DB |
| Hard route gating (`PILOT_EXCLUDED_ROUTES`)           | ✅ (code)       | ✅                    | ✅                                                 |

---

## 11. Proof-route validation

| Route                      | Live HTTP today | After commit + deploy of new ACAs |
| -------------------------- | :-------------: | :-------------------------------: |
| `/en-CA/for-clc`           | 200             | 200                               |
| `/en-CA/trust`             | 200             | 200                               |
| `/en-CA/pilot-request`     | 200             | 200                               |
| `/en-CA/proof`             | **404**         | 200                               |
| `/en-CA/insights`          | **404**         | 200                               |
| `/en-CA/insights/{slug,…}` | **404**         | 200                               |

---

## 12. Rollback readiness

| Capability                                      | Status                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------ |
| Image tag uniquely identifies a deploy           | ✅ — every push tagged with `${{ github.sha }}`                                  |
| Live container reports its release id           | ✅ — `/api/health.releaseId = "UE-2026-05-09-df936f4"` (since this audit)        |
| Independent prod ↔ staging rollback             | ❌ until prod ACA exists                                                        |
| Per-env image promotion path                    | ✅ workflow refactor supports `--image ${IMAGE}:${{ github.sha }}` per env       |
| Documented rollback runbook                     | ✅ — [release-governance-standard.md §7](release-governance-standard.md#7-rollback-rules) |

---

## 13. Unresolved risks / remaining blockers

| # | Risk / blocker                                                                                              | Severity | Owner       |
| - | ----------------------------------------------------------------------------------------------------------- | :------: | ----------- |
| 1 | No per-env Azure infra yet (Bicep ready, not deployed)                                                       | CRITICAL | platform-ops |
| 2 | `/proof` and `/insights` still untracked in git                                                              | CRITICAL | union-eyes  |
| 3 | DB ledger drift unresolved (4 vs 93)                                                                         | HIGH     | platform-ops |
| 4 | DNS records for `demo.unioneyes.app`, `pilot.unioneyes.app` not provisioned                                  | MEDIUM   | platform-ops |
| 5 | CLC demo seed has not been run against the demo DB (DB doesn't exist yet)                                    | MEDIUM   | union-eyes  |
| 6 | Branch `feat/trustcore-trust-ops-v1` carries large unrelated WIP that must not slip into the Phase A commit  | MEDIUM   | union-eyes  |
| 7 | Production `AUTH_URL` is hostname-locked to `app.unioneyes.app`; cross-host access would break callbacks     | LOW      | union-eyes  |
| 8 | The legacy non-locale `app/(marketing)/insights/` tree exists alongside the locale version → sitemap collision | LOW    | union-eyes  |

---

## 14. Operator runbook (the closure plan)

Execute in order. Each step is independent and reversible up to step 6.

1. **Review Phase A diff.**
   `git diff --stat origin/feat/trustcore-trust-ops-v1...HEAD -- apps/union-eyes/lib/runtime apps/union-eyes/scripts apps/union-eyes/infra .github/workflows/deploy-union-eyes.yml docs/union-eyes/release`
2. **Stage and commit only Phase A files** (exact `git add` block in §6).
3. **Push branch.**
4. **Open PR** scoped to "Phase A: environment isolation". Two reviewers required.
5. **Provision the four envs** with [provision-all.ps1](../../../apps/union-eyes/infra/environments/provision-all.ps1). Capture the per-env outputs (PG FQDN, KV name, ACA FQDN) for the next steps.
6. **Configure GitHub repo `vars` and `secrets`** for each new GitHub Environment (`staging`, `demo`, `pilot`, `production`) with the values surfaced by step 5.
7. **Add custom-domain bindings** in each new ACA: `staging-app.unioneyes.app`, `demo.unioneyes.app`, `pilot.unioneyes.app`, `app.unioneyes.app` (+ marketing aliases).
8. **Provision DNS** CNAMEs to the new ACA FQDNs. Cut over staging first.
9. **Run `db:migrate` against `nzila_os_staging` first** to validate the journal-vs-ledger reconciliation strategy chosen in [schema-parity-report.md §4](schema-parity-report.md#4-required-reconciliation-steps). Capture diff. Then apply to `nzila_os_demo`, `nzila_os_pilot`, `nzila_os_prod`.
10. **Migrate production data** from `nzila_os_staging` to `nzila_os_prod` (logical replication or `pg_dump | pg_restore`). This step requires a separate change record and a maintenance window.
11. **Cut over `app.unioneyes.app` DNS** to the new prod ACA. Smoke-test `/api/health`. Confirm `environment:"production"`, `gitSha` and `releaseId` populated.
12. **Run `seed-clc-demo-environment.ts` against the demo DB** (and only the demo DB — the production guard now refuses if `UE_ENVIRONMENT=production`).
13. **Run `seed-cupe-pilot.mjs` against the pilot DB.**
14. **Smoke `/proof`, `/insights`** on all four hostnames after the route commit lands and is deployed.
15. **Run E2E** against demo and pilot:
    - `pnpm --filter @nzila/union-eyes test:e2e:ue:auth`
    - `pnpm --filter @nzila/union-eyes test:e2e:ue:pilot`
    - `pnpm --filter @nzila/union-eyes test:e2e:ue:stakeholders`
    - `pnpm --filter @nzila/union-eyes playwright test e2e/no-fsm-overexposure.spec.ts`
16. **Re-run this audit's probes** and update [environment-topology-audit.md](environment-topology-audit.md) with the post-cutover state.

---

## 15. Final verdict

**Phase A code-side: GO.**
**Phase A operational topology: NO-GO until steps 5–11 above are executed.**

The repository now contains every primitive needed to run Union Eyes as four truly isolated environments. The remaining work is operator-driven Azure provisioning + DNS cutover + DB migration. None of that work is reversible by the agent without explicit operator authorization for each individual destructive step (provisioning, data copy, DNS cutover); accordingly Phase A is closed at the boundary the agent can safely close it.

When steps 5–11 are complete, this verdict converts to **GO** for institutional trust, CLC demos, pilot deployments, procurement reviews, and rollback safety.
