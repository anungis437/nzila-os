# Full Role Experience Convergence

Authority: `master-finalization-index.md`. As of 2026-07-03.

Role/experience posture for the production apps, grounded in verified runtime state.

## union-eyes

- Org-scoped, multi-tenant. Org context resolved by the single canonical fail-closed
  resolver (`getOrganizationIdForUser`); no silent default-org fallback in production
  (`UE_ALLOW_DEFAULT_ORG` absent from prod env — az verified). BR-6 CLOSED.
- Reviewer/role separation enforced via membership verification before any
  cookie/slug-selected org becomes authority.

## web

- Public marketing surface; Azure AD auth. No DB runtime dependency. Fresh prod
  `AUTH_SECRET`; no shared staging secret.

## partners

- Partner portal; Azure AD auth; connects to the prod platform DB (`nzila_os_prod`)
  via the shared `@nzila/db` platform schema. `/api/ready` verified 200 in production.

Role experience is not asserted beyond these three production apps.
