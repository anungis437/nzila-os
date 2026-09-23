# Phase G Runtime/Pilot Acceptance - BLOCKED (original two defects CLEARED)

Generated: 2026-09-23T18:05:38.850505+00:00 (America/Toronto EDT reporting context)

## Disposition
- FRESH_CANONICAL_STAGING = **PASS**
- APP_SCHEMA_COMPATIBILITY = **PASS** (deleted_at + /organizations/current)
- PHASE_G_DEPLOYED_RUNTIME_AUTHORITY = **BLOCKED**
- READY_FOR_POST_G_RELEASE_DISPOSITION = **NO**
- PRODUCTION_TOUCHED = **NO**
- Snapshot lifecycle / PR = **not started** (Phase G not PASS)

## Section 1 - Provenance
- Traffic revision: **nzila-os-union-eyes-staging--0000255** @ 100%
- Image: `sha256:2437fc0090de0029f97b6d6112e7b45aae6f892b418816577851601e9c474d02`
- Image source SHA: `a7a3f0e0d24f1b96a9c26b4e025fe44347034a79`
- Deploy run: https://github.com/anungis437/nzila-os/actions/runs/35896982322
- Schema source SHA: `f71c6e5cac4c68d706285a37050748e21103574d`
- APP_SCHEMA_COMPATIBILITY = **PASS**
- Worktree tip `24513797a` (grievance withRLSContext) **not** in this image

## Cleared blockers (this dispatch)
1. **ORG_MEMBERS_DELETED_AT_MISSING** — PLATFORM_SQL `0005_organization_members_deleted_at` applied to staging; column present; folded into platform journal for clean-room reconstitutions.
2. **ORGANIZATIONS_CURRENT_ROUTE_UUID** — dedicated `app/api/organizations/current/route.ts`; `[id]` rejects non-UUID/sentinel `current`.

## Supporting app fixes also in image a7a3f0e0d
- `getOrganizationIdForUser` / `getUserContextForOrganization` / entitlement + rbac lookups under `withSystemContext` (tenant RLS bootstrap)
- INV-31b classification for `/organizations/current`
- Scoped drizzle ledger backfilled on staging so ICRA 0005 gate GO

## Section 2 - Fixtures
- Synthetic UUID ORG_A/B identities retained
- `organization_members` + `user_management.organization_users` seeded
- `org_entitlements`: `grievance_case_suite`, `financial_intelligence_suite` active for ORG_A/B
- ADMIN_A role set to `officer` for billing-cycle

## Section 4 - Billing
- `/api/dues/billing-cycle` → **200** (schema OK; no missing-relation)

## Section 5–7 - HTTP / pilot (rev 0000255)
| Case | Status |
|------|--------|
| ADMIN_A_health | 200 |
| *_org_current (A roles + ADMIN_B) | 200 |
| ADMIN_A_grievances_list | 200 empty `data:[]` |
| ADMIN_A_grievance_A | 404 |
| ADMIN_A_document_A | 403 app_owner |
| BILLING_CYCLE | 200 |
| UNAUTHENTICATED | 401 |
| CROSS_ORG grievance reads | 404 (no cross-tenant leak) |
| SAME_ROLE_UNAUTHORIZED_admin_route | 403 |

## Remaining blockers
1. **GRIEVANCE_HANDLER_MISSING_RLS_CONTEXT** — list/get omit `withRLSContext({organizationId})`; fix committed as `24513797a` but **not deployed** on 0000255.
2. **DOCUMENT_ROUTE_REQUIRES_APP_OWNER** — document positive path blocked by app_owner gate vs Phase G fixture roles.

## Section 8 - PG15
- ACCEPTED_FOR_STAGING (prior)

## Resources mutated (staging only)
- ACA `nzila-os-union-eyes-staging` / `nzila-canada-staging-rg` — revisions through 0000255; traffic 100% on 0000255
- DB `nzila_os_staging` — PLATFORM_SQL 0005; organization_members seed; org_entitlements; ADMIN_A→officer; grievance status→filed; scoped drizzle ledger backfill
- **No production**
