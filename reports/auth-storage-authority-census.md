# Auth Storage Authority Census (user_management schema)

Generated: 2026-09-02T21:34:26.032Z

PR #752 round 13: separate authority surface from apps/union-eyes's
public-schema registry — see
packages/db/src/auth-storage-authority/types.ts for why.

- Total tables: 11
- Needs review: 0
- Enforcement status: INTENDED_AUTHORITY_NOT_LIVE_DB_ENFORCEMENT
- Duplicate-declaration debt (reachable alternates): 4
- AUTH_SYSTEM_ONLY exposed to AUTH_RUNTIME (invariant violation): 0

## By classification

- AUTH_RUNTIME_MIXED: 6
- AUTH_RUNTIME_SELF_SERVICE: 5

## By DB execution principal

- MIXED: 3
- AUTH_RUNTIME: 7
- APP_OWN_DUPLICATE_RUNTIME: 1

## Tables

| Table | Classification | Invocation Authority | DB Execution Principal | Runtime Ops | System Ops |
|---|---|---|---|---|---|
| user_management.users | AUTH_RUNTIME_MIXED | END_USER | MIXED | SELECT,INSERT,UPDATE | — |
| user_management.organization_users | AUTH_RUNTIME_MIXED | MIXED | MIXED | SELECT,INSERT,UPDATE | UPDATE |
| user_management.user_sessions | AUTH_RUNTIME_MIXED | MIXED | MIXED | SELECT,INSERT,UPDATE | UPDATE |
| user_management.password_reset_tokens | AUTH_RUNTIME_SELF_SERVICE | END_USER | AUTH_RUNTIME | SELECT,INSERT,UPDATE | — |
| user_management.auth_audit_log | AUTH_RUNTIME_SELF_SERVICE | MIXED | AUTH_RUNTIME | SELECT,INSERT | — |
| user_management.oauth_providers | AUTH_RUNTIME_MIXED | END_USER | APP_OWN_DUPLICATE_RUNTIME | SELECT,INSERT | — |
| user_management.magic_links | AUTH_RUNTIME_SELF_SERVICE | END_USER | AUTH_RUNTIME | SELECT,INSERT,UPDATE | — |
| user_management.invites | AUTH_RUNTIME_MIXED | MIXED | AUTH_RUNTIME | SELECT,INSERT,UPDATE | — |
| user_management.org_auth_policies | AUTH_RUNTIME_MIXED | MIXED | AUTH_RUNTIME | SELECT,INSERT,UPDATE | — |
| user_management.mfa_totp | AUTH_RUNTIME_SELF_SERVICE | END_USER | AUTH_RUNTIME | SELECT,INSERT,UPDATE | — |
| user_management.mfa_challenges | AUTH_RUNTIME_SELF_SERVICE | END_USER | AUTH_RUNTIME | SELECT,INSERT,UPDATE | — |

## Duplicate declarations

| Physical table | Canonical | Alternate | Reachable | Production importers |
|---|---|---|---|---|
| user_management.users | authUsers (packages/db/src/schema/auth.ts) | users (apps/union-eyes/db/schema/domains/member/user-management.ts) | YES | apps/union-eyes/lib/api-auth-guard.ts (reads users.isSystemAdmin for the CALLER's own userId) |
| user_management.users | authUsers (packages/db/src/schema/auth.ts) | users (apps/union-eyes/db/schema/user-management-schema.ts) | YES | apps/union-eyes/lib/services/grievance-notifications.ts; apps/union-eyes/lib/services/messaging/campaign-service.ts; apps/union-eyes/lib/deadline-engine/recipient-resolver.ts |
| user_management.organization_users | authOrganizationUsers (packages/db/src/schema/auth.ts) | organizationUsers (apps/union-eyes/db/schema/domains/member/user-management.ts) | YES | apps/union-eyes/actions/admin-actions.ts; apps/union-eyes/lib/middleware/api-security.ts |
| user_management.organization_users | authOrganizationUsers (packages/db/src/schema/auth.ts) | organizationUsers (apps/union-eyes/db/schema/user-management-schema.ts) | no | — |
| user_management.password_reset_tokens | authPasswordResetTokens (packages/db/src/schema/auth.ts) | passwordResetTokens (apps/union-eyes/db/schema/domains/member/user-management.ts) | no | — |
| user_management.auth_audit_log | authAuditLog (packages/db/src/schema/auth.ts) | authAuditLog (apps/union-eyes/db/schema/domains/member/user-management.ts) | no | — |
| user_management.oauth_providers | authOauthProviders (packages/db/src/schema/auth.ts) | oauthProviders (apps/union-eyes/db/schema/domains/member/user-management.ts) | YES | apps/union-eyes/app/api/enterprise/integrations/route.ts (live crudRoutes CRUD endpoint) |
