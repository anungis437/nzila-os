# Runtime Separation Implementation Wave — Phase A.1: Read-Only Live Runtime Verification

**Date:** 2026-06-28
**Wave:** Runtime Separation Implementation Wave (inventory/freeze stage)
**Phase:** A.1 — read-only live verification interlock (between Phase A and Phase B)
**Baseline:** [reports/governance/runtime-separation-wave-phaseA-inventory-2026-06-28.md](runtime-separation-wave-phaseA-inventory-2026-06-28.md)
**Plan:** [docs/governance/runtime/runtime-separation-plan.md](../../docs/governance/runtime/runtime-separation-plan.md)

> **Scope honored (verbatim mandate):** Read-only live verification only. **No Azure resources modified. No GitHub workflows modified. No secrets modified. No Bicep/GitOps files modified. No data migrated. No workload repointed.** No `final:go` movement. No production-readiness claim. **Phase B NOT started.** Hard stop after this report.
>
> **Secret handling:** No secret values were printed or captured. Only resource names, resource IDs, non-secret environment values, and Key Vault *reference URLs* (not contents) were read. Subscription and tenant IDs are redacted below as `<sub-id>` / `<tenant-id>`.

---

## 1. Environment

- Azure CLI `2.86.0`, authenticated read-only as `support@onelabtech.com`.
- Subscription: **"Azure subscription 1 Nzila"** (`<sub-id>`), tenant `onelabtech.com` (`<tenant-id>`), `Enabled`.

## 2. Commands run (read-only)

All commands were `az ... list` / `show` / `secret list` / `group exists` — no mutating verbs. Representative set:

```bash
az account show
az group list --query "[?starts_with(name,'nzila-canada')]"
az containerapp list --query "[].{name,rg,env:properties.environmentId}"
az postgres flexible-server list -g <each nzila RG>
az resource list --resource-type Microsoft.DBforPostgreSQL/flexibleServers
az keyvault list
az acr list
az monitor log-analytics workspace list
az group exists -n nzila-staging-rg
az containerapp secret list -n <ue app> -g <rg> --query "[].name"            # names only
az containerapp secret list -n <ue app> -g <rg> --query "[].keyVaultUrl"     # reference only
az containerapp show -n <ue app> -g <rg> \
  --query "properties.template.containers[].env[?<non-secret names>].{name,value}"   # non-secret env only
```

## 3. Live observed topology

### 3.1 Resource groups (live)

`nzila-canada-prod-rg`, `nzila-canada-staging-rg`, `nzila-canada-demo-rg`, `nzila-canada-pilot-rg` — all `canadacentral`. **Plus a separate legacy `nzila-staging-rg`** (holds `nzila-staging-kv`, `nzila-staging-logs`, and the `nzila-staging-db` server).

### 3.2 Union Eyes Container Apps (live) — managed environment binding

| App | Resource group | Managed environment | UE_ENVIRONMENT |
| --- | --- | --- | --- |
| `nzila-os-union-eyes-prod` | `nzila-canada-prod-rg` | **`nzila-canada-prod-env`** | `production` |
| `nzila-os-union-eyes-staging` | `nzila-canada-staging-rg` | `nzila-canada-staging-env` | `staging` |
| `nzila-os-union-eyes-demo` | `nzila-canada-demo-rg` | `nzila-canada-demo-env` | `demo` |
| `nzila-os-union-eyes-pilot` | `nzila-canada-pilot-rg` | **`nzila-canada-pilot-env`** | `pilot` |
| `nzila-os-union-eyes-django-pilot` | `nzila-canada-pilot-rg` | `nzila-canada-pilot-env` | (pilot backend) |

The remaining platform apps (`nzila-os-web/console/partners/zonga/...`) run in `nzila-canada-staging-env`. **No legacy `nzila-os-union-eyes` app and no `ue-pilot-cupe` app exist live** — the staging-reuse CUPE pilot described in config is not deployed.

### 3.3 PostgreSQL flexible servers (live)

| Server | Resource group | HA | Backup | Geo | Ver |
| --- | --- | --- | --- | --- | --- |
| `nzila-os-union-eyes-prod-db` | `nzila-canada-prod-rg` | **ZoneRedundant** | 30d | **Enabled (GRS)** | 16 |
| `nzila-ue-prod-db-drill-20260520` | `nzila-canada-prod-rg` | Disabled | 30d | Disabled | 16 |
| `nzila-os-union-eyes-demo-db` | `nzila-canada-demo-rg` | Disabled | 7d | Disabled | 16 |
| `nzila-canada-pilot-db` | `nzila-canada-pilot-rg` | Disabled | 7d | Disabled | 16 |
| `nzila-staging-db` | **`nzila-staging-rg`** (legacy RG) | Disabled | 35d | — | 15 |

> The presence of `nzila-ue-prod-db-drill-20260520` indicates a prod DB restore/PITR drill was already performed (relevant evidence for later Phase E/F).

### 3.4 Per-app database binding

| App | DB host (from non-secret env) / secret backing | DB | Isolation signal |
| --- | --- | --- | --- |
| prod | `PGHOST=nzila-os-union-eyes-prod-db.postgres.database.azure.com` (non-secret env), `PGDATABASE=nzila_os_prod` | dedicated prod DB | `database-url` = **inline** container-app secret (`keyVaultUrl: null`); `SECRET_AUTHORITY=azure-key-vault` |
| pilot | `database-url` backed by **`https://nzila-canada-pilot-kv.vault.azure.net/secrets/database-url`** | high-confidence dedicated `nzila-canada-pilot-db` | `ENVIRONMENT_ISOLATION=full`, `SECRET_AUTHORITY=nzila-canada-pilot-kv` |
| demo | `database-url` backed by **`https://nzila-canada-demo-kv.vault.azure.net/secrets/database-url`** | dedicated `nzila-os-union-eyes-demo-db` | `ENVIRONMENT_ISOLATION=full`, `SECRET_AUTHORITY=nzila-canada-demo-kv`, `UE_DEMO_ORG_ID=cupe-local-4373` |
| staging | `database-url` = **inline** container-app secret (`keyVaultUrl: null`) | host **not inspected** (secret) | `SECRET_AUTHORITY=staging-kv-operator`, `ENVIRONMENT_ISOLATION=full` |

> **Honest limit:** the pilot/demo DB *host* lives inside a KV secret value and was **not** read. The binding is inferred (high confidence) from the dedicated sovereign vault reference + the dedicated DB server existing in the same sovereign RG. Prod's host is directly confirmed via the non-secret `PGHOST` env value.

### 3.5 Key Vaults, ACR, Log Analytics (live)

- **Key Vaults:** `nzila-canada-prod-kv` (prod-rg), `nzila-canada-demo-kv` (demo-rg), `nzila-canada-pilot-kv` (pilot-rg), `nzila-staging-kv` (**legacy `nzila-staging-rg`**). Per-env separation holds; staging KV sits in the legacy RG.
- **ACR:** **single `nzilacanadaacr`** (Basic) in `nzila-canada-staging-rg`. All environments pull from it (staging app even carries a registry secret `nzilacanadaacrazurecrio-nzilacanadaacr`). **BR-5 confirmed.**
- **Log Analytics:** `nzila-canada-prod-law` (90d), `nzila-canada-demo-law` (30d), `nzila-canada-pilot-logs` (30d), `nzila-staging-logs` (30d, legacy RG). Per-env separation holds; prod retention 90d as required.

---

## 4. Declared-vs-Live matrix

| Surface | Declared (Phase A, from repo) | Live (Phase A.1) | Verdict |
| --- | --- | --- | --- |
| Prod UE execution env | "runs in staging-named infra" (workflow note) | **`nzila-canada-prod-env`** in `nzila-canada-prod-rg` | **DECLARED STALE — live is separated** |
| Prod DB | `nzila-prod-pg`, HA, 35d GRS | `nzila-os-union-eyes-prod-db`, ZoneRedundant, **30d** GRS | Live separated (backup 30d not 35d) |
| Pilot env | sovereign `pilot` profile exists; live CUPE pilot reuses staging | live pilot = **sovereign** `nzila-canada-pilot-env` + `nzila-canada-pilot-kv` | **DECLARED (cupe) STALE — live is sovereign** |
| Pilot DB | `nzila-staging-db` reuse (RLS-only) per `ue-pilot-cupe.yml` | dedicated `nzila-canada-pilot-db` + pilot-KV secret | **Live separated (high confidence)** |
| Pilot backup boundary | shares staging | dedicated `nzila-canada-pilot-db` (own 7d) | **Live separated** |
| `nzila-staging-db` | in `nzila-canada-staging-rg` | actually in legacy **`nzila-staging-rg`**, v15, 35d | Location corrected |
| Demo DB | dedicated | dedicated `nzila-os-union-eyes-demo-db` | Confirmed separated |
| Key Vaults | per-env | per-env (staging KV in legacy RG) | Confirmed separated |
| ACR | single shared `nzilacanadaacr` | single shared `nzilacanadaacr` | **Confirmed shared (BR-5)** |
| Log Analytics | per-env; staging 30/60d discrepancy | per-env; staging **30d** | Confirmed separated; R-2 resolves to 30d |
| Deploy identity | single shared `AZURE_CREDENTIALS` | (GitHub-side; not changed) | **Still open (BR-4)** |
| Naming (R-1) | Bicep `nzila-${env}-*` vs live `nzila-canada-${env}-*` | live uses `nzila-canada-${env}-*` | Bicep naming is stale/aspirational |

---

## 5. Risk confirmation / correction

| ID | Phase A status | Phase A.1 live verdict |
| --- | --- | --- |
| **BR-1** UE prod in staging-named env | OPEN (contradiction) | **REFUTED / CLOSED at infra layer.** Prod UE runs in `nzila-canada-prod-env`/`nzila-canada-prod-rg` with a dedicated ZoneRedundant GRS prod DB (`nzila_os_prod`). The workflow's "staging-named topology" note is **stale documentation drift**, not live reality. |
| **BR-2** CUPE pilot reuses `nzila-staging-db` | OPEN | **REFUTED for the live pilot.** Live pilot is sovereign (`nzila-canada-pilot-env` + `nzila-canada-pilot-kv`, dedicated `nzila-canada-pilot-db`). The staging-reuse profile (`ue-pilot-cupe.yml`) is **not deployed** — it is stale/latent config. *(Residual: confirm where CUPE Local 123 org data physically resides; pilot DB host is KV-secret, not inspected.)* |
| **BR-3** shared staging↔pilot backup boundary | OPEN | **REFUTED for the live pilot.** `nzila-canada-pilot-db` has its own backup; no shared boundary live. |
| **BR-4** shared deploy identity | OPEN | **STILL OPEN.** Single shared `AZURE_CREDENTIALS` in workflows is unchanged; this is a GitHub/SP-scope concern not resolved by Azure resource inspection. Requires GitHub-side verification + Phase D. |
| **BR-5** shared ACR | OPEN | **CONFIRMED OPEN.** One `nzilacanadaacr` serves all environments. |
| **BR-6** org-context substrate drift (`DEFAULT_ORGANIZATION_ID`) | OPEN | **STILL OPEN (not infra-observable).** A code/runtime-integrity concern; cannot be confirmed/refuted by resource inspection. Carry forward. |
| **BR-7** cutover/split-brain | forward risk | **Largely moot for prod/pilot** (already separated); only relevant to any future ACR/identity work. |

**Net:** the three most severe blast-radius risks (BR-1, BR-2, BR-3) are **refuted by live topology** — the running platform is materially *more* separated than the repository's declared config implied. The real, genuinely-open issues are now: **BR-4 (shared deploy identity)**, **BR-5 (shared ACR)**, **BR-6 (substrate drift, code-level)**, and a new dominant theme — **configuration/IaC drift vs live truth**.

### New findings (config-truth drift)

| ID | Finding | Risk |
| --- | --- | --- |
| **D-1** | `deploy-union-eyes.yml` still prints "production runs in staging-named Azure infrastructure" — false vs live. | Misleads operators; could justify a wrong cutover. Documentation-only fix (later phase). |
| **D-2** | `ue-pilot-cupe.yml` (staging-reuse, RLS-only pilot) is latent in the repo but not deployed. | A future deploy of this profile would *re-introduce* BR-2/BR-3. Should be retired/quarantined. |
| **D-3** | Bicep names (`nzila-${env}-*`, `nzila${env}acr`, `nzila-${env}-pg`) do not match live (`nzila-canada-${env}-*`, `nzila-os-union-eyes-${env}-db`). | IaC cannot manage live resources as-is; drift risk. |
| **D-4** | Prod/staging `database-url` are **inline** container-app secrets (`keyVaultUrl: null`); pilot/demo are **KV-backed**. | Inconsistent secret topology; prod arguably should be KV-backed like pilot/demo. Observation for Phase D/E. |
| **D-5** | Legacy `nzila-staging-rg` (separate from `nzila-canada-staging-rg`) holds `nzila-staging-db` (v15), `nzila-staging-kv`, `nzila-staging-logs`. | Two staging-ish RGs; clarify ownership/retirement. |

---

## 6. Phase B go / no-go recommendation

**Recommendation: QUALIFIED GO — but Phase B must be RE-SCOPED.**

- The original Phase B ("staging isolation: provision dedicated pilot DB + migrate pilot data off staging") is **largely already true in live**. Do **NOT** execute a pilot data migration or stand up new sovereign pilot infra — it exists. A blind execution of the original plan would solve a problem that is already solved and could disturb a healthy, separated pilot.
- Re-scope Phase B to **reconciliation + closing the genuinely-open surfaces**:
  1. Confirm CUPE Local 123 org-data residency on `nzila-canada-pilot-db` (the one residual of BR-2) — read-only DB-side check, separately approved.
  2. Retire/quarantine the stale `ue-pilot-cupe.yml` profile (D-2) so it can't re-introduce BR-2/BR-3.
  3. Correct the stale prod "staging-named" note (D-1) and reconcile Bicep naming (D-3).
- Keep **BR-4 (deploy identity)** and **BR-5 (ACR)** for their dedicated phases (D / D-E). These are the real remaining separation gaps.
- **NO-GO** on any infra construction or data migration premised on the now-refuted BR-1/BR-2/BR-3.

## 7. Resources Phase B *may* safely modify later (with separate approval)

> Listed for planning only. **Nothing modified in A.1.**

- Repo files (not Azure): [.github/workflows/deploy-union-eyes.yml](../../.github/workflows/deploy-union-eyes.yml) (remove stale note), [infrastructure/gitops/environments/ue-pilot-cupe.yml](../../infrastructure/gitops/environments/ue-pilot-cupe.yml) (retire/quarantine), [infrastructure/bicep/main.bicep](../../infrastructure/bicep/main.bicep) + parameters (naming reconciliation), [.github/workflows/auto-promote-union-eyes.yml](../../.github/workflows/auto-promote-union-eyes.yml) (sequential gating, Phase F).
- ACR strategy (`nzilacanadaacr`) — image-promotion attestation or registry segregation (BR-5), Phase D/E.
- GitHub Environment secrets / federated credentials for deploy identity (BR-4), Phase D — GitHub-side, not these Azure resources.

## 8. Resources Phase B MUST NOT touch

- **`nzila-os-union-eyes-prod`** Container App and **`nzila-os-union-eyes-prod-db`** (live production + its dedicated DB) — no changes under a separation pretext; they are already separated.
- **`nzila-canada-prod-env`**, **`nzila-canada-prod-kv`**, **`nzila-canada-prod-law`** — production substrate.
- **`nzila-canada-pilot-db`**, **`nzila-canada-pilot-kv`**, **`nzila-os-union-eyes-pilot`** — the live sovereign pilot; no migration.
- **`nzila-ue-prod-db-drill-20260520`** — existing drill artifact; preserve as evidence, do not casually delete.
- Any **secret values** in any vault or container app.

---

## 9. Constraints honored

- Read-only verification only; **no Azure/workflow/secret/IaC change; no migration; no repoint.**
- No secret values printed (names + KV reference URLs + non-secret env values only).
- No `final:go` movement; production-blocking achieved remains **0**; no production-readiness claim.
- Phase B **not** started.

## 10. Honest status

> Live runtime verification is complete. No Azure changes have been made. Phase B
> remains pending approval. Sensitive multi-org production remains pending actual
> separation, rehearsal evidence, and final-go certification.

**Material correction to record:** the live platform is **more separated than the
repo's declared configuration implied**. BR-1, BR-2, and BR-3 are refuted at the
infrastructure layer; the dominant remaining work is **config/IaC truth
reconciliation** plus the genuinely-shared **deploy identity (BR-4)** and **ACR
(BR-5)**, and the code-level **substrate drift (BR-6)**. This does **not** by
itself confer production certification — `final:go` remains advisory and the
certification evidence bundle (plan §6) is still unmet.

## HARD STOP

Phase A.1 is read-only verification **only**. Do **not** begin Phase B (or any
Azure/DB/identity/workflow/IaC change) without separate, explicit human approval,
and only against the **re-scoped** Phase B defined in §6.
