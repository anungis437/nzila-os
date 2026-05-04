# Agrimo — Front-Door / Django Authority Boundary Report

**Sprint**: Client Launch Readiness (P0-4) | **Date**: 2026-04-25 | **Auditor**: Nzila OS Automation

---

## Executive Summary

Agrimo is a Next.js 15 front-door app (`apps/agrimo`) backed by a Django sidecar (`apps/agrimo/backend`) that owns the **canonical jurisdiction-compliance authority**. Two structural P0 risks were resolved in this sweep:

1. **Silent stale-policy fallback** — the Django `JurisdictionConfig` loader silently fell back to embedded `_HARDCODED_POLICIES` (KE/UG/NG only, no version) when the shared `@nzila/platform-jurisdiction-compliance` artifact was missing. In production/staging this masked compliance regressions. **Fixed**: the loader now `raise RuntimeError` in `production`/`staging` (env from `AGRIMO_ENV` / `NODE_ENV` / `DJANGO_ENV`) and only permits the hardcoded fallback in development.
2. **Runtime invisibility in proof artifacts** — `governance/release/deployment-inventory.json` declares `routing.staging: "blocked"` for Agrimo (custom DNS not yet promoted) but provides a `stagingFallback` ACA URL that was being **ignored** by `scripts/proof/check-health.ts`. Agrimo therefore never appeared in `reports/runtime/health-latest.json`, leaving its deployed surface unobserved. **Fixed**: `buildInventoryEndpoints()` now consults `${env}Fallback` when the canonical route is blocked, emits `<env>:<app>:fallback:root` and `:health` endpoints, and marks them `policyCritical: false` (advisory — they are *not* the sanctioned promotion target).

**Overall Front-Door Readiness**: PARTIAL — front-door auth and edge boundaries are sound; back-end authority is now fail-loud; runtime monitoring covers the deployed (fallback) surface.

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

## 3. Runtime Health — Inventory + Fallback Routing

### Inventory Entry

```jsonc
"agrimo": {
  "tier": "tier-2",
  "releaseStatus": "staging-only",
  "track": "pilot",
  "prodPromotionEligible": false,
  "containerAppName": "nzila-os-agrimo",
  "stagingDeployed": true,
  "routing": {
    "staging": "blocked",
    "stagingFallback": "https://nzila-os-agrimo.jollydune-88c1e97f.canadacentral.azurecontainerapps.io",
    "production": "blocked",
    "productionState": "reserved-not-yet-promoted",
    "healthPath": "/api/health",
    "ingress": "external",
    "tls": "managed"
  }
}
```

### Generator Change

`scripts/proof/check-health.ts :: buildInventoryEndpoints()` previously did:

```ts
const route = normalizeRoute(app?.routing?.[env])
if (!route) continue   // "blocked" / "n/a" / "pilot-only" → skipped silently
```

This dropped Agrimo (and any other "deployed but DNS pending" app) from `reports/runtime/health-latest.json`. The deployed ACA surface was running unobserved.

The generator now consults `${env}Fallback` when the canonical route is blocked:

```ts
const canonicalRoute = normalizeRoute(app?.routing?.[env])
const fallbackKey = env === 'staging' ? 'stagingFallback' : 'productionFallback'
const fallbackRoute = normalizeRoute(app?.routing?.[fallbackKey])
const route = canonicalRoute ?? fallbackRoute
if (!route) continue
const usedFallback = !canonicalRoute && Boolean(fallbackRoute)
const baseName = `${env}:${appAlias}${usedFallback ? ':fallback' : ''}`
const policyCritical = env === 'production' && !usedFallback
```

### Resulting Endpoint Schema

For Agrimo in staging, two new endpoints are emitted:

| Name | URL | Path | policyCritical |
|---|---|---|---|
| `staging:agrimo:fallback:root` | `https://nzila-os-agrimo.jollydune-88c1e97f.canadacentral.azurecontainerapps.io` | `/` | `false` |
| `staging:agrimo:fallback:health` | `https://nzila-os-agrimo.jollydune-88c1e97f.canadacentral.azurecontainerapps.io` | `/api/health` | `false` |

`policyCritical: false` is intentional — these are **advisory** observations, not the sanctioned promotion target. A failure produces an advisory finding (not a blocker) so the gate does not regress while custom DNS is still pending.

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
2. `npx tsx scripts/proof/check-health.ts` (with `HEALTH_LOCAL_SKIP=true` in offline mode) — `reports/runtime/health-latest.json` now includes `staging:agrimo:fallback:root` and `staging:agrimo:fallback:health`.
3. Smoke probe of Django backend with `JURISDICTION_POLICIES_PATH` unset and `AGRIMO_ENV=staging` — Django boot fails fast with `RuntimeError` (expected, before fix would silently serve stale policies).

---

## 6. Outstanding (out of scope for P0-4)

- Promote `routing.staging` from `"blocked"` to the custom DNS URL once Front Door / DNS provisioning completes; the fallback emit then becomes a no-op (canonical route wins).
- Consider centralizing the `_HARDCODED_POLICIES` dev fallback into `@nzila/platform-jurisdiction-compliance` so the Django loader never carries embedded policy data of its own.
- Mirror this pattern (fail-loud back-end authority for compliance/clinical/financial data) in any other Django sidecars that ship with embedded fallbacks.
