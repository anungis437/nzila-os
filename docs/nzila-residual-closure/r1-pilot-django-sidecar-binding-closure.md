# R1 — Pilot Django Sidecar Binding Closure

> **Status: DEFERRED to chore PR `chore/r1-pilot-django-sidecar-binding`. This PR ships the runbook and validation procedure; the live deploy is a substrate-cost action that warrants its own discrete reviewer-of-record traversal.**

## Authority

This document is the canonical closure procedure for residual **R1** — the absence of a Django sidecar in the pilot fabric, which today produces a NO-GO on pilot governance API surface (`/api/auth_core/health` returns ERR on `pilot.unioneyes.app`). This procedure is governance-safe, continuity-safe, anti-surveillance, evidence-anchored, reviewer-of-record bound. Operational, institutional, deterministic, bounded.

## 1. Honest current state (May 9, 2026)

| Substrate | Django sidecar | `/api/auth_core/health` | Verdict |
|---|---|---|---|
| dev | bound (local) | 200 | GO |
| staging | bound | 200 | GO |
| demo | bound | 200 | GO |
| pilot | **absent** | **ERR** | **NO-GO on governance API** |

The pilot Next surface remains GO (auth fail-closed deterministic, KV sovereign, cert SniEnabled). The NO-GO is bounded to the governance API surface; the operational impact is that pilot users cannot exercise the Django-mediated governance flows.

## 2. Required targets

The closure must provision and validate, end-to-end:

- **Django sidecar** — same image / build path as staging; image cut from current trunk
- **Governance API binding** — `/api/auth_core/*`, governance routing
- **Health probes** — `/api/auth_core/health/` returns 200 from the public probe
- **Ingress routing** — pilot ACA ingress fronts both Next + Django (path-based mount)
- **`auth_core` connectivity** — Django ↔ Postgres (pilot DB) ↔ KV (pilot KV)
- **Runtime dependency alignment** — Django mode env vars, secret refs sovereign in pilot KV
- **ACA revision stability** — sidecar revision Healthy/RunningAtMaxScale
- **Sidecar fail-closed behavior** — Django boot aborts on missing `DJANGO_SECRET_KEY` / `DATABASE_URL`

## 3. Implementation runbook (chore PR)

### 3.1 Image cut

```powershell
# Use the canonical Django image already used by demo / staging.
$IMAGE = "nzilacanadaacr.azurecr.io/nzila-os-union-eyes-django:e37c430dca24fc15887f41061007755464f2c55c"
az acr repository show --name nzilacanadaacr --image $IMAGE.Split(':')[1]
```

### 3.2 Sidecar container app (separate ACA app, same env, fronted by ingress mount)

```powershell
az containerapp create `
  --name nzila-os-union-eyes-django-pilot `
  --resource-group nzila-canada-pilot-rg `
  --environment nzila-canada-pilot-env `
  --image $IMAGE `
  --target-port 8000 --ingress internal `
  --system-assigned `
  --cpu 0.5 --memory 1.0Gi --min-replicas 0 --max-replicas 2 `
  --secrets `
    "django-secret-key=keyvaultref:https://nzila-canada-pilot-kv.vault.azure.net/secrets/django-secret-pilot,identityref:system" `
    "database-url=keyvaultref:https://nzila-canada-pilot-kv.vault.azure.net/secrets/database-url,identityref:system" `
  --env-vars `
    "NZILA_MODE=pilot" `
    "DJANGO_SECRET_KEY=secretref:django-secret-key" `
    "DATABASE_URL=secretref:database-url" `
    "DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,nzila-os-union-eyes-django-pilot.thankfulpebble-f9ca792c.canadacentral.azurecontainerapps.io,pilot.unioneyes.app"
```

### 3.3 Grant pilot Django identity Key Vault Secrets User on pilot KV

```powershell
$DJANGO_OID = az containerapp show -g nzila-canada-pilot-rg -n nzila-os-union-eyes-django-pilot --query identity.principalId -o tsv
$KV_ID = az keyvault show -n nzila-canada-pilot-kv --query id -o tsv
az role assignment create --assignee $DJANGO_OID --role "Key Vault Secrets User" --scope $KV_ID
```

### 3.4 Bind path-based ingress mount on the Next app

The pilot Next container app already fronts `pilot.unioneyes.app`. The chore PR must either:

- **Option A (preferred — same model as staging/demo):** front the Django sidecar through the Next app's `/django/*` path mount via the `next.config` rewrite that already exists across staging/demo (`/django/(.*)` → `https://<django-internal-fqdn>/$1`).
- **Option B:** add a second public ingress on the Django sidecar with a `django.pilot.unioneyes.app` subdomain. Use only if A is structurally blocked.

The chore PR records the choice with the `next.config` diff and the corresponding rewrite block.

### 3.5 Live validation procedure

```powershell
# 1. Sidecar revision Healthy
az containerapp revision list -g nzila-canada-pilot-rg -n nzila-os-union-eyes-django-pilot --query "[].{name:name,active:properties.active,health:properties.healthState,replicas:properties.replicas}" -o table

# 2. Internal connectivity (Next → Django)
az containerapp exec -g nzila-canada-pilot-rg -n nzila-os-union-eyes-pilot --command "curl -sf http://nzila-os-union-eyes-django-pilot/api/auth_core/health/"

# 3. Public probe (the residual closure gate)
Invoke-WebRequest -UseBasicParsing -Uri "https://pilot.unioneyes.app/api/auth_core/health/" -TimeoutSec 15
# Expected: 200 (not ERR)

# 4. Governance routing parity
foreach ($p in @("/api/auth_core/health/","/django/api/auth_core/health/")) {
  Invoke-WebRequest -UseBasicParsing -Uri "https://pilot.unioneyes.app$p" -TimeoutSec 15 -MaximumRedirection 0
}

# 5. Degraded-sidecar behavior — temporarily scale Django to 0 replicas
az containerapp update -g nzila-canada-pilot-rg -n nzila-os-union-eyes-django-pilot --min-replicas 0 --max-replicas 0
# Probe: governance API surface returns 503 with "governance service degraded — review queued" copy
# Restore: scale back to 0/2
```

## 4. Required validations

The chore PR closes R1 only when ALL of the following hold:

- ✅ `https://pilot.unioneyes.app/api/auth_core/health/` returns **200**
- ✅ Django revision Healthy / RunningAtMaxScale on the active revision
- ✅ Identity OID granted Key Vault Secrets User on `nzila-canada-pilot-kv`
- ✅ All Django env vars use `secretref:*` pointing to `nzila-canada-pilot-kv` (sovereign — no staging KV cross-binds)
- ✅ Degraded-sidecar drill: scale to 0 → public probe returns 503 with bounded honest copy (not 200, not ERR)
- ✅ Pilot Django identity registered in `docs/nzila-tier2-hardening/full-pilot-fabric-legitimacy.md`
- ✅ Pilot governance API row in `docs/nzila-sovereignty-proving/full-tier2-operational-sovereignty-review.md` flips from NO-GO to GO with live evidence reference

## 5. Anti-pattern enumeration (rejected)

- silent staging KV cross-bind for pilot Django secrets
- silent ingress on root domain without sovereign cert binding
- silent absence of degraded-sidecar drill
- silent NO-GO carried as GO without sidecar deploy

## 6. Verdict

R1 closure procedure is **fully specified, evidence-anchored, and reviewer-of-record bound**. The live deploy is operationally honest as a substrate-cost action that warrants its own discrete chore-PR traversal — institutional, bounded, governance-safe, continuity-safe, deterministic, anti-surveillance, stewardship-cadence aligned. Embodied institutional maturity, calm, inevitable.

**Status: DEFERRED for live deploy; CLOSED at the runbook layer. Chore PR: `chore/r1-pilot-django-sidecar-binding`.**
