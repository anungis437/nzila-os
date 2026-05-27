# Union Eyes — Runtime Evidence Pack

**Status:** Section A ✅ COMPLETE (code-verified) / Section B ✅ VERIFIED 2026-05-21 (live Azure proof captured)  
**Last updated:** 2026-05-21  
**Source of truth:** `reports/runtime/platform-runtime-truth-latest.json` (code/config posture) + `reports/runtime/live-captures/2026-05-20/live-evidence-manifest.2026-05-20.json` (live operational proof)  
**Supersedes:** All versions referencing DEGRADED, EXC-001 open, or Section B PENDING  
**Live-evidence dependencies:** Section B — VERIFIED via authenticated Azure CLI capture (subscription 5d819f33-d16f-429c-a3c0-5b0e94740ba3, support@onelabtech.com)

---

> **Three-layer distinction:**
> - **Code/config posture:** HEALTHY (this document, Section A)
> - **Live operational proof:** VERIFIED 2026-05-21 (Section B — `reports/runtime/live-captures/2026-05-20/`)
> - **Production expansion:** GO — live PITR restore drill executed and verified 2026-05-21 (RESTORE-DRILL-2026-05-20-001, manifest at `reports/runtime/live-captures/2026-05-20/restore-drill/restore-drill-manifest.json`). Remaining items (DPA counter-signature, SOC 2 Type 1, external pen-test) are commercial/process.

---

## A. Code-Verified Evidence (confirmed in repo)

### A1. Overall platform status

| Item | Status | Source |
|---|---|---|
| Overall runtime status | ✅ HEALTHY | `platform-runtime-truth-latest.json` |
| Prod resource group | `nzila-canada-prod-rg` | `platform-runtime-truth-latest.json` |
| Staging resource group | `nzila-canada-staging-rg` | `platform-runtime-truth-latest.json` |
| Shared blast radius | ❌ false (separated) | `platform-runtime-truth-latest.json` |
| EXC-001 | ✅ RESOLVED 2026-05-14 | `platform-runtime-truth-latest.json` |
| Data residency | ✅ HEALTHY — canadacentral only | `platform-runtime-truth-latest.json` |
| Org isolation | ✅ FIXED — fail-closed | `platform-runtime-truth-latest.json` |
| DB import violations | ✅ 0 | CI `pnpm exec tsx scripts/check-ue-db-import-guard.ts` |
| Typecheck errors | ✅ 0 | CI `pnpm typecheck` |

### A2. Deployed applications (14 container apps, all canadacentral)

| App | Region |
|---|---|
| nzila-os-web | canadacentral |
| nzila-os-union-eyes | canadacentral |
| nzila-os-console | canadacentral |
| nzila-os-control-plane | canadacentral |
| nzila-os-platform-admin | canadacentral |
| nzila-os-flow | canadacentral |
| nzila-os-cfo | canadacentral |
| nzila-os-agrimo | canadacentral |
| nzila-os-cora | canadacentral |
| nzila-os-abr | canadacentral |
| nzila-os-trade | canadacentral |
| nzila-os-mobility | canadacentral |
| nzila-os-zonga | canadacentral |
| nzila-os-partners | canadacentral |

Source: `reports/runtime/azure-runtime-latest.json`

### A3. CI health (most recent run)

| Check | Result |
|---|---|
| `pnpm typecheck --filter @nzila/union-eyes` | ✅ 0 errors |
| `pnpm exec tsx scripts/check-ue-db-import-guard.ts` | ✅ 0 violations |
| `gitleaks` (secret scan) | ✅ 0 secrets detected |
| `pnpm test:fast` | ✅ passing |
| Evidence lifecycle tests (6/6) | ✅ |
| FSM lifecycle tests (19/19) | ✅ |
| Cross-org isolation tests (38/38) | ✅ |
| ClamAV contract test | ✅ |
| Correlation parity tests (5/5) | ✅ |

---

## B. Live Environment Evidence (to be captured before broad production)

Complete each row and store evidence in `reports/runtime/` before expanding pilot scope.

### B1. Smoke tests

| Check | Command | Status | Evidence file |
|---|---|---|---|
| Prod UE health endpoint | `curl -fsS https://nzila-os-union-eyes-prod.bluesand-c3ac2d8c.canadacentral.azurecontainerapps.io/api/health` | ✅ VERIFIED — 2026-05-21 (HTTP 200, ok:true; composite "degraded" only due to out-of-scope Django backend) | `live-captures/2026-05-20/prod-api-health.txt` |
| Prod UE readiness endpoint | `curl -fsS .../api/ready` | ✅ VERIFIED — 2026-05-21 (HTTP 200, ready:true, gitSha 050532f, releaseId UE-2026-05-20-050532f) | `live-captures/2026-05-20/prod-api-ready.txt` |
| Staging UE health endpoint | `curl -fsS https://nzila-os-union-eyes-staging.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/api/health` | ✅ VERIFIED — 2026-05-21 (HTTP 200, ok:true; db:ok, auth:ok, redis:ok; Django sidecar absent — expected. STAGING-UP-001 closed.) | `live-captures/2026-05-20/staging-warmup/06-after-health.txt` |
| Staging UE readiness endpoint | `curl -fsS .../api/ready` | ✅ VERIFIED — 2026-05-21 (HTTP 200, ready:true, releaseId UE-2026-05-18-7a0d193. STAGING-UP-001 closed.) | `live-captures/2026-05-20/staging-warmup/07-after-ready.txt` |

### B2. Azure resource group confirmation

| Check | Command | Status | Evidence file |
|---|---|---|---|
| Prod RG exists | `az group show -n nzila-canada-prod-rg` | ✅ VERIFIED — 2026-05-21 (canadacentral, tags env=prod product=union-eyes managed-by=bicep) | `live-captures/2026-05-20/prod-rg.json` |
| Staging RG exists | `az group show -n nzila-canada-staging-rg` | ✅ VERIFIED — 2026-05-21 (canadacentral, distinct RG) | `live-captures/2026-05-20/staging-rg.json` |
| Prod ≠ staging RG (no shared blast radius) | Inventory comparison | ✅ VERIFIED — 2026-05-21 (separate RGs, separate Container App envs, separate FQDN bases bluesand-c3ac2d8c vs jollydune-88c1e97f) | `live-captures/2026-05-20/prod-resources.json` + `staging-resources.json` |
| Prod Container App Environment | `az containerapp env show -g nzila-canada-prod-rg -n nzila-canada-prod-env` | ✅ VERIFIED — 2026-05-21 | `live-captures/2026-05-20/prod-env.json` |
| Staging Container App Environment | `az containerapp env show -g nzila-canada-staging-rg -n nzila-canada-staging-env` | ✅ VERIFIED — 2026-05-21 (separate env from prod) | `live-captures/2026-05-20/staging-env.json` |

### B3. Key Vault separation

| Check | Command | Status | Evidence file |
|---|---|---|---|
| Prod Key Vault exists | `az keyvault show -n nzila-canada-prod-kv -g nzila-canada-prod-rg` | ✅ VERIFIED — 2026-05-21 (canadacentral, soft-delete enabled) | `live-captures/2026-05-20/prod-keyvault.json` |
| Prod KV referenced by Container App secrets | `az containerapp show ... --query secrets[].keyVaultUrl` | ✅ VERIFIED — 2026-05-21 (3 secrets resolved from nzila-canada-prod-kv) | `live-captures/2026-05-20/prod-containerapp.json` |
| Prod KV ≠ staging KV | All KV inventory | ✅ VERIFIED — 2026-05-21 + ⚠️ EXCEPTION (STAGING-KV-001): staging uses Container App inline secrets, no dedicated KV — acceptable for synthetic-data staging | `live-captures/2026-05-20/keyvaults-all.json` |
| Prod Storage account | `az storage account show -n nzilacanadaprodev` | ✅ VERIFIED — 2026-05-21 (HTTPS-only, TLS 1.2 min, versioning enabled) | `live-captures/2026-05-20/prod-storage.json` |
| Staging Storage account | `az storage account show -n nzilacanadastore` | ✅ VERIFIED — 2026-05-21 (separate account) | `live-captures/2026-05-20/staging-storage.json` |

### B4. Monitoring

| Check | Action | Status | Evidence file |
|---|---|---|---|
| Log Analytics workspace | `az monitor log-analytics workspace list -g nzila-canada-prod-rg` | ✅ VERIFIED — 2026-05-21 (nzila-canada-prod-law, 90-day retention) | `live-captures/2026-05-20/prod-resources.json` |
| Alert rules active | `az monitor scheduled-query list -g nzila-canada-prod-rg` | ✅ VERIFIED — 2026-05-21 (3 rules enabled: health-503-sustained sev1, high-error-rate sev2, governance-events-zero sev2) | `live-captures/2026-05-20/prod-resources.json` |
| Action group wired | `az monitor action-group list -g nzila-canada-prod-rg` | ✅ VERIFIED — 2026-05-21 (ue-prod-ops-alerts) | `live-captures/2026-05-20/prod-resources.json` |
| Front Door + WAF (prod hardening) | `az afd profile show -g nzila-canada-prod-rg` | ✅ VERIFIED — 2026-05-21 (nzila-ue-afd-prod profile + nzilauewafdprod WAF policy) | `live-captures/2026-05-20/prod-resources.json` |
| Dedicated Azure Monitor workbook export | Portal export | ⏳ DEFERRED — follow-up SRE task; alert rules + LAW evidence captured above | — |

### B5. Restore drill

| Check | Runbook | Status | Evidence file |
|---|---|---|---|
| Backup configuration | `az postgres flexible-server show ... --query backup` | ✅ VERIFIED — 2026-05-21 (30-day retention, geo-redundant ENABLED, PG 16) | `live-captures/2026-05-20/prod-db.json` |
| Live restore drill executed | `docs/union-eyes/dr/restore-drill-runbook.md` + Azure CLI PITR | ✅ VERIFIED — 2026-05-21 (RESTORE-DRILL-2026-05-20-001: PITR to 2026-05-20T23:00:00Z, ~6 min RTO, `nzila_os_prod` restored, cleanup complete) | `reports/runtime/live-captures/2026-05-20/restore-drill/restore-drill-manifest.json` |
| RTO confirmed | < 4 hours per SLA | ✅ VERIFIED — 2026-05-21 (measured ~6 minutes provision + verification on D2s_v3 / 256 GB / 10 days WAL) | `restore-drill/03-restored-server.json` |

---

## How to Update This Document

After completing each live evidence capture:

1. Store evidence file in `reports/runtime/live-captures/YYYY-MM-DD/`
2. Update the row: change `⬜ PENDING` to `✅ VERIFIED — YYYY-MM-DD` and fill in the evidence file name
3. Update the matching field in the dated manifest (`live-evidence-manifest.YYYY-MM-DD.json`)
4. Update `platform-runtime-truth-latest.json` `liveEvidenceVerifiedAt` timestamp
5. Commit to main via standard PR process

---

*This document bridges the gap between code-verified security controls (Section A) and live operational proof (Section B). Section A is complete. **Section B is now FULLY VERIFIED 2026-05-21** for both production and staging environments: live PITR restore drill executed (RESTORE-DRILL-001 closed 2026-05-21), staging CrashLoopBackOff resolved (STAGING-UP-001 closed 2026-05-21 — missing secrets injected from staging KV, /api/health and /api/ready return HTTP 200). One remaining deferred item (dedicated workbook export) is cosmetic and not pilot-blocking.*
