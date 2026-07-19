# Environment Isolation Implementation

Authority: docs/nzila-finalization/master-finalization-index.md
As of 2026-07-03. Verified via Azure CLI + live HTTPS smoke + repo gates.

LIVE: production isolated in dedicated nzila-canada-prod-rg / nzila-canada-prod-env with dedicated DB + Log Analytics; ENVIRONMENT_ISOLATION=full. The prior deployment-inventory.json sharedWithStaging=true metadata was STALE and corrected. web/partners moved off STAGING-ONLY runtime into the isolated prod env.
