# Runtime Separation Implementation Wave — Phase A: Inventory and Freeze (Baseline)

**Date:** 2026-06-28
**Wave:** Runtime Separation Implementation Wave (NEW mandate — separate from the completed UE Hardening & Gate Convergence Wave)
**Phase:** A of A–G (inventory and freeze only)
**Source plan:** [docs/governance/runtime/runtime-separation-plan.md](../../docs/governance/runtime/runtime-separation-plan.md)
**Companion (prior wave):** [reports/governance/ue-hardening-wave-phase6-runtime-separation-2026-06-28.md](ue-hardening-wave-phase6-runtime-separation-2026-06-28.md)

> **Scope honored (verbatim mandate):** Phase A only. **No Azure resources modified. No deployment workflows modified. No secrets modified.** Did not touch `final:go` certification. Did not promote any gate. Did not claim production readiness. Did not broaden into product work. **Hard stop after Phase A.**

> **Boundary note on "live" inventory:** This baseline is the authoritative reconstruction of the **declared** state from Infrastructure-as-Code, GitOps environment configs, and deployment workflows in this repository. **Live Azure read-only confirmation (`az ... list`, Resource Graph) was NOT executed in this wave** — no Azure access is exercised here, consistent with "do not touch Azure." Every cell requiring live confirmation is flagged **`LIVE-VERIFY`** with the exact read-only command a human operator must run to close reconciliation. No live Azure output is fabricated.

---

## 1. Sources inspected (read-only)

- Plan + prior report: [runtime-separation-plan.md](../../docs/governance/runtime/runtime-separation-plan.md), [phase6 report](ue-hardening-wave-phase6-runtime-separation-2026-06-28.md).
- Bicep IaC: [infrastructure/bicep/main.bicep](../../infrastructure/bicep/main.bicep), modules (`network`, `container-apps`, `container-registry`, `keyvault`, `keyvault-secret`, `postgres`, `sentinel`, `waf`, `alerts`), parameters ([prod.bicepparam](../../infrastructure/bicep/parameters/prod.bicepparam), [staging.bicepparam](../../infrastructure/bicep/parameters/staging.bicepparam), `prod-global.bicepparam`).
- GitOps env configs: [production.yml](../../infrastructure/gitops/environments/production.yml), [staging.yml](../../infrastructure/gitops/environments/staging.yml), [pilot.yml](../../infrastructure/gitops/environments/pilot.yml), [ue-pilot-cupe.yml](../../infrastructure/gitops/environments/ue-pilot-cupe.yml), [ue-demo-cupe4373.yml](../../infrastructure/gitops/environments/ue-demo-cupe4373.yml), `development.yml`.
- Deployment workflows: [deploy-union-eyes.yml](../../.github/workflows/deploy-union-eyes.yml), [auto-promote-union-eyes.yml](../../.github/workflows/auto-promote-union-eyes.yml), `deploy-production.yml`, `deploy-staging.yml`, `gitops-deploy.yml`.

A key structural fact: the Bicep layer names resources `nzila-${env}-*` (env ∈ `dev|staging|prod`), while the GitOps/workflow layer uses the live `nzila-canada-${env}-*` convention plus a shared `nzilacanadaacr`. This **naming-convention split between IaC and live config** is itself a reconciliation item (R-1 below).

---

## 2. Declared resource inventory per environment

> "Declared" = as written in IaC/GitOps/workflows. Live existence/binding is **LIVE-VERIFY**.

### 2.1 Resource groups

| Environment | Declared resource group | Source |
| --- | --- | --- |
| Production | `nzila-canada-prod-rg` | [production.yml](../../infrastructure/gitops/environments/production.yml), workflow prod fallback |
| Staging | `nzila-canada-staging-rg` | [staging.yml](../../infrastructure/gitops/environments/staging.yml) |
| Demo (CUPE 4373) | `nzila-canada-demo-rg` | [ue-demo-cupe4373.yml](../../infrastructure/gitops/environments/ue-demo-cupe4373.yml) |
| Pilot (sovereign profile) | `nzila-canada-pilot-rg` | [pilot.yml](../../infrastructure/gitops/environments/pilot.yml) |
| **UE Pilot (CUPE 123, live)** | **`nzila-canada-staging-rg` (REUSES staging)** | [ue-pilot-cupe.yml](../../infrastructure/gitops/environments/ue-pilot-cupe.yml) |

### 2.2 Container Apps environments

| Environment | Declared ACA environment | Source |
| --- | --- | --- |
| Production | `nzila-canada-prod-env` | [production.yml](../../infrastructure/gitops/environments/production.yml); workflow var `AZURE_CONTAINERAPPS_ENVIRONMENT_PRODUCTION` (fallback `nzila-canada-prod-env`) |
| Staging | `nzila-canada-staging-env` | [staging.yml](../../infrastructure/gitops/environments/staging.yml) |
| Demo | `nzila-canada-demo-env` | [ue-demo-cupe4373.yml](../../infrastructure/gitops/environments/ue-demo-cupe4373.yml) |
| Pilot (sovereign) | `nzila-canada-pilot-env` | [pilot.yml](../../infrastructure/gitops/environments/pilot.yml) |
| **UE Pilot (CUPE 123, live)** | **`nzila-canada-staging-env` (REUSES staging)** | [ue-pilot-cupe.yml](../../infrastructure/gitops/environments/ue-pilot-cupe.yml) |
| Bicep declaration | `nzila-${env}-env` (`nzila-staging-env` / `nzila-prod-env`) | [main.bicep](../../infrastructure/bicep/main.bicep) |

**Container App workload names** (from [deploy-union-eyes.yml](../../.github/workflows/deploy-union-eyes.yml)): prod `nzila-os-union-eyes-prod`, demo `nzila-os-union-eyes-demo`, pilot `nzila-os-union-eyes-pilot`, staging `nzila-os-union-eyes-staging`, plus a legacy `nzila-os-union-eyes` in staging-rg (per [auto-promote header](../../.github/workflows/auto-promote-union-eyes.yml)).

### 2.3 Key Vaults

| Environment | Declared Key Vault | Source |
| --- | --- | --- |
| Production | `nzila-prod-kv` | [main.bicep](../../infrastructure/bicep/main.bicep) (`nzila-${env}-kv`) |
| Staging | `nzila-staging-kv` | [staging.yml](../../infrastructure/gitops/environments/staging.yml), [main.bicep](../../infrastructure/bicep/main.bicep) |
| Demo | `nzila-canada-demo-kv` | [ue-demo-cupe4373.yml](../../infrastructure/gitops/environments/ue-demo-cupe4373.yml) (`SECRET_AUTHORITY`) |
| Pilot (sovereign) | `nzila-canada-pilot-kv` | [pilot.yml](../../infrastructure/gitops/environments/pilot.yml) (`SECRET_AUTHORITY`) |
| **UE Pilot (CUPE 123, live)** | **`nzila-staging-kv` (REUSES staging)** | [ue-pilot-cupe.yml](../../infrastructure/gitops/environments/ue-pilot-cupe.yml) |

### 2.4 Container registry (ACR)

| Scope | Declared registry | Source |
| --- | --- | --- |
| **All environments (live)** | **`nzilacanadaacr` (single shared)** | [staging.yml](../../infrastructure/gitops/environments/staging.yml), pilot/demo/cupe configs, [deploy-union-eyes.yml](../../.github/workflows/deploy-union-eyes.yml) `IMAGE` env |
| Bicep declaration | `nzila${env}acr` (per-env, **not** the live name) | [main.bicep](../../infrastructure/bicep/main.bicep) |

ACR pull is granted to the shared ACA managed identity via a single `AcrPull` role assignment in Bicep. **This is BR-5.**

### 2.5 Databases

| Environment | Declared DB | SKU | HA | Backup | Isolation | Source |
| --- | --- | --- | --- | --- | --- | --- |
| Production | `nzila-prod-pg` (Bicep `nzila-${env}-pg`) | `GP_Standard_E8ds_v5` | yes (AZ 2 standby) | 35-day GRS | dedicated | [main.bicep](../../infrastructure/bicep/main.bicep), [production.yml](../../infrastructure/gitops/environments/production.yml) |
| Staging | `nzila-staging-db` | `GP_Standard_D2ds_v5` | no | 7-day | dedicated | [staging.yml](../../infrastructure/gitops/environments/staging.yml) |
| Demo | `nzila-os-union-eyes-demo-db` (db `nzila_os_demo`) | `GP_Standard_D2ds_v5` | no | 14-day | **dedicated** | [ue-demo-cupe4373.yml](../../infrastructure/gitops/environments/ue-demo-cupe4373.yml) |
| Pilot (sovereign profile) | `nzila-canada-pilot-db` | `Standard_B1ms` | no | 7-day | **dedicated** | [pilot.yml](../../infrastructure/gitops/environments/pilot.yml) |
| **UE Pilot (CUPE 123, live)** | **`nzila-staging-db` (REUSES staging)** | `GP_Standard_D2ds_v5` | no | 14-day *(declared, but on the shared staging instance)* | **RLS-only** (`app.org_id = 'cupe-local-123'`), session-mode pooling | [ue-pilot-cupe.yml](../../infrastructure/gitops/environments/ue-pilot-cupe.yml) |

### 2.6 Runtime managed identities

| Environment | Declared identity | Source |
| --- | --- | --- |
| Per-env runtime MI | `nzila-${env}-aca-mi` (user-assigned, KV Secrets User + AcrPull) | [main.bicep](../../infrastructure/bicep/main.bicep) |

### 2.7 GitHub deployment identity / secrets

| Item | Declared value | Source |
| --- | --- | --- |
| Auth mechanism | `azure/login@v3` with `creds: ${{ secrets.AZURE_CREDENTIALS }}` — **single shared SP credential JSON** (not per-env OIDC) | [deploy-union-eyes.yml](../../.github/workflows/deploy-union-eyes.yml) (`build-and-deploy` job) |
| GitHub Environment binding | Job sets `environment: ${{ needs.plan.outputs.environment }}` (per-env GitHub Environment) | [deploy-union-eyes.yml](../../.github/workflows/deploy-union-eyes.yml) |
| Whether `AZURE_CREDENTIALS` is repo-wide vs environment-scoped | **LIVE-VERIFY** (GitHub repo/Environment settings — not determinable from workflow files) | — |
| Cross-env barrier | Bash guard: prod deploy fails if RG/env name matches `staging\|demo\|pilot` | [deploy-union-eyes.yml](../../.github/workflows/deploy-union-eyes.yml) plan step |
| Other build secrets referenced | `AZURE_AD_CLIENT_ID`, `AZURE_AD_TENANT_ID`, `DNS_API_TOKEN` | [deploy-union-eyes.yml](../../.github/workflows/deploy-union-eyes.yml) |

**This is BR-4.**

### 2.8 DNS / custom domains

| Environment | Hostnames | Source |
| --- | --- | --- |
| Production | `unioneyes.app`, `app.unioneyes.app` | [deploy-union-eyes.yml](../../.github/workflows/deploy-union-eyes.yml) |
| Staging | `staging.unioneyes.app`, `staging-app.unioneyes.app` | [deploy-union-eyes.yml](../../.github/workflows/deploy-union-eyes.yml) |
| Demo | `demo.unioneyes.app` | [ue-demo-cupe4373.yml](../../infrastructure/gitops/environments/ue-demo-cupe4373.yml) |
| Pilot | `pilot.unioneyes.app` | [pilot.yml](../../infrastructure/gitops/environments/pilot.yml) |
| Zone / origins | Zone `unioneyes.app`; ACA origins `*.jollydune-88c1e97f.canadacentral.azurecontainerapps.io` | [deploy-union-eyes.yml](../../.github/workflows/deploy-union-eyes.yml) |

### 2.9 Observability / Log Analytics

| Environment | Workspace / retention | Source |
| --- | --- | --- |
| Per-env workspace | `nzila-${env}-logs` (Sentinel on prod + staging) | [main.bicep](../../infrastructure/bicep/main.bicep) |
| Production retention | 90 days (LA + monitoring) | [main.bicep](../../infrastructure/bicep/main.bicep), [production.yml](../../infrastructure/gitops/environments/production.yml) |
| Staging retention | 30 days (Bicep) / 60 days (gitops) — **discrepancy, R-2** | [main.bicep](../../infrastructure/bicep/main.bicep), [staging.yml](../../infrastructure/gitops/environments/staging.yml) |
| OTEL collectors | Per-env endpoints (e.g. staging `nzila-staging-otel...`) | [staging.yml](../../infrastructure/gitops/environments/staging.yml), pilot/demo/cupe configs |

### 2.10 Backup / restore boundaries

| Environment | Boundary | Independent? | Source |
| --- | --- | --- | --- |
| Production | 35-day GRS, HA, AZ-2 standby | yes | [main.bicep](../../infrastructure/bicep/main.bicep), [production.yml](../../infrastructure/gitops/environments/production.yml) |
| Staging | 7-day local | yes (own instance) | [staging.yml](../../infrastructure/gitops/environments/staging.yml) |
| Demo | 14-day on dedicated instance | yes | [ue-demo-cupe4373.yml](../../infrastructure/gitops/environments/ue-demo-cupe4373.yml) |
| Pilot (sovereign) | 7-day on dedicated instance | yes | [pilot.yml](../../infrastructure/gitops/environments/pilot.yml) |
| **UE Pilot (CUPE 123, live)** | **shares `nzila-staging-db`** | **NO** | [ue-pilot-cupe.yml](../../infrastructure/gitops/environments/ue-pilot-cupe.yml) |

---

## 3. Confirmed blast-radius risks (declared-state reconfirmation)

| ID | Risk | Confirmed in source | Status |
| --- | --- | --- | --- |
| **BR-1** | UE production execution topology in staging-named environment | [deploy-union-eyes.yml](../../.github/workflows/deploy-union-eyes.yml) step-summary note: *"production currently runs in staging-named Azure infrastructure; this workflow preserves that live topology intentionally"* — **BUT** the same workflow now resolves prod to `nzila-canada-prod-rg`/`nzila-canada-prod-env` and **hard-fails** if prod resolves to staging/demo/pilot infra. Config intent and the human note **contradict**. | **OPEN — requires LIVE-VERIFY (R-3)** |
| **BR-2** | CUPE pilot reuses `nzila-staging-db`, RLS-only isolation | [ue-pilot-cupe.yml](../../infrastructure/gitops/environments/ue-pilot-cupe.yml#L66) (`name: nzila-staging-db`, `PILOT_ORG_ID=cupe-local-123`, session-mode pool) | **OPEN** |
| **BR-3** | Pilot shares staging backup/restore boundary | [ue-pilot-cupe.yml](../../infrastructure/gitops/environments/ue-pilot-cupe.yml) — declared 14-day retention is on the shared staging instance; no independent boundary | **OPEN** |
| **BR-4** | Single shared GitHub deploy identity (`AZURE_CREDENTIALS`), bash RG-guard only | [deploy-union-eyes.yml](../../.github/workflows/deploy-union-eyes.yml) `build-and-deploy` | **OPEN** |
| **BR-5** | Shared ACR `nzilacanadaacr`; promotion by tagging only | all env configs + [deploy-union-eyes.yml](../../.github/workflows/deploy-union-eyes.yml) `IMAGE` | **OPEN** |
| **BR-6** | Identity-resolution substrate drift (`DEFAULT_ORGANIZATION_ID` silent fallback, org-cookie duplication, schema drift) may differ prod vs staging | runtime-integrity review (per plan §1) | **OPEN — substrate (separation-blocking)** |
| **BR-7** | Cutover/migration itself risks outage/split-brain | inherent to BR-1/BR-2 remediation | **OPEN (forward risk)** |

**Promotion-flow risk (process):** [auto-promote-union-eyes.yml](../../.github/workflows/auto-promote-union-eyes.yml) fans out to `production, demo, pilot, staging` **in parallel** (`max-parallel: 4`, `fail-fast: false`) on push to `main` — no sequential staging-soak gate before prod. This is the process-change target in plan §3 ("sequential gated promotion").

---

## 4. Reconciliation findings (IaC/config vs each other)

| ID | Finding | Why it matters | Resolution path |
| --- | --- | --- | --- |
| **R-1** | Naming-convention split: Bicep uses `nzila-${env}-*` / `nzila${env}acr`; live GitOps/workflows use `nzila-canada-${env}-*` / `nzilacanadaacr` | The Bicep layer does **not** name the resources the platform actually runs; IaC cannot be used as-is to manage live resources without name reconciliation | Decide canonical naming; align Bicep params to live names (a **Phase B/C IaC change**, not Phase A) |
| **R-2** | Staging log retention: Bicep 30d vs gitops 60d | Observability-isolation attestation (plan Phase E) needs a single source of truth | Reconcile in Phase E |
| **R-3** | BR-1 contradiction: prod note says "staging-named infra" but workflow resolution + guard target `nzila-canada-prod-env` | The single most important production claim cannot be settled from config alone | **LIVE-VERIFY** (§5) — the gating fact for BR-1 closure |
| **R-4** | Two distinct "pilot" profiles exist: sovereign [pilot.yml](../../infrastructure/gitops/environments/pilot.yml) (dedicated RG/env/KV/DB `nzila-canada-pilot-*`) vs live [ue-pilot-cupe.yml](../../infrastructure/gitops/environments/ue-pilot-cupe.yml) (reuses staging). The **target-state pilot already exists in IaC**, but the live CUPE pilot does not use it | Phase B migration has a ready-made target profile; BR-2/BR-3 closure is largely a *binding* change + data migration, not greenfield design | Drive CUPE pilot onto the sovereign `pilot` profile in Phase B |
| **R-5** | `production.yml` omits explicit DB `name`, `key_vault`, and `acr` blocks (present in staging/demo/pilot/cupe) | Prod config relies on Bicep/workflow defaults; attestation needs prod's KV/ACR/DB names made explicit | Capture via LIVE-VERIFY + make explicit in Phase C/E |

---

## 5. Required live verification (read-only — to be run by a human operator)

These confirm the declared inventory against running Azure. **None were executed in this wave.** All are read-only.

```bash
# BR-1 (R-3) — the gating fact: which ACA env does prod UE actually run in?
az containerapp show -n nzila-os-union-eyes-prod -g nzila-canada-prod-rg \
  --query "properties.managedEnvironmentId" -o tsv

# Enumerate prod RG contents
az resource list -g nzila-canada-prod-rg -o table

# BR-2/BR-3 — confirm pilot DB binding + that pilot has no independent instance
az postgres flexible-server list -g nzila-canada-staging-rg -o table
az postgres flexible-server show -n nzila-staging-db -g nzila-canada-staging-rg \
  --query "{ha:highAvailability.mode,backup:backup.backupRetentionDays,geo:backup.geoRedundantBackup}"

# Confirm whether the sovereign pilot resources (R-4) physically exist
az group exists -n nzila-canada-pilot-rg
az resource list -g nzila-canada-pilot-rg -o table 2>/dev/null

# BR-5 — single registry, who pulls
az acr show -n nzilacanadaacr --query "{sku:sku.name,rg:resourceGroup}"

# Key Vaults per env
az keyvault list --query "[].{name:name,rg:resourceGroup}" -o table

# Log Analytics workspaces + retention (R-2)
az monitor log-analytics workspace list --query "[].{name:name,rg:resourceGroup,retention:retentionInDays}" -o table

# Cross-subscription / Resource Graph sweep
az graph query -q "Resources | where resourceGroup startswith 'nzila-canada' | project name, type, resourceGroup, location" -o table
```

> **BR-4 (GitHub identity scope)** is verified in GitHub settings, not Azure: confirm whether `AZURE_CREDENTIALS` is a repo-level secret or scoped to each GitHub Environment (`production`/`staging`/`demo`/`pilot`), and whether environment protection rules gate the `build-and-deploy` job.

---

## 6. Freeze declaration (Phase A control)

To protect cutover phases, the following **change-freeze** is declared as a *governance intent* (no enforcement mechanism was created or modified in this wave):

- **Frozen surfaces during future cutover (Phases B–C):** the staging-named Container Apps environment (`nzila-canada-staging-env`) and the shared `nzila-staging-db` instance — no schema migrations, restores, scale changes, or revision purges except those that are part of the approved separation execution.
- **Freeze window:** to be scheduled at the start of Phase B execution (not now).
- **Enforcement:** to be implemented in Phase B (e.g., deploy-workflow guard / change-record gate) — **not created in Phase A.**

---

## 7. Proposed implementation sequence (forward plan — not executed)

Aligned to plan §4, with Phase A findings folded in:

1. **Phase B — Staging isolation:** bind the live CUPE pilot to the **already-declared** sovereign `pilot` profile (R-4); provision/confirm `nzila-canada-pilot-db` + `nzila-canada-pilot-kv` + `nzila-canada-pilot-env`; migrate `org_id = 'cupe-local-123'` off `nzila-staging-db` with reconciliation; keep RLS as defense-in-depth. Closes BR-2/BR-3.
2. **Phase C — Production isolation:** resolve R-3 via live verification, then (if needed) blue/green cut UE prod into a confirmed `nzila-canada-prod-env`; remove the stale "staging-named topology" note once proven. Closes BR-1.
3. **Phase D — Deployment identity separation:** per-environment OIDC subjects with environment-scoped RBAC; move `AZURE_CREDENTIALS` to GitHub Environment secrets; retain RG-name guard as defense-in-depth. Closes BR-4.
4. **Phase E — Observability + backup separation:** reconcile R-2; attest per-env LA isolation + retention; independent PITR runbooks incl. the new pilot DB. Closes BR-3 residue.
5. **Phase F — Cutover rehearsal + rollback proof:** sequence the parallel auto-promote into gated promotion; full-chain rehearsal with captured artifacts.
6. **Phase G — Runtime separation closeout:** package evidence; honest status.

## 8. Likely files / workflows to change in Phase B+

> Listed for planning visibility only. **None were modified in Phase A.**

- [infrastructure/gitops/environments/ue-pilot-cupe.yml](../../infrastructure/gitops/environments/ue-pilot-cupe.yml) — repoint pilot to sovereign profile (Phase B).
- [infrastructure/gitops/environments/pilot.yml](../../infrastructure/gitops/environments/pilot.yml) — confirm/extend sovereign pilot (Phase B).
- [infrastructure/bicep/main.bicep](../../infrastructure/bicep/main.bicep) + parameters — naming reconciliation (R-1), pilot DB, prod env (Phases B/C).
- [.github/workflows/deploy-union-eyes.yml](../../.github/workflows/deploy-union-eyes.yml) — remove stale BR-1 note after cutover; identity wiring (Phases C/D).
- [.github/workflows/auto-promote-union-eyes.yml](../../.github/workflows/auto-promote-union-eyes.yml) — parallel → sequential gated promotion (Phase F).
- `deploy-production.yml` / `deploy-staging.yml` / `gitops-deploy.yml` — identity + promotion gating (Phases D/F).

## 9. Rollback / evidence plan (Phase A)

- **Phase A produced no infrastructure change → nothing to roll back.** The only artifact is this report.
- **Evidence captured by Phase A:** this declared-state inventory + reconciliation findings (R-1…R-5) + confirmed risks (BR-1…BR-7) + the read-only verification command set (§5).
- **Forward evidence contract:** each later phase must capture its own before/after + drill artifacts per plan §6; promotion of `validate-live-readiness` / `validate-infra-convergence` / `validate-final-go` remains deferred to the Phase 5 gate-authority rules and is **not** addressed by this wave.

---

## 10. Constraints honored

- Phase A only; **no Azure changes, no workflow changes, no secret changes.**
- No live Azure inventory executed; declared-state only, with LIVE-VERIFY items explicitly flagged and **not** fabricated.
- No `final:go` promotion; no production-blocking gate achieved (still **0**); no production-readiness claim.
- No product/feature work.

## 11. Honest status

> Runtime separation implementation baseline is complete. No Azure changes have
> been made. Sensitive multi-org production remains pending actual separation,
> rehearsal evidence, and final-go certification.

## HARD STOP

Phase A is inventory and freeze **only**. Do **not** begin Phase B (or any Azure,
database, identity, or workflow change) without separate, explicit human
approval. Live verification (§5) should be completed by an operator before Phase
B planning is finalized.
