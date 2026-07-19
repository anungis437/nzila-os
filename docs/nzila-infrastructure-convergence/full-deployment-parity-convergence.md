# Full Deployment Parity Convergence

Authority: docs/nzila-finalization/master-finalization-index.md
As of 2026-07-03. Verified via Azure CLI + live HTTPS smoke + repo gates.

LIVE: prod images built from the same governed Dockerfile targets as staging, with NEXT_PUBLIC_APP_ENV=production and prod URLs; digest-pinned in the prod env. Registry auth via ACR credentials (union-eyes-prod uses SystemAssigned MI). Deploy authority OIDC-only.
