import type { AuthStorageAuthorityEntry } from './types';

/**
 * packages/db/src/auth-storage-authority/entries.ts
 *
 * Real evidence census of every table in packages/db/src/schema/auth.ts
 * (the `user_management` schema), traced via real (non-test) caller
 * search across the whole monorepo — not just apps/union-eyes. See
 * types.ts for why this is a separate registry from union-eyes's own
 * db/rls-storage-authority/.
 */
export const authStorageAuthorityEntries: AuthStorageAuthorityEntry[] = [
  {
    table: 'user_management.users',
    classification: 'AUTH_RUNTIME_SELF_SERVICE',
    reason:
      "Every real writer/reader (packages/platform-auth/src/password/auth-service.ts's login/password-reset, entra/server.ts's session-user resolution, magic-link/service.ts, mfa/service.ts) acts on the CALLER'S OWN row, resolved from their own session/credentials — no route reads or mutates an arbitrary other user's row. lifecycle/service.ts's suspendUser/reactivateUser/deprovisionUser (cross-user, would need PLATFORM_ADMIN invocation + AUTH_SYSTEM execution) have ZERO real callers anywhere in the monorepo (grep for the function names and for 'lifecycle/service' imports outside lifecycle/service.ts's own file and docs — none) — confirmed LATENT_UNWIRED, not currently reachable. CAVEAT: apps/union-eyes/db/schema/domains/member/user-management.ts independently re-declares an authAuditLog table (same physical user_management.auth_audit_log) — worth a dedicated future audit for whether other user_management tables are similarly dual-declared inside union-eyes's own schema barrel and read/written via apps/union-eyes/db/db.ts (a THIRD connection path) rather than only @nzila/db/client.",
    supportingCapability: [
      'packages/platform-auth/src/password/auth-service.ts',
      'packages/platform-auth/src/entra/server.ts',
      'packages/platform-auth/src/magic-link/service.ts',
      'packages/platform-auth/src/mfa/service.ts',
      'packages/platform-auth/src/lifecycle/service.ts (LATENT_UNWIRED cross-user path)',
    ],
    invocationAuthority: 'END_USER',
    dbExecutionPrincipal: 'AUTH_RUNTIME',
  },
  {
    table: 'user_management.organization_users',
    classification: 'AUTH_RUNTIME_MIXED',
    reason:
      "Self-service paths: entra/server.ts resolves the CALLER'S OWN org membership/role during session resolution (AUTH_RUNTIME); invites/service.ts's acceptInvite upserts the INVITED USER'S OWN row from a token they hold (AUTH_RUNTIME, END_USER). Cross-user platform-admin path: PR #752 round 12/13's apps/union-eyes/lib/services/member-access-revocation-service.ts's revokeMemberAccess()/reactivateMemberAccess() disable/re-enable an ARBITRARY other user's row from a platform-admin-gated route (app/api/admin/users/[userId]/route.ts) — round 13 fixed this to execute via @nzila/db/system-client's systemDb (AUTH_SYSTEM), not the ordinary client, specifically because this table's self-service AUTH_RUNTIME path has no legitimate reason to mutate another user's row.",
    supportingCapability: [
      'packages/platform-auth/src/entra/server.ts',
      'packages/platform-auth/src/invites/service.ts',
      'apps/union-eyes/lib/services/member-access-revocation-service.ts',
      'apps/union-eyes/app/api/admin/users/[userId]/route.ts',
    ],
    invocationAuthority: 'MIXED',
    dbExecutionPrincipal: 'MIXED',
  },
  {
    table: 'user_management.user_sessions',
    classification: 'AUTH_RUNTIME_MIXED',
    reason:
      "Self-service paths: packages/platform-auth/src/password/session.ts's createSession/validateSession/revokeSession all act on the CALLER'S OWN session (AUTH_RUNTIME, END_USER — cookie-resolved). Cross-user platform-admin path: round-12's offboarding calls revokeAllUserSessions(authUserId) for an ARBITRARY other user; round 13 added an optional db-executor parameter to revokeAllUserSessions specifically so this cross-user call can pass @nzila/db/system-client's systemDb (AUTH_SYSTEM) instead of defaulting to the ordinary client — every OTHER existing caller (self-service password change, etc.) is unaffected since the parameter defaults to the ordinary client.",
    supportingCapability: [
      'packages/platform-auth/src/password/session.ts',
      'apps/union-eyes/lib/services/member-access-revocation-service.ts',
    ],
    invocationAuthority: 'MIXED',
    dbExecutionPrincipal: 'MIXED',
  },
  {
    table: 'user_management.password_reset_tokens',
    classification: 'AUTH_RUNTIME_SELF_SERVICE',
    reason:
      "packages/platform-auth/src/password/auth-service.ts's request/verify password-reset flow only ever reads/marks-used the token the REQUESTING user themselves holds (public, unauthenticated-by-design token-bearer flow — the token IS the credential). No admin/cross-user reference found anywhere.",
    supportingCapability: ['packages/platform-auth/src/password/auth-service.ts'],
    invocationAuthority: 'END_USER',
    dbExecutionPrincipal: 'AUTH_RUNTIME',
  },
  {
    table: 'user_management.auth_audit_log',
    classification: 'AUTH_RUNTIME_SELF_SERVICE',
    reason:
      "Write-only telemetry: every writer (lifecycle/service.ts, magic-link/service.ts, mfa/service.ts, password/auth-service.ts, invites/service.ts, policy/admin.ts) inserts a row describing an action the CALLER (or the system on the caller's behalf, e.g. a failed-login attempt) just performed — always best-effort (wrapped in try/catch, 'best-effort' per lifecycle/service.ts's own comment), never conditioned on cross-user authorization. risk/assess.ts reads it (COUNT only, own-user/own-IP scoped) for login risk scoring. No admin-facing audit-log VIEWER route was found anywhere in the monorepo — this table is written but not yet read back by any operator UI/route.",
    supportingCapability: [
      'packages/platform-auth/src/lifecycle/service.ts',
      'packages/platform-auth/src/magic-link/service.ts',
      'packages/platform-auth/src/mfa/service.ts',
      'packages/platform-auth/src/password/auth-service.ts',
      'packages/platform-auth/src/invites/service.ts',
      'packages/platform-auth/src/policy/admin.ts',
      'packages/platform-auth/src/risk/assess.ts',
    ],
    invocationAuthority: 'MIXED',
    dbExecutionPrincipal: 'AUTH_RUNTIME',
  },
  {
    table: 'user_management.oauth_providers',
    classification: 'LATENT_UNWIRED',
    reason:
      'Defined in packages/db/src/schema/auth.ts; zero real (non-schema, non-test) references to authOauthProviders anywhere in the monorepo (grep for the exported symbol name found only the schema declaration itself).',
    supportingCapability: [],
    invocationAuthority: 'NONE',
    dbExecutionPrincipal: 'NONE',
  },
  {
    table: 'user_management.magic_links',
    classification: 'AUTH_RUNTIME_SELF_SERVICE',
    reason:
      "packages/platform-auth/src/magic-link/service.ts's requestMagicLink/verifyMagicLink flow (app/api/auth/magic-link/{request,verify}/route.ts) is a public, unauthenticated-by-design token-bearer flow scoped to the email/token the requester supplies — no cross-user/admin path found.",
    supportingCapability: ['packages/platform-auth/src/magic-link/service.ts'],
    invocationAuthority: 'END_USER',
    dbExecutionPrincipal: 'AUTH_RUNTIME',
  },
  {
    table: 'user_management.invites',
    classification: 'AUTH_RUNTIME_MIXED',
    reason:
      "createInvite is gated by hasMinRole('admin') in the calling route (see packages/platform-auth/src/invites/service.ts's doc comment and PR #752 round 12's TENANT_SELF_SERVICE_ASSIGNABLE_ROLES fix) — a TENANT_ADMIN inviting into their OWN organization. acceptInvite is called by the INVITED USER (END_USER) presenting the token. Both currently execute via the ordinary @nzila/db/client (AUTH_RUNTIME) — no cross-org mutation found (createInvite only ever inserts a row scoped to the caller's own organizationId).",
    supportingCapability: ['packages/platform-auth/src/invites/service.ts'],
    invocationAuthority: 'MIXED',
    dbExecutionPrincipal: 'AUTH_RUNTIME',
  },
  {
    table: 'user_management.org_auth_policies',
    classification: 'AUTH_RUNTIME_MIXED',
    reason:
      "apps/union-eyes/app/api/auth/policy/route.ts gates writes with hasMinRole (TENANT_ADMIN, managing their OWN org's policy only — withOrganizationAuth scopes to the caller's org). Reads also occur during login/signup flows (checking which auth methods are allowed for an org) as an implicit, unauthenticated-by-necessity step of the login flow itself (END_USER/SYSTEM, pre-session). No cross-org write path found.",
    supportingCapability: ['apps/union-eyes/app/api/auth/policy/route.ts', 'packages/platform-auth/src/policy/service.ts', 'packages/platform-auth/src/policy/admin.ts'],
    invocationAuthority: 'MIXED',
    dbExecutionPrincipal: 'AUTH_RUNTIME',
  },
  {
    table: 'user_management.mfa_totp',
    classification: 'AUTH_RUNTIME_SELF_SERVICE',
    reason:
      "All live HTTP routes (app/api/auth/mfa/{enroll,disable,status,verify-enroll}/route.ts) resolve the caller's own userId via auth() and act on their OWN mfa_totp row (AUTH_RUNTIME, END_USER). packages/platform-auth/src/mfa/service.ts's disableMfa() signature accepts a separate {targetUserId, actorUserId} pair and docs/categories/platform-and-operations/runbooks/union-eyes-auth-operations.md documents an admin-on-behalf-of disable flow — but that flow is run manually via an ops script/psql shell, not a live routed HTTP path, so it is not reachable by an ordinary request today. FLAGGED: if that admin flow is ever wired into a live route, it must execute via @nzila/db/system-client's systemDb (cross-user), matching the round-13 session/organization_users precedent, not the ordinary client.",
    supportingCapability: [
      'apps/union-eyes/app/api/auth/mfa/enroll/route.ts',
      'apps/union-eyes/app/api/auth/mfa/disable/route.ts',
      'apps/union-eyes/app/api/auth/mfa/status/route.ts',
      'apps/union-eyes/app/api/auth/mfa/verify-enroll/route.ts',
      'packages/platform-auth/src/mfa/service.ts',
    ],
    invocationAuthority: 'END_USER',
    dbExecutionPrincipal: 'AUTH_RUNTIME',
  },
  {
    table: 'user_management.mfa_challenges',
    classification: 'AUTH_RUNTIME_SELF_SERVICE',
    reason:
      "app/api/auth/mfa/challenge/route.ts's handleChallenge is a public route gated by the challengeToken minted for the SAME user's in-progress login attempt (issued by /api/auth/login when it returns requiresMfa:true) — the token is the credential, scoped to that one user's pending login. No cross-user reference found.",
    supportingCapability: ['apps/union-eyes/app/api/auth/mfa/challenge/route.ts', 'packages/platform-auth/src/mfa/service.ts'],
    invocationAuthority: 'END_USER',
    dbExecutionPrincipal: 'AUTH_RUNTIME',
  },
];
