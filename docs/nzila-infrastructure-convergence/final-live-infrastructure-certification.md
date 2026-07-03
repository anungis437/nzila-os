# Final Live Infrastructure Certification

Authority: docs/nzila-finalization/master-finalization-index.md
As of 2026-07-03. Verified via Azure CLI + live HTTPS smoke + repo gates.

## Environment Matrix

LIVE dedicated per-tier isolation (az verified): DEV (developer), STAGING (nzila-canada-staging-env), DEMO (nzila-canada-demo-env), PILOT (nzila-canada-pilot-env), PROD (nzila-canada-prod-env). Production is isolated from staging (dedicated RG/env/DB/Log-Analytics; ENVIRONMENT_ISOLATION=full).

## URL Matrix

LIVE: app.unioneyes.app (PROD union-eyes), www.nzilaventures.com (PROD web), partners.nzilaventures.com (PROD partners) — all 200 + valid TLS. Apex nzilaventures.com is PARTIAL (cert Pending). STAGING/DEMO/PILOT URLs are STAGING-ONLY on their own envs.

## Release Matrix

LIVE: PROD apps digest-pinned; promotion is OIDC-only via env-scoped federated credential (nzila-os-deploy-prod). resolve-deploy-apps.ts bounds prod eligibility; validate:production-deploy-authority green.

## Auth Matrix

LIVE: OIDC subject repo:anungis437/nzila-os:environment:production (not wildcard). union-eyes org substrate fail-closed (BR-6 CLOSED). web/partners Azure AD auth.

## E2E Matrix

LIVE runtime chain (build to deploy to verify to cutover) attested in proof-artifacts/rollout-attestations. Automated Playwright E2E is DEFERRED/PARTIAL.

## Rollback Matrix

LIVE: rollback to prior known-good digest/revision (union-eyes …--0000173 retained). DB PITR 30d + restore-drill server nzila-ue-prod-db-drill-20260520. Runbook: docs/runbooks/production-rollback.md.

## Unresolved Risks

- CLOSED: the nzilacanadastore storage key was rotated by the owner; partners-prod secret refreshed and staging partners plaintext env moved to a secret reference (no plaintext key remains).
- CLOSED: the Cloudflare API token used for the DNS cutover was rotated/revoked by the owner; repo scan confirms no token value exists in tracked files (only env-var names/placeholders and unrelated CLOUDFLARE_R2_ storage vars).
- LOW: apex nzilaventures.com managed cert still Pending (PARTIAL); www is canonical and live.
- LOW: production metric alert rules for web/partners not yet configured (action group exists).

No critical, high, or medium unresolved security risk remains for the production runtime.

## Per-tier Operational Verdicts

- DEV: GO
- STAGING: GO
- DEMO: GO
- PILOT: GO
- PROD: GO

NZILA LIVE INFRASTRUCTURE STATUS: GO WITH EXCEPTIONS
