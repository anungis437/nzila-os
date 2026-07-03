# Full Database Migration Legitimacy

Authority: docs/nzila-finalization/master-finalization-index.md
As of 2026-07-03. Verified via Azure CLI + live HTTPS smoke + repo gates.

LIVE: partners-prod connects to the prod platform DB nzila_os_prod on nzila-os-union-eyes-prod-db (shared @nzila/db platform schema; partners tables present — /api/ready 200). web requires no DB. No staging DB is used by the prod apps. Migrations are governed via the shared platform schema; no ad-hoc prod migration performed.
