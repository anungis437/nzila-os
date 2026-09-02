# Auth Storage Authority Census (user_management schema)

Generated: 2026-09-02T20:36:27.852Z

PR #752 round 13: separate authority surface from apps/union-eyes's
public-schema registry — see
packages/db/src/auth-storage-authority/types.ts for why.

- Total tables: 11
- Needs review: 0
- AUTH_SYSTEM_ONLY exposed to AUTH_RUNTIME (invariant violation): 0

## By classification

- AUTH_RUNTIME_SELF_SERVICE: 6
- AUTH_RUNTIME_MIXED: 4
- LATENT_UNWIRED: 1

## By DB execution principal

- AUTH_RUNTIME: 8
- MIXED: 2
- NONE: 1

## Tables

| Table | Classification | Invocation Authority | DB Execution Principal |
|---|---|---|---|
| user_management.users | AUTH_RUNTIME_SELF_SERVICE | END_USER | AUTH_RUNTIME |
| user_management.organization_users | AUTH_RUNTIME_MIXED | MIXED | MIXED |
| user_management.user_sessions | AUTH_RUNTIME_MIXED | MIXED | MIXED |
| user_management.password_reset_tokens | AUTH_RUNTIME_SELF_SERVICE | END_USER | AUTH_RUNTIME |
| user_management.auth_audit_log | AUTH_RUNTIME_SELF_SERVICE | MIXED | AUTH_RUNTIME |
| user_management.oauth_providers | LATENT_UNWIRED | NONE | NONE |
| user_management.magic_links | AUTH_RUNTIME_SELF_SERVICE | END_USER | AUTH_RUNTIME |
| user_management.invites | AUTH_RUNTIME_MIXED | MIXED | AUTH_RUNTIME |
| user_management.org_auth_policies | AUTH_RUNTIME_MIXED | MIXED | AUTH_RUNTIME |
| user_management.mfa_totp | AUTH_RUNTIME_SELF_SERVICE | END_USER | AUTH_RUNTIME |
| user_management.mfa_challenges | AUTH_RUNTIME_SELF_SERVICE | END_USER | AUTH_RUNTIME |
