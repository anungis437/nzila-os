# Platform Production Runtime Inventory (Phase 5C — Option B)

- **As of:** 2026-07-03 · verified via Azure CLI.
- **Option B target apps:** `union-eyes`, `web`, `partners`.
- **Operator permission:** `support@onelabtech.com` holds `Owner` + `User Access
  Administrator` at subscription scope (write is *permitted*).

## Per-app runtime verdict

| App | Verdict | Prod container app | Env | Production domain (live) |
| --- | --- | --- | --- | --- |
| **union-eyes** | **PRODUCTION GRADUATED** | `nzila-os-union-eyes-prod` | `nzila-canada-prod-env` | app.unioneyes.app → 200 (digest-pinned) |
| **web** | **PRODUCTION GRADUATED** | `nzila-os-web-prod` | `nzila-canada-prod-env` | www.nzilaventures.com → 200, valid TLS |
| **partners** | **PRODUCTION GRADUATED** | `nzila-os-partners-prod` | `nzila-canada-prod-env` | partners.nzilaventures.com → 200 + /api/ready 200 |

> **Domain cutover COMPLETE (Phase 5C).** `www.nzilaventures.com` and
> `partners.nzilaventures.com` were repointed in Cloudflare to the prod app FQDNs,
> unbound from the staging apps, and bound to the prod apps with **managed certs
> (Succeeded)**. Apex `nzilaventures.com` managed cert is still `Pending`
> (TXT-validated; self-completes, typically redirects to www).

## What was built (real Azure writes, verified live)

- **Prod images (BuildKit, linux/amd64, `NEXT_PUBLIC_APP_ENV=production`)** pushed to ACR:
  - `nzila/web@sha256:ec68587d798001afd2a3451e30ed28a27b806f09834fa800cbc9df46cb3f9b1f`
  - `nzila/partners@sha256:d49e064aa21b79597bd8dc574ad728c3303e050f8c58261c3f2bd34816a11f4f`
- **`nzila-os-web-prod`** in `nzila-canada-prod-env`: digest-pinned, external ingress,
  fresh prod `AUTH_SECRET`, Azure AD auth, **no DB** (web has no DB runtime usage). Live 200.
- **`nzila-os-partners-prod`** in `nzila-canada-prod-env`: digest-pinned, external
  ingress, connected to the **prod platform DB** (`nzila-os-union-eyes-prod-db` /
  `nzila_os_prod` — the isolated prod server; partners tables exist in the shared
  platform schema). `/api/ready` → 200 (DB-backed). Live 200.
- **Secret hygiene fix:** partners' `AZURE_STORAGE_ACCOUNT_KEY` was a **plaintext env
  value** on staging; on partners-prod it is a **secret reference**. ⚠️ The exposed
  staging key **must be rotated** (`az storage account keys renew`) and staging updated.

## Remaining (post-cutover)

- **Apex `nzilaventures.com`** managed cert `Pending` — LOW, non-blocking (www is
  canonical and live); self-completes. Re-run
  `az containerapp hostname bind -n nzila-os-web-prod -g nzila-canada-prod-rg --hostname nzilaventures.com --environment nzila-canada-prod-env --validation-method TXT` once `Succeeded`.
- **CLOSED — `nzilacanadastore` storage key** rotated by owner; partners-prod secret
  refreshed + restarted; staging partners plaintext moved to a secret reference — no
  plaintext key remains on either app.
- Prod metric alert rules for web/partners (action group `ue-prod-ops-alerts` exists). — LOW
- **CLOSED — Cloudflare API token** rotated/revoked by owner; repo scan confirms no
  token value in tracked files.
