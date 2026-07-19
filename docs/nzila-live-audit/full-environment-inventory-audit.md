# Full Environment Inventory Audit

Authority: docs/nzila-finalization/master-finalization-index.md
As of 2026-07-03. Verified via Azure CLI + live HTTPS smoke + repo gates.

LIVE Azure inventory (az verified): dedicated per-tier resource groups and Container App environments — nzila-canada-{staging,demo,pilot,prod}-{rg,env}. Production env nzila-canada-prod-env hosts union-eyes-prod, web-prod, partners-prod (all digest-pinned). Dedicated prod DB nzila-os-union-eyes-prod-db (30d retention, geo-redundant, Zone-redundant HA) and Log Analytics nzila-canada-prod-law. Full redacted inventory: proof-artifacts/finalization/azure-resource-inventory-redacted.json.
