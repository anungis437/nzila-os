# Production App Graduation Certification (Phase 5)

- **As of:** 2026-07-03 · verified via Azure CLI.
- Resolves the production-surface contradiction: which "prod-approved" apps have a
  real, isolated production runtime.

## Verdicts

| App | Verdict | Basis |
| --- | --- | --- |
| **union-eyes** | **PRODUCTION BLOCKED** (graduation-ready except finalization sign-off) | Isolated prod runtime, live, backed DB, OIDC, fail-closed config, **now digest-pinned** (Phase 5C). Remaining: finalization corpus / human GO + metric alert rules. |
| **web** | **PRODUCTION GRADUATED** | Isolated `nzila-os-web-prod` in prod-env, digest-pinned prod build, live on **www.nzilaventures.com** (200, valid TLS), no DB. |
| **partners** | **PRODUCTION GRADUATED** | Isolated `nzila-os-partners-prod` in prod-env, digest-pinned prod build, live on **partners.nzilaventures.com** (200, valid TLS), `/api/ready` 200 on prod platform DB. |
| console / control-plane | **INTERNAL ONLY** | Not production-promotable (Phase 4B). |

## union-eyes — evidence for/against graduation

**For (PROVEN via az):**
- Isolated runtime: `nzila-os-union-eyes-prod` in dedicated `nzila-canada-prod-rg` / `nzila-canada-prod-env`.
- Live: `app.unioneyes.app/api/health` → HTTP 200, valid TLS, external ingress.
- Dedicated prod DB: 30d retention, geo-redundant, Zone-redundant HA; restore-drill evidence.
- OIDC: environment-scoped federated credential (`gha-production`).
- Config fail-closed: `NODE_ENV=production`, `ENVIRONMENT_ISOLATION=full`, no `UE_ALLOW_DEFAULT_ORG`; secrets in ACA secret store.
- Dedicated prod Log Analytics (`nzila-canada-prod-law`).

**Against (blockers to graduation):**
1. **Running prod image is tag-pinned** (`nzila-os-union-eyes:6262e38…`), not `@sha256` digest.
2. **`UE_DEMO_PROFILE=cupe4373`** set in production — confirm this is the CUPE pilot-tenant feature profile (intended), not a synthetic/demo-data mode.
3. **No finalization corpus / human GO sign-off** (`final:go` red).
4. Pilot production exception is `PROVISIONAL_PENDING_REATTESTATION` (owner re-attestation due 2026-09-30).

## Decision (Option B — platform production readiness)

Option B declares `union-eyes`, `web`, `partners` as the production target. Live
Azure evidence shows only **union-eyes** has an isolated production runtime;
**web** and **partners** serve their production domains from **staging** runtime
(production-on-staging — see [platform-production-runtime-inventory.md](platform-production-runtime-inventory.md)).

Therefore the declared production set does **not** all have real isolated
production runtime. Per Option B rules, platform production readiness cannot be
claimed. All three remain `PRODUCTION BLOCKED`:
- union-eyes on digest-pinning + finalization sign-off,
- web/partners on isolated production runtime creation (governed, human-approval-required cutover).
