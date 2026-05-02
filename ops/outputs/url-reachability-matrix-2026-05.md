# URL Reachability Matrix — May 2026

**Generated:** 2026-05-01  
**Period:** 2026-05  
**Gate Score:** 100/100 Grade A  
**Health Source:** `reports/runtime/health-latest.json` (17 endpoints, 0 failures)

---

## Production URLs

| App | URL | HTTP Status | TLS | DNS Status | Release Status |
|-----|-----|-------------|-----|------------|----------------|
| web | https://www.nzilaventures.com | 200 ✓ | Managed ✓ | active | prod-approved |
| console | https://console.nzilaventures.com | 200 ✓ | Managed ✓ | active | internal-only |
| control-plane | https://control.nzilaventures.com | 200 ✓ | Managed ✓ | active | internal-only |
| partners | https://partners.nzilaventures.com | 200 ✓ | Managed ✓ | active | prod-approved |
| union-eyes | https://app.unioneyes.app | 200 ✓ | Managed ✓ | active | prod-approved |
| union-eyes (health) | https://app.unioneyes.app/api/auth_core/health/ | 200 ✓ | Managed ✓ | active | prod-approved |
| faircase (abr) | https://faircase.nzilaventures.com | — BLOCKED | — | reserved-not-yet-promoted | blocked |
| flow | https://flow.nzilaventures.com | — BLOCKED | — | reserved-not-yet-promoted | staging-only |
| zonga | https://zonga.nzilaventures.com | — RESERVED | Provisioning | reserved-tls-pending | staging-only |
| cfo | https://cfo.nzilaventures.com | — BLOCKED | — | reserved-not-yet-promoted | staging-only |
| agrimo | https://agrimo.nzilaventures.com | — BLOCKED | — | reserved-not-yet-promoted | staging-only |
| cora | https://cora.nzilaventures.com | — BLOCKED | — | reserved-not-yet-promoted | incubating |
| trade | https://trade.nzilaventures.com | — BLOCKED | — | reserved-not-yet-promoted | incubating |
| mobility | https://mobility.nzilaventures.com | — BLOCKED | — | reserved-not-yet-promoted | staging-only |
| orchestrator-api | https://api.nzilaventures.com | — BLOCKED | — | reserved-not-yet-promoted | staging-only |

**Production summary:** 6 URLs live and healthy / 9 reserved/blocked pending promotion criteria

---

## Staging URLs

| App | URL | HTTP Status | TLS | DNS Status | Notes |
|-----|-----|-------------|-----|------------|-------|
| union-eyes | https://staging.unioneyes.app | 200 ✓ | Managed ✓ | active | health check passes |
| union-eyes (health) | https://staging.unioneyes.app/api/auth_core/health/ | 200 ✓ | Managed ✓ | active | health check passes |
| flow (root) | https://nzila-os-flow.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | 200 ✓ | ACA Default ✓ | active (fallback URL) | staging DNS pending |
| flow (health) | https://nzila-os-flow.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/api/health | 200 ✓ | ACA Default ✓ | active (fallback URL) | staging DNS pending |
| partners | https://staging-partners.nzilaventures.com | 200 ✓ | Managed ✓ | active | |
| console | https://staging-console.nzilaventures.com | 200 ✓ | Managed ✓ | active | |
| control-plane | https://staging-control.nzilaventures.com | 200 ✓ | Managed ✓ | active | |
| faircase (abr) | https://nzila-os-abr.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | — | ACA Default | staging DNS pending | blocked in staging; internalAlias=abr |
| zonga | https://nzila-os-zonga.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | 200 ✓ | ACA Default ✓ | active (fallback URL) | staging DNS pending |
| cfo | https://nzila-os-cfo.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | — | ACA Default | staging DNS pending | staging DNS pending |
| agrimo | https://nzila-os-agrimo.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | — | ACA Default | staging DNS pending | staging DNS pending |
| cora | https://nzila-os-cora.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | — | ACA Default | staging DNS pending | staging DNS pending |
| trade | https://nzila-os-trade.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | — | ACA Default | staging DNS pending | staging DNS pending |
| mobility | https://nzila-os-mobility.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | — | ACA Default | staging DNS pending | staging DNS pending |
| orchestrator-api | https://nzila-os-orchestrator-api.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | — | ACA Default | staging DNS pending | staging DNS pending |

**Staging summary:** 7 URLs healthy via health-check / 8 pending staging DNS setup

---

## DNS Pending Actions

The following staging custom DNS records need to be created in Cloudflare (manual action required):

| Record | CNAME Target | Owner |
|--------|-------------|-------|
| staging-faircase.nzilaventures.com | nzila-os-abr.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | platform-ops |
| staging-flow.nzilaventures.com | nzila-os-flow.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | platform-ops |
| staging-cfo.nzilaventures.com | nzila-os-cfo.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | platform-ops |
| staging-zonga.nzilaventures.com | nzila-os-zonga.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | platform-ops |
| staging-agrimo.nzilaventures.com | nzila-os-agrimo.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | platform-ops |
| staging-cora.nzilaventures.com | nzila-os-cora.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | platform-ops |
| staging-trade.nzilaventures.com | nzila-os-trade.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | platform-ops |
| staging-mobility.nzilaventures.com | nzila-os-mobility.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | platform-ops |
| staging-api.nzilaventures.com | nzila-os-orchestrator-api.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | platform-ops |

---

## Container App Environment

- **ACA Environment:** nzila-canada-staging-env  
- **Default domain:** `jollydune-88c1e97f.canadacentral.azurecontainerapps.io`  
- **Region:** Canada Central  
- **Resource Group:** nzila-canada-staging-rg  

---

## Gate Impact Assessment

| Status | Count | Gate Impact |
|--------|-------|-------------|
| Live + Healthy (production) | 6 | ✓ Counts toward gate score |
| Live + Healthy (staging) | 7 | Advisory only (no gate block) |
| Blocked/Reserved (no DNS) | 9 | Not monitored — no gate impact |

**All gate-relevant endpoints pass. Gate: 100/100 Grade A.**
