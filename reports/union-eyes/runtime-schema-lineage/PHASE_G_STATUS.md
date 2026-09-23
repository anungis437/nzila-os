# Phase G Runtime/Pilot Acceptance — BLOCKED

Generated: 2026-09-23T16:01:38.848462+00:00

## Disposition
- FRESH_CANONICAL_STAGING = **PASS** (reconstitution baseline held; rls-verify 1697/1697)
- PHASE_G_DEPLOYED_RUNTIME_AUTHORITY = **BLOCKED**
- READY_FOR_POST_G_RELEASE_DISPOSITION = **NO**
- PRODUCTION_TOUCHED = **NO**
- Snapshot lifecycle / PR = **not started** (Phase G not PASS)

## Section 1 — Provenance
- Traffic revision: nzila-os-union-eyes-staging--0000247 @ 100%
- Image: sha256:3fa0a3de2f17cf3be5cd3666d9eb61d6e69cbb3029e9d66c451707195f2ada1b
- Image source SHA: b30798326afbb1ad24b72b33b2be5f300bd6023c
- Release: UE-2026-09-22-b307983
- Schema source SHA: f71c6e5cac4c68d706285a37050748e21103574d
- APP_SCHEMA_COMPATIBILITY = **FAIL** (see blockers)

## Section 2 — Fixtures
- STAGING_ACCEPTANCE_FIXTURES = PASS (synthetic UUID ORG_A/B, roles, matters, docs, representation + external grants)
- PRODUCTION_DATA_USED = NO / REAL_MEMBER_DATA_USED = NO

## Section 3 — RLS SQL boundary
- union_eyes_runtime: ROLSUPER=false, ROLBYPASSRLS=false
- No-context org/matter/doc counts = 0
- ORG/MATTER/DOCUMENT A↔B isolation = PASS
- TRANSACTION_CONTEXT_LEAKAGE = 0
- rls-verify --mode=preflight = **1697/1697 PASS**, MISSING_RLS_TARGET_TABLES = 0

## Section 4 — Runtime surfaces
- billing_subscriptions present; SQL surfaces queryable under org context
- HTTP /api/dues/billing-cycle: BILLING_CYCLE_MISSING_RELATION_ERROR=**NO**; reached 403 officer role (not 42P01)

## Section 5–7 — HTTP / pilot
- Acceptance-auth identity-only; Playwright test auth DISABLED
- UNAUTHENTICATED → 401 (PASS)
- Authenticated positives BLOCKED by org-resolution / route defects (see below)

## Exact blockers
1. **ORG_MEMBERS_DELETED_AT_MISSING** — app selects organization_members.deleted_at but column absent on reconstituted staging.
2. **ORGANIZATIONS_CURRENT_ROUTE_UUID** — /api/organizations/current uses path token current as UUID.

## Section 8 — PG15
- Restore/runtime/RLS on Azure PG15 = PASS → ACCEPTED_FOR_STAGING
- Recommendation: align clean-room CI to PG15 (not implemented)

## Resources mutated (staging only)
- ACA traffic + env allowlist on 
zila-os-union-eyes-staging / 
zila-canada-staging-rg
- DB fixture rows in 
zila_os_staging on 
zila-staging-db / 
zila-staging-rg
- Temporary firewall rule for operator IP (cleanup separately if still present)
