# Full Page Navigation Reality Audit

Authority: docs/nzila-finalization/master-finalization-index.md
As of 2026-07-03. Verified via Azure CLI + live HTTPS smoke + repo gates.

LIVE navigation smoke: production homepages return 200 (app.unioneyes.app, www.nzilaventures.com, partners.nzilaventures.com); partners /api/ready returns 200 against the prod platform DB. Internal surfaces (console, control-plane) are restricted-ingress and not publicly navigable. Broader per-route navigation coverage is PARTIAL (runtime smoke asserted; exhaustive crawl deferred).
