# Authoritative URL / Domain Audit

Authority: docs/nzila-finalization/master-finalization-index.md
As of 2026-07-03. Verified via Azure CLI + live HTTPS smoke + repo gates.

LIVE production domains (HTTPS smoke): app.unioneyes.app (union-eyes), www.nzilaventures.com (web), partners.nzilaventures.com (partners) — all 200 with valid managed TLS, served from the isolated prod apps. Apex nzilaventures.com managed cert is PARTIAL (Pending). Staging/demo/pilot domains remain STAGING-ONLY on their own envs. Source of truth: governance/release/domain-routing-registry.json.
