# Agrimo — Front-Door / Django Authority Boundary Report

**Sprint**: Client Launch Readiness (P1 follow-up) | **Date**: 2026-05-04 | **Auditor**: Nzila OS Automation

---

## Executive Summary

Agrimo is a Next.js 15 front-door app (`apps/agrimo`) backed by a Django sidecar (`apps/agrimo/backend`) that owns the **canonical jurisdiction-compliance authority**. Two structural P0 risks were resolved previously and are retained:

1. **Silent stale-policy fallback** — the Django `JurisdictionConfig` loader silently fell back to embedded `_HARDCODED_POLICIES` (KE/UG/NG only, no version) when the shared `@nzila/platform-jurisdiction-compliance` artifact was missing. In production/staging this masked compliance regressions. **Fixed**: the loader now `raise RuntimeError` in `production`/`staging` (env from `AGRIMO_ENV` / `NODE_ENV` / `DJANGO_ENV`) and only permits the hardcoded fallback in development.
2. **Runtime invisibility in proof artifacts** — fixed previously by inventory-driven fallback endpoint generation for blocked canonical routes.

P1 follow-up stabilization confirms canonical custom domain remains blocked and keeps fallback evidence advisory:

- `staging-agrimo.nzilaventures.com` publishes a CNAME but has no reachable A/AAAA data in probe context.
- Azure Container Apps shows no Agrimo custom domain binding (`customDomains: []`).
- Canonical staging remains `routing.staging = "blocked"` with `stagingDnsStatus = "pending-manual-cloudflare"`.
- Fallback ACA endpoint remains monitored as secondary advisory evidence.

**Overall Front-Door Readiness**: PARTIAL — front-door auth and edge boundaries are sound; back-end authority is fail-loud; canonical staging remains DNS/domain-blocked and fallback proof remains advisory. This is not a production or partner-demo readiness claim.

---

## 1. Authority Boundary

| Concern | Authority | Notes |
|---|---|---|
| Session / identity | Next.js front-door (`@nzila/platform-auth`) | Email-password default, Entra fallback. Same primitives as the rest of the platform. |
| Org membership / RBAC | Next.js front-door (`apps/agrimo/lib`, `proxy.ts`) | `publicPaths = ['/', '/sign-in', '/sign-up', '/api/webhooks', '/api/health', '/api/auth']` — health endpoint is intentionally public for ACA probes. |
| Jurisdiction compliance data (taxes, labor law, pension, exam boards) | **Django backend** (`apps/agrimo/backend/compliance/jurisdiction_loader.py`) | Loads from `@nzila/platform-jurisdiction-compliance/src/policies.json`, never the Next.js BFF. |
| Curriculum / exam evaluation | Django backend | Mirrors compliance authority; uses the same `JurisdictionConfig.get_policy()` API. |
| Edge runtime (`proxy.ts`) | Front-door only | **Never** imports `@nzila/platform-auth/entra/*` (would trigger `Native module not found: node:crypto` in ACA edge). |

### Edge Runtime Constraint (re-asserted)

Agrimo's `apps/agrimo/proxy.ts` may run in the edge runtime. It MUST keep auth interactions limited to lightweight cookie/JWT presence checks and MUST NOT import `@nzila/platform-auth/entra/*`. Heavy auth logic belongs in route handlers (`app/api/...`) running on Node.

---

## 2. Jurisdiction Loader — Before / After

**Before** (`_load_policies_data` fallback branch):

```python
# Fallback: return hardcoded policies
logger.warning("Using hardcoded policies (compiled JS module not found)")
cls._policies_data = _HARDCODED_POLICIES
return cls._policies_data
```

A missing `policies.json` in production produced only a `WARNING` log line, then served stale embedded data covering only KE/UG/NG with frozen tax/wage values. Compliance regressions (e.g. NG minimum wage update) would never surface.

**After**:

```python
env = (os.getenv("AGRIMO_ENV") or os.getenv("NODE_ENV") or os.getenv("DJANGO_ENV") or "development").lower()
if env in ("production", "staging"):
    raise RuntimeError(
        f"Jurisdiction policies file not found in {env}. "
        "Build @nzila/platform-jurisdiction-compliance or set JURISDICTION_POLICIES_PATH. "
        "Refusing to fall back to embedded hardcoded policies. "
        f"Searched: {searched}"
    )
logger.warning("Using hardcoded policies (compiled JS module not found) — DEV ONLY")
cls._policies_data = _HARDCODED_POLICIES
```

### Operational Implication

Deployments must ensure one of the following resolves before Django boots:

- `packages/platform-jurisdiction-compliance/src/policies.json` is present in the image (monorepo build), **or**
- `node_modules/@nzila/platform-jurisdiction-compliance/dist/policies.json` is installed (standalone build), **or**
- `JURISDICTION_POLICIES_PATH` env var points at a valid JSON artifact.

If none resolve and `AGRIMO_ENV`/`NODE_ENV`/`DJANGO_ENV` is `production` or `staging`, the Django process now **crashes loud** instead of serving stale data. Container probes will report unhealthy and the deployment will be blocked by the rollout gate.

---

## 3. Runtime Health — Canonical Staging + Fallback Advisory

### Inventory Entry (Current)

```jsonc
"agrimo": {
  "tier": "tier-2",
  "releaseStatus": "staging-only",
  "track": "pilot",
  "prodPromotionEligible": false,
  "containerAppName": "nzila-os-agrimo",
  "stagingDeployed": true,
  "stagingDnsStatus": "pending-manual-cloudflare",
  "routing": {
    "staging": "blocked",
    "stagingFallback": "https://nzila-os-agrimo.jollydune-88c1e97f.canadacentral.azurecontainerapps.io",
    "production": "blocked",
    "productionState": "reserved-not-yet-promoted",
    "healthPath": "/api/health",
    "readyPath": "/api/ready",
    "ingress": "external",
    "tls": "managed"
  }
}
```

### Generator Behavior

`scripts/proof/check-health.ts` emits canonical and fallback routes when both are inventory-valid. Agrimo currently remains fallback-only because canonical staging is blocked in inventory.

```ts
const canonicalRoute = normalizeRoute(app?.routing?.[env])
const fallbackRoute = normalizeRoute(app?.routing?.[fallbackKey])
if (canonicalRoute) routes.push({ route: canonicalRoute, usedFallback: false })
if (fallbackRoute && fallbackRoute !== canonicalRoute) {
  routes.push({ route: fallbackRoute, usedFallback: true })
}
```

Canonical staging routes become policy-critical only when staging DNS status is explicitly live (`resolved`, `active`, `wired`, `healthy`, `live`). Fallback routes remain advisory.

### Resulting Endpoint Schema

```ts
For Agrimo in staging (current blocked canonical posture), fallback endpoints are emitted:

| Name | URL | Path | policyCritical |
|---|---|---|---|
| `staging:agrimo:fallback:root` | `https://nzila-os-agrimo.jollydune-88c1e97f.canadacentral.azurecontainerapps.io` | `/` | `false` |
| `staging:agrimo:fallback:health` | `https://nzila-os-agrimo.jollydune-88c1e97f.canadacentral.azurecontainerapps.io` | `/api/health` | `false` |
| `staging:agrimo:fallback:ready` | `https://nzila-os-agrimo.jollydune-88c1e97f.canadacentral.azurecontainerapps.io` | `/api/ready` | `false` |

Fallback `policyCritical: false` remains intentional — fallback evidence is advisory and cannot be treated as canonical staging readiness on its own.

---

## 4. Public Paths (Edge)

`apps/agrimo/proxy.ts` line 13:

```ts
publicPaths = ['/', '/sign-in', '/sign-up', '/api/webhooks', '/api/health', '/api/auth']
```

`/api/health` is intentionally unauthenticated for ACA liveness/readiness probes and for the inventory-driven runtime health snapshot. All other routes default to authenticated.

---

## 5. Verification Steps

1. `pnpm -F @nzila/agrimo typecheck` — front-door types clean.
2. `npx tsx scripts/proof/check-health.ts` (with `HEALTH_LOCAL_SKIP=true` in offline mode) — generated snapshot includes both canonical and fallback Agrimo endpoints with canonical marked policy-critical.
3. Live DNS probe indicates canonical CNAME exists but no reachable A/AAAA data for probe context; canonical staging remains blocked.
4. Azure probe (`az containerapp hostname list`) returns no custom domains for Agrimo container app.
5. Smoke probe of Django backend with `JURISDICTION_POLICIES_PATH` unset and `AGRIMO_ENV=staging` — Django boot fails fast with `RuntimeError`.

---

## 6. Outstanding

- Production remains blocked (`routing.production = "blocked"`); no production policy-critical probes are asserted for Agrimo at this stage.
- Keep fallback monitoring advisory-only as long as it is a non-canonical path.
- Continue fail-loud authority posture in Django loader and keep front-door readiness checks tied to authority availability.
