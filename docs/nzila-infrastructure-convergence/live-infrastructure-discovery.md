# Live Infrastructure Discovery

Authority: docs/nzila-finalization/master-finalization-index.md
As of 2026-07-03. Verified via Azure CLI + live HTTPS smoke + repo gates.

LIVE az discovery: per-tier RGs+CA-envs nzila-canada-{staging,demo,pilot,prod}-{rg,env}; prod-env hosts union-eyes-prod, web-prod, partners-prod (digest-pinned); prod DB nzila-os-union-eyes-prod-db; Log Analytics nzila-canada-prod-law; ACR nzilacanadaacr. Full inventory: proof-artifacts/finalization/azure-resource-inventory-redacted.json.
