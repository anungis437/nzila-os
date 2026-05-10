# 02 — Authoritative URL & Domain Audit

**Authority:** Canonical URL inventory across all Nzila OS apps and tiers.
**Source anchors:**
[governance/release/domain-routing-registry.json](../../governance/release/domain-routing-registry.json),
[.github/workflows/gitops-deploy.yml](../../.github/workflows/gitops-deploy.yml),
[apps/console/lib/nav-config.ts](../../apps/console/lib/nav-config.ts).

---

## 1. Canonical Domain Authority

| Zone                 | Owner               | DNS                        | TLS                           | Token scope                          |
|----------------------|---------------------|----------------------------|-------------------------------|--------------------------------------|
| `nzilaventures.com`  | Nzila               | Cloudflare (manual zone)   | ACA-managed certs             | **No automated DNS_API_TOKEN**       |
| `unioneyes.app`      | Nzila               | Cloudflare (token-managed) | ACA-managed certs             | `DNS_API_TOKEN` in KV (UE-only)      |
| `nzila.ai`           | NOT OWNED           | n/a                        | n/a                           | Must NOT be used as an active route  |

**Source:** `governance/release/domain-routing-registry.json` lines 1–18.

---

## 2. Canonical URL Registry

### 2.1 Public web tier

| App        | Staging (custom)                  | Staging (ACA fallback)                                                  | Production                       | Verdict       |
|------------|-----------------------------------|-------------------------------------------------------------------------|----------------------------------|---------------|
| web        | `staging.nzilaventures.com`       | `nzila-os-web.jollydune-88c1e97f.canadacentral.azurecontainerapps.io`   | `www.nzilaventures.com`          | LIVE (prod)   |
| union-eyes | `staging.unioneyes.app`           | `nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io` | `app.unioneyes.app`         | LIVE (prod)   |
| partners   | `staging-partners.nzilaventures.com` | `nzila-os-partners.jollydune-88c1e97f.canadacentral.azurecontainerapps.io` | `partners.nzilaventures.com` | PARTIAL       |
| zonga      | `staging-zonga.nzilaventures.com` | `nzila-os-zonga.jollydune-88c1e97f.canadacentral.azurecontainerapps.io` | `zonga.nzilaventures.com`        | TLS-PROVISIONING |

### 2.2 Operator/console tier

| App           | Staging (custom)                  | Staging (ACA fallback)                                                  | Production                       | Verdict      |
|---------------|-----------------------------------|-------------------------------------------------------------------------|----------------------------------|--------------|
| console       | `staging-console.nzilaventures.com` | `nzila-os-console.jollydune-88c1e97f.canadacentral.azurecontainerapps.io` | `console.nzilaventures.com`  | LIVE (prod)  |
| control-plane | `staging-control.nzilaventures.com` | `nzila-os-control-plane.jollydune-88c1e97f.canadacentral.azurecontainerapps.io` | `control.nzilaventures.com` | RESERVED  |
| platform-admin| `staging-admin.nzilaventures.com` | `nzila-os-platform-admin.jollydune-88c1e97f.canadacentral.azurecontainerapps.io` | `admin.nzilaventures.com`   | RESERVED (release frozen) |

### 2.3 Vertical apps

| App         | Staging (custom)                  | Staging (ACA fallback)                                                  | Production                       | Verdict        |
|-------------|-----------------------------------|-------------------------------------------------------------------------|----------------------------------|----------------|
| flow        | `staging-flow.nzilaventures.com`  | `nzila-os-flow.jollydune-88c1e97f.canadacentral.azurecontainerapps.io`  | `flow.nzilaventures.com`         | STAGING-ONLY   |
| cfo         | `staging-cfo.nzilaventures.com`   | `nzila-os-cfo.jollydune-88c1e97f.canadacentral.azurecontainerapps.io`   | `cfo.nzilaventures.com`          | STAGING-ONLY   |
| abr (FairCase) | `staging-faircase.nzilaventures.com` | `nzila-os-abr.jollydune-88c1e97f.canadacentral.azurecontainerapps.io` | `faircase.nzilaventures.com` | BLOCKED        |
| agrimo      | `staging-agrimo.nzilaventures.com`| `nzila-os-agrimo.jollydune-88c1e97f.canadacentral.azurecontainerapps.io`| `agrimo.nzilaventures.com`       | STAGING-ONLY   |
| cora        | `staging-cora.nzilaventures.com`  | `nzila-os-cora.jollydune-88c1e97f.canadacentral.azurecontainerapps.io`  | `cora.nzilaventures.com`         | RESERVED       |
| trade       | `staging-trade.nzilaventures.com` | `nzila-os-trade.jollydune-88c1e97f.canadacentral.azurecontainerapps.io` | `trade.nzilaventures.com`        | RESERVED       |
| mobility    | `staging-mobility.nzilaventures.com` | `nzila-os-mobility.jollydune-88c1e97f.canadacentral.azurecontainerapps.io` | `mobility.nzilaventures.com` | STAGING-ONLY |

### 2.4 API tier

| Service          | Staging (custom)                | Staging (ACA fallback)                                                       | Production                | Verdict      |
|------------------|---------------------------------|------------------------------------------------------------------------------|---------------------------|--------------|
| orchestrator-api | `staging-api.nzilaventures.com` | `nzila-os-orchestrator-api.jollydune-88c1e97f.canadacentral.azurecontainerapps.io` | `api.nzilaventures.com` | STAGING-ONLY |

---

## 3. Cross-App Navigation URL Bake-In

Per [.github/workflows/gitops-deploy.yml](../../.github/workflows/gitops-deploy.yml#L165-L175),
the following `NEXT_PUBLIC_*` URLs are **baked into Docker images at build time**:

| Variable                              | Baked value                                                              |
|---------------------------------------|--------------------------------------------------------------------------|
| `NEXT_PUBLIC_WEB_URL`                 | `https://nzilaventures.com`                                              |
| `NEXT_PUBLIC_CONSOLE_URL`             | `https://console.nzilaventures.com`                                      |
| `NEXT_PUBLIC_PARTNERS_URL`            | `https://partners.nzilaventures.com`                                     |
| `NEXT_PUBLIC_UNION_EYES_URL`          | `https://nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io` |
| `NEXT_PUBLIC_ABR_URL`                 | `https://nzila-os-abr.jollydune-88c1e97f.canadacentral.azurecontainerapps.io` |
| `NEXT_PUBLIC_CFO_URL`                 | `https://nzila-os-cfo.jollydune-88c1e97f.canadacentral.azurecontainerapps.io` |
| `NEXT_PUBLIC_CONTROL_PLANE_URL`       | `https://nzila-os-control-plane.jollydune-88c1e97f.canadacentral.azurecontainerapps.io` |
| `NEXT_PUBLIC_PLATFORM_ADMIN_URL`      | `https://nzila-os-platform-admin.jollydune-88c1e97f.canadacentral.azurecontainerapps.io` |
| `NEXT_PUBLIC_SITE_URL` (UE only)      | `https://unioneyes.app`                                                  |
| `NEXT_PUBLIC_APP_URL` (UE only)       | `https://app.unioneyes.app`                                              |

**Operational reality:** Console's "App Switcher" links to UE/ABR/CFO via the
ACA fallback domain even when those apps have custom domains. This is a
**STAGING-ONLY divergence** — to be reconciled when remaining custom domains
are bound.

---

## 4. Auth Callback URL Inventory

| App           | Provider                       | Callback URL                                                       | Verdict |
|---------------|--------------------------------|--------------------------------------------------------------------|---------|
| union-eyes    | `@nzila/platform-auth` (PG sessions) | `/api/auth/callback`                                          | LIVE    |
| union-eyes    | NextAuth + Entra (fallback)    | `/api/auth/callback/azure-ad`                                      | LIVE    |
| console       | NextAuth + Entra               | `/api/auth/callback/azure-ad`                                      | LIVE    |
| Entra App Reg | "Nzila OS Platform Auth"       | `localhost:3000-3004` + `https://staging.unioneyes.app/api/auth/callback/azure-ad` | LIVE |

**Entra App Registration anchor:**
- Client ID: `b7b0cb9a-110d-4bf4-baa7-d936d7450181`
- Tenant ID: `5082b8be-b04d-4a13-b61c-b6397670177b`
- Secret expires: ~April 2028 (2-year)
- Source: User memory (Azure AD admin verified 2026-04-XX)

---

## 5. Pending DNS Records — `MISSING`

The following CNAME records must be **manually** created in the Cloudflare
dashboard for `nzilaventures.com` (the `DNS_API_TOKEN` is scoped to
`unioneyes.app` only). Per
[domain-routing-registry.json](../../governance/release/domain-routing-registry.json#L271-L296):

```
staging          → nzila-os-web.jollydune-88c1e97f.canadacentral.azurecontainerapps.io
staging-console  → nzila-os-console.jollydune-88c1e97f.canadacentral.azurecontainerapps.io
control          → nzila-os-control-plane.jollydune-88c1e97f.canadacentral.azurecontainerapps.io
staging-control  → nzila-os-control-plane.jollydune-88c1e97f.canadacentral.azurecontainerapps.io
staging-partners → nzila-os-partners.jollydune-88c1e97f.canadacentral.azurecontainerapps.io
staging-zonga    → nzila-os-zonga.jollydune-88c1e97f.canadacentral.azurecontainerapps.io
admin            → nzila-os-platform-admin...
staging-admin    → nzila-os-platform-admin...
flow             → nzila-os-flow...
staging-flow     → nzila-os-flow...
faircase         → nzila-os-abr...
staging-faircase → nzila-os-abr...
cfo              → nzila-os-cfo...
staging-cfo      → nzila-os-cfo...
api              → nzila-os-orchestrator-api...
staging-api      → nzila-os-orchestrator-api...
agrimo, staging-agrimo, cora, staging-cora, trade, staging-trade, mobility, staging-mobility — all MISSING
```

**Total pending:** 24 CNAME records.
**Owner:** `team-platform-admin@nzilaventures.com`
**Ticket:** Tracked in this audit as the canonical "Pending DNS" backlog.

---

## 6. Findings

### 6.1 Reachability

| Surface                                                              | Status       | Evidence                                          |
|----------------------------------------------------------------------|--------------|---------------------------------------------------|
| `https://nzila-os-web.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/` | 200 (LIVE) | Memory: deployed Container Apps verified 2026-04-24 |
| `https://nzila-os-console.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/` | 200 (LIVE) | Memory: deployed Container Apps verified           |
| `https://nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/api/auth_core/health/` | 200 (LIVE) | Memory: Django sidecar health endpoint |
| `https://nzila-os-zonga.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/` | 200 (LIVE) | Memory: deployed Container Apps verified           |
| `https://nzila-os-partners.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/` | **404 (PARTIAL)** | Memory: known root-route gap                  |

> **Live traversal disclaimer:** This audit does not perform real-time HTTP
> probes from CI (network egress unavailable). Status is based on the most
> recent verified state recorded in operational memory. The validator script
> (§10) checks document existence; live URL traversal is the operator's
> responsibility via `pnpm validate:web:readiness` and `pnpm validate:console:readiness`.

### 6.2 TLS

All ACA fallback URLs use ACA-managed certs (LE chain). All custom domains
that are `acaBinding: active` use ACA-managed certs. `zonga.nzilaventures.com`
is in `tls-cert-provisioning` — `PARTIAL`.

### 6.3 Redirect & Locale Routing

UE and Console both implement `[locale]` segment routing (`en`, `fr`).
- Default locale: `en`
- Auto-redirect: `/` → `/{locale}/` based on `Accept-Language` header
- Implementation: `apps/{union-eyes,console}/middleware.ts` + `proxy.ts`

### 6.4 Broken-Link Findings

| Link                                                              | Status | Source                              |
|-------------------------------------------------------------------|--------|-------------------------------------|
| `https://nzila.ai/*`                                              | NOT OWNED | Must not appear in any product code |
| `https://nzila-os-partners.../`                                   | 404    | Partners root route                 |

### 6.5 Orphaned URL Findings

None detected at canonical-registry level. All 16 known apps are
either in the registry or in the deploy matrix.

### 6.6 Staging/Prod Divergence

| Issue                                                                 | Severity | Plan                                |
|-----------------------------------------------------------------------|----------|-------------------------------------|
| Console links to UE via ACA fallback even when UE prod custom domain bound | Low | Promote `NEXT_PUBLIC_UNION_EYES_URL=https://app.unioneyes.app` |
| `NEXT_PUBLIC_ABR_URL` baked to ACA fallback while `abr` is BLOCKED    | Medium | Hide ABR launcher in Console until release unblocks |
| 24 pending CNAME records prevent prod custom-domain consolidation     | Medium  | Manual Cloudflare creation per §5   |

---

## 7. Authoritative Source Statement

For every URL in any product surface, the authoritative source is — in priority
order:

1. `governance/release/domain-routing-registry.json`
2. `.github/workflows/gitops-deploy.yml` (build-time bake-in)
3. `apps/console/lib/nav-config.ts` `appLinks` (runtime fallback)
4. Per-app `.env.local` (developer-only)

Any URL outside this chain is **non-canonical** and must be reconciled.

---

**Verdict for §2:** URL inventory is **complete and honest**. The most material
gap is 24 pending Cloudflare CNAME records for `nzilaventures.com`; until then,
custom-domain prod consolidation is `PARTIAL`.
