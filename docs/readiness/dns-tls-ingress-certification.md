# DNS / TLS / Ingress Certification (Phase 5)

- **As of:** 2026-07-03 · verified via Azure CLI + live HTTPS probe.

## Verdict

```
DNS / TLS / INGRESS: PROVEN  (union-eyes production)
```

## Evidence

- `nzila-os-union-eyes-prod` (prod env) ingress: `external: true`, managed TLS,
  custom domain **`app.unioneyes.app`**, platform FQDN `…bluesand-c3ac2d8c.canadacentral.azurecontainerapps.io`.
- Live probe: `curl -I https://app.unioneyes.app/api/health` → **HTTP 200**, TLS
  verify success (`ssl_verify_result=0`).
- Production domain maps to the production container app (prod env), not staging.

## Scope / follow-ups

- **web / partners (DNS TLS PARTIAL):** `www.nzilaventures.com` (200) and
  `partners.nzilaventures.com` (200) have valid TLS, **but the domains are bound
  (SniEnabled) onto the STAGING container apps** (`nzila-os-web` /
  `nzila-os-partners` in `nzila-canada-staging-rg`), not an isolated production
  runtime. Production domains on staging runtime = **DNS TLS PARTIAL** (masquerade).
  See [platform-production-runtime-inventory.md](platform-production-runtime-inventory.md).
- Internal apps (`console`, `control-plane`) use `ingress: restricted`; not public production.
- Full DNS-zone enumeration not captured; Cloudflare-fronted zones managed outside this subscription per ops notes.
