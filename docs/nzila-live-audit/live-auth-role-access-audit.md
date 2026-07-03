# Live Auth / Role Access Audit

Authority: docs/nzila-finalization/master-finalization-index.md
As of 2026-07-03. Verified via Azure CLI + live HTTPS smoke + repo gates.

LIVE: union-eyes org/tenant access is governed by the single fail-closed canonical resolver; no silent default-org fallback in production (UE_ALLOW_DEFAULT_ORG absent — az verified). BR-6 CLOSED (validate:br6-org-context green). web/partners use Azure AD auth (env-scoped client). Membership is verified before any client-selected org becomes authority.
