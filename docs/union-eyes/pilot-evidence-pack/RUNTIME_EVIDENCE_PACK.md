# Union Eyes — Runtime Evidence Pack

**Status:** Section A ✅ COMPLETE (code-verified) / Section B ⏳ PENDING (requires Azure access)  
**Last updated:** 2026-05-14  
**Source of truth:** `reports/runtime/platform-runtime-truth-latest.json` (code/config posture)  
**Supersedes:** All versions referencing DEGRADED or EXC-001 open  
**Live-evidence dependencies:** All of Section B — execute LIVE_EVIDENCE_CAPTURE_RUNBOOK.md to complete

---

> **Three-layer distinction:**
> - **Code/config posture:** HEALTHY (this document, Section A)
> - **Live operational proof:** PENDING (Section B — requires Azure access)
> - **Production expansion:** CONDITIONAL (requires live proof + security sign-off)

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
| DB import violations | ✅ 0 | CI `governance:check-db-imports` |
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
| `pnpm governance:check-db-imports` | ✅ 0 violations |
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
| Prod health endpoint | `curl -sf https://<prod-url>/api/health \| jq` | ⬜ PENDING | `smoke-test-prod-YYYYMMDD.json` |
| Prod readiness endpoint | `curl -sf https://<prod-url>/api/readiness \| jq` | ⬜ PENDING | `smoke-test-prod-YYYYMMDD.json` |
| Union Eyes health | `curl -sf https://<ue-url>/api/health \| jq` | ⬜ PENDING | `ue-smoke-test-YYYYMMDD.json` |

### B2. Azure resource group confirmation

| Check | Command | Status | Evidence file |
|---|---|---|---|
| Prod RG exists | `az group show -n nzila-canada-prod-rg --query name` | ⬜ PENDING | `azure-rg-proof-YYYYMMDD.txt` |
| Staging RG exists | `az group show -n nzila-canada-staging-rg --query name` | ⬜ PENDING | `azure-rg-proof-YYYYMMDD.txt` |
| No shared container apps | `az containerapp list -g nzila-canada-prod-rg --query "[].name"` | ⬜ PENDING | `azure-rg-proof-YYYYMMDD.txt` |
| pnpm proof ingest | `pnpm proof:ingest:azure` | ⬜ PENDING | `azure-runtime-latest.json` |

### B3. Key Vault separation

| Check | Command | Status | Evidence file |
|---|---|---|---|
| Prod Key Vault name | `az keyvault list -g nzila-canada-prod-rg --query "[].name"` | ⬜ PENDING | `keyvault-separation-YYYYMMDD.txt` |
| Prod KV ≠ staging KV | Manual comparison | ⬜ PENDING | `keyvault-separation-YYYYMMDD.txt` |

### B4. Monitoring

| Check | Action | Status | Evidence file |
|---|---|---|---|
| Azure Monitor workbook export | Portal → Monitor → Workbooks → Union Eyes → Export | ⬜ PENDING | `monitor-workbook-YYYYMMDD.json` |
| Alert rule existence | `az monitor alert list -g nzila-canada-prod-rg` | ⬜ PENDING | `alert-rules-YYYYMMDD.json` |

### B5. Restore drill

| Check | Runbook | Status | Evidence file |
|---|---|---|---|
| Restore drill completed | `docs/union-eyes/dr/restore-drill-runbook.md` | ⬜ PENDING | `restore-drill-YYYYMMDD.md` |
| RTO confirmed | < 4 hours per SLA | ⬜ PENDING | `restore-drill-YYYYMMDD.md` |

---

## How to Update This Document

After completing each live evidence capture:

1. Store evidence file in `reports/runtime/`
2. Update the row: change `⬜ PENDING` to `✅ DONE — YYYYMMDD` and fill in the evidence file name
3. Run `pnpm proof:ingest:azure` to refresh `azure-runtime-latest.json`
4. Update `platform-runtime-truth-latest.json` `reportFreshness.freshness` timestamp
5. Commit to main via standard PR process

---

*This document bridges the gap between code-verified security controls (Section A) and live operational proof (Section B). Section A is complete. Section B is required before expanding beyond the controlled pilot.*
