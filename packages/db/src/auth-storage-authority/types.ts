/**
 * packages/db/src/auth-storage-authority/types.ts
 *
 * Schema-qualified storage authority registry for the shared
 * `user_management` PostgreSQL schema (packages/db/src/schema/auth.ts).
 *
 * PR #752 round 13: Round 12 proved that apps/union-eyes's own
 * db/rls-storage-authority/ registry — however complete — is NOT the
 * whole database authorization model. It covers the `public` schema
 * tables union-eyes itself owns. Authentication authority (login,
 * sessions, org membership role, invites, MFA) lives in a SEPARATE
 * schema, `user_management`, shared by every Nzila app via
 * @nzila/db/schema, and is reached through @nzila/db/client's ordinary
 * DATABASE_URL connection — a connection with no notion of "tenant" vs
 * "system" role separation today. This module is a DISTINCT authority
 * surface, deliberately not merged into union-eyes's public-schema
 * registry (that registry's own invariants — e.g. its 0108-baseline
 * scope — are about union-eyes's public schema specifically).
 *
 * This is a STORAGE AUTHORITY DOCUMENTATION artifact, not yet a live
 * DB-privilege enforcement mechanism: unlike public-schema union-eyes
 * tables (which have real RLS policies + dedicated union_eyes_runtime/
 * union_eyes_system roles from the 0108 migration), user_management has
 * no live RLS/FORCE RLS/per-role GRANT split proven in this environment
 * (no staging Postgres credentials available). Classifications here
 * record the INTENDED authority model (who invokes, which principal
 * SHOULD execute) based on real code tracing; a follow-up migration is
 * required to actually enable RLS/FORCE RLS and split grants between an
 * ordinary auth-runtime role and a system auth role on user_management,
 * then this registry's `dbExecutionPrincipal` values become checkable
 * the same way scripts/rls-verify.ts checks union-eyes's public schema.
 */

export type AuthStorageAuthorityClassification =
  /** Ordinary self-service authentication runtime table (login, own session, own MFA, own org list). */
  | 'AUTH_RUNTIME_SELF_SERVICE'
  /** Read/write by an authenticated user acting on their OWN row only, but the table also has a legitimate cross-user SYSTEM path (e.g. platform-admin offboarding). */
  | 'AUTH_RUNTIME_MIXED'
  /** Only ever mutated by a platform-admin/system-authorized cross-user operation; no ordinary self-service path should reach it. */
  | 'AUTH_SYSTEM_ONLY'
  /** Defined in schema, zero real (non-test) callers anywhere in the monorepo today. */
  | 'LATENT_UNWIRED'

export type AuthInvocationAuthority =
  | 'END_USER' // the authenticated user themselves (self-service)
  | 'TENANT_ADMIN' // an org admin acting on members of their OWN org
  | 'PLATFORM_ADMIN' // a platform-level operator acting across orgs/users
  | 'SYSTEM_SCHEDULE' // background job, no request in the loop
  | 'MIXED'
  | 'NONE' // LATENT_UNWIRED

export type AuthDbExecutionPrincipal =
  | 'AUTH_RUNTIME' // the ordinary @nzila/db/client connection (ordinary credential)
  | 'AUTH_SYSTEM' // @nzila/db/system-client's systemDb (dedicated system credential)
  | 'MIXED'
  | 'NONE'

export interface AuthStorageAuthorityEntry {
  /** user_management.<table> — always schema-qualified. */
  table: string;
  classification: AuthStorageAuthorityClassification;
  reason: string;
  /** Real (non-test) files that read/write this table. */
  supportingCapability: string[];
  invocationAuthority: AuthInvocationAuthority;
  dbExecutionPrincipal: AuthDbExecutionPrincipal;
}
