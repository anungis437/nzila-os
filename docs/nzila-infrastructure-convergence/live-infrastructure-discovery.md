# 01 — Live Infrastructure Discovery

**Authority:** `az` CLI discovery output (May 9, 2026).
**Subscription:** `5d819f33-d16f-429c-a3c0-5b0e94740ba3` (Azure subscription 1 Nzila).
**Tenant:** `5082b8be-b04d-4a13-b61c-b6397670177b`.

---

## 1. Resource Groups (real)

| RG                          | Region          | Purpose                              | Verdict |
|-----------------------------|-----------------|--------------------------------------|---------|
| `nzila-staging-rg`          | East US         | Legacy: holds staging DB + KV        | LIVE (legacy region) |
| `nzila-canada-staging-rg`   | Canada Central  | Active staging fabric (15 ACA apps) | LIVE    |
| `nzila-canada-demo-rg`      | Canada Central  | Demo isolation (UE only)             | LIVE    |

> No `dev`, `pilot`, or `prod` resource group exists. Prod custom domains
> are bound onto staging fabric.

---

## 2. Container Apps Environments

| Environment                  | RG                         | Default domain                                                       |
|------------------------------|----------------------------|----------------------------------------------------------------------|
| `nzila-canada-staging-env`   | `nzila-canada-staging-rg`  | `jollydune-88c1e97f.canadacentral.azurecontainerapps.io`             |
| `nzila-canada-demo-env`      | `nzila-canada-demo-rg`     | `greenmoss-d27e0e19.canadacentral.azurecontainerapps.io`             |

---

## 3. Container Apps — Staging fabric (15 apps, all Running)

> Uniform image tag `f1e66a2d04720c5e8df59454e14e75104292f250` across 14 of 15
> apps. **Outlier:** `nzila-os-platform-admin` is on
> `platform-admin-1636e98e-20260422172320:latest` (drift, see §11).

| App                          | FQDN (ACA default)                                                              | Custom domains                                                                                  | Latest revision     |
|------------------------------|---------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------|---------------------|
| `nzila-os-web`               | `nzila-os-web.jollydune-88c1e97f.canadacentral.azurecontainerapps.io`           | `nzilaventures.com`, `www.nzilaventures.com`                                                    | `--0000147`         |
| `nzila-os-console`           | `…console.…`                                                                    | `console.nzilaventures.com`, `staging-console.nzilaventures.com`                                | `--0000154`         |
| `nzila-os-partners`          | `…partners.…`                                                                   | `partners.nzilaventures.com`, `staging-partners.nzilaventures.com`                              | `--0000153`         |
| `nzila-os-union-eyes`        | `…union-eyes.…`                                                                 | `app.unioneyes.app`, `staging.unioneyes.app`, `staging-app.unioneyes.app`, `unioneyes.app`, `www.unioneyes.app` | `--0000263`  |
| `nzila-os-zonga`             | `…zonga.…`                                                                      | `zonga.nzilaventures.com`, `staging-zonga.nzilaventures.com`                                    | `--0000145`         |
| `nzila-os-control-plane`     | `…control-plane.…`                                                              | `control.nzilaventures.com`, `staging-control.nzilaventures.com`                                | `--0000041`         |
| `nzila-os-platform-admin`    | `…platform-admin.…`                                                             | `admin.nzilaventures.com`, `staging-admin.nzilaventures.com`                                    | `--0000008`         |
| `nzila-os-flow`              | `…flow.…`                                                                       | `staging-flow.nzilaventures.com`                                                                | `--0000004`         |
| `nzila-os-cfo`               | `…cfo.…`                                                                        | (none)                                                                                          | `--0000004`         |
| `nzila-os-agrimo`            | `…agrimo.…`                                                                     | (none)                                                                                          | `--0000004`         |
| `nzila-os-cora`              | `…cora.…`                                                                       | (none)                                                                                          | `--0000004`         |
| `nzila-os-trade`             | `…trade.…`                                                                      | (none)                                                                                          | `--0000004`         |
| `nzila-os-mobility`          | `…mobility.…`                                                                   | (none)                                                                                          | `--0000004`         |
| `nzila-os-orchestrator-api`  | `…orchestrator-api.…`                                                           | (none)                                                                                          | `--0000005`         |
| `nzila-os-abr`               | `…abr.…`                                                                        | (none)                                                                                          | `--0000004`         |

---

## 4. Container Apps — Demo fabric (1 app)

| App                          | FQDN                                                                                              | Image                                              | Latest revision |
|------------------------------|---------------------------------------------------------------------------------------------------|----------------------------------------------------|-----------------|
| `nzila-os-union-eyes-demo`   | `nzila-os-union-eyes-demo.greenmoss-d27e0e19.canadacentral.azurecontainerapps.io`                 | `nzilacanadaacr.azurecr.io/nzila-os-union-eyes:production` | `--0000001` |

> **Honest gap:** Demo runs an image tagged `:production` (mutable tag, not a
> SHA). Demo has only **1 revision ever** — never iterated. **CONDITIONAL.**

---

## 5. PostgreSQL Flexible Servers

| Server                            | RG                         | Region          | Version | FQDN                                                       | State |
|-----------------------------------|----------------------------|-----------------|---------|------------------------------------------------------------|-------|
| `nzila-staging-db`                | `nzila-staging-rg`         | Canada Central¹ | 15      | `nzila-staging-db.postgres.database.azure.com`             | Ready |
| `nzila-os-union-eyes-demo-db`     | `nzila-canada-demo-rg`     | Canada Central  | 16      | `nzila-os-union-eyes-demo-db.postgres.database.azure.com`  | Ready |

¹ The RG is in East US (legacy) but the DB itself is hosted in Canada Central.

> **Honest gap:** Version skew (15 vs 16). Demo DB is newer than staging DB.

---

## 6. Key Vaults

| KV                       | RG                         | Region          | Verdict |
|--------------------------|----------------------------|-----------------|---------|
| `nzila-staging-kv`       | `nzila-staging-rg`         | East US         | LIVE — holds AUTH_SECRET, DB password, Stripe, OpenAI, Resend, Upstash, Django keys, Entra client secret, Whisper key |
| `nzila-canada-demo-kv`   | `nzila-canada-demo-rg`     | Canada Central  | LIVE (provisioned) — but demo container references **NO** KV-backed secrets (see §8) |

---

## 7. DNS

`az network dns zone list` returned `[]` — **no Azure-managed DNS zones**.
DNS for `nzilaventures.com` and `unioneyes.app` is managed externally
(registrar / Cloudflare / similar). All custom-domain bindings are validated
via TXT/CNAME at ACA level.

---

## 8. UE Container Env Var Parity (staging vs demo)

| Concern                              | Staging | Demo  |
|--------------------------------------|---------|-------|
| Total env vars                       | 50      | ~24   |
| Secret-backed env vars               | 14      | **0** |
| `AUTH_SECRET` (KV-backed)            | YES     | NO    |
| `AZURE_AD_CLIENT_SECRET` (KV-backed) | YES     | NO    |
| `DATABASE_URL` / `PGPASSWORD` (KV-backed) | YES | NO    |
| `STRIPE_SECRET_KEY` (KV-backed)      | YES     | NO    |
| `RESEND_API_KEY` (KV-backed)         | YES     | NO    |
| `AZURE_OPENAI_API_KEY` (KV-backed)   | YES     | NO    |
| `EVIDENCE_SEAL_KEY` (KV-backed)      | YES     | NO    |
| `CRON_SECRET` (KV-backed)            | YES     | NO    |
| `UPSTASH_REDIS_REST_*` (KV-backed)   | YES     | NO    |
| `DJANGO_SECRET_KEY` (KV-backed)      | YES     | NO    |
| `STRIPE_WEBHOOK_SECRET` (KV-backed)  | YES     | NO    |
| `NZILA_MODE`                         | YES     | YES   |
| `UE_ENVIRONMENT`                     | YES     | YES   |
| `RELEASE_ID`, `GITHUB_SHA`, `BUILD_TIME` | YES | NO    |

**Verdict:** Demo cannot perform any operation that requires the missing
secrets. It is a **shell** environment — useful for surface validation, NOT
useful for operational E2E.

---

## 9. ACR

`nzilacanadaacr.azurecr.io` — single registry shared by staging + demo.

---

## 10. Observability

Discovered: `nzila-canada-demo-law` (Log Analytics workspace, demo-RG-scoped).
Staging Log Analytics is associated with the staging-env (`nzila-canada-staging-env`).

---

## 11. Material Findings

| # | Finding                                                                | Severity |
|---|------------------------------------------------------------------------|----------|
| 1 | No `dev` Azure tier exists                                             | Documented |
| 2 | No `pilot` Azure tier exists                                           | Documented |
| 3 | No `prod` Azure tier — prod custom domains land on staging fabric      | High — discloses to procurement |
| 4 | Demo has zero secret-backed env vars                                   | High |
| 5 | Demo runs only 1 revision (`--0000001`); never iterated                | Medium |
| 6 | Demo image uses mutable `:production` tag, not SHA                     | Medium |
| 7 | Platform-admin app is on a divergent image (`…20260422172320:latest`)  | Medium |
| 8 | DB version skew: staging 15, demo 16                                   | Medium |
| 9 | Staging DB + KV reside in `nzila-staging-rg` (East US RG, Canada DB)   | Low — cosmetic |
| 10 | DNS managed externally; no Azure DNS zones                            | Documented |

---

**Verdict for §1:** Live infrastructure discovery is **complete and honest**.
The catalog above replaces any prior assumptions about topology.
