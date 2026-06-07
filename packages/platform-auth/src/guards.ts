/**
 * @nzila/platform-auth — Guards
 *
 * Shared API route guards for org-scoped and platform-scoped
 * operations. Extracted from app-level implementations to
 * provide a single canonical guard set.
 *
 * DENY BY DEFAULT: all guards fail closed.
 *
 * @invariant FAIL_CLOSED_002
 */
import type { OrgContext } from '@nzila/org'
import type { PlatformRole } from '@nzila/platform-contracts'
import { createPlatformError, type PlatformError } from '@nzila/platform-contracts'
import type {
  AuthenticatedIdentity,
  OrgMembership,
} from './identity'
import { meetsOrgRoleRequirement } from './authorization'

// ── Guard Options ───────────────────────────────────────────────────────────

export interface OrgAccessOptions {
  /** Minimum org role required. Default: unknown active member. */
  minRole?: 'org_admin' | 'org_secretary'
  /** Platform roles that bypass org membership checks. */
  platformBypass?: PlatformRole[]
}

// ── Guard Result ────────────────────────────────────────────────────────────

export interface GuardSuccess<T> {
  ok: true
  value: T
}

export interface GuardFailure {
  ok: false
  error: PlatformError
  httpStatus: number
}

export type GuardResult<T> = GuardSuccess<T> | GuardFailure

// ── Guard Functions ─────────────────────────────────────────────────────────

/**
 * Require authenticated identity.
 * Returns failure with AUTH_REQUIRED if not authenticated.
 */
export function requireAuth(
  identity: AuthenticatedIdentity | null | undefined,
): GuardResult<AuthenticatedIdentity> {
  if (!identity) {
    return {
      ok: false,
      error: createPlatformError('AUTH_REQUIRED', 'Authentication required'),
      httpStatus: 401,
    }
  }
  return { ok: true, value: identity }
}

/**
 * Require an active org scope.
 * Returns failure with ORG_SCOPE_REQUIRED if no org is selected.
 */
export function requireOrgScopeGuard(
  identity: AuthenticatedIdentity,
): GuardResult<{ identity: AuthenticatedIdentity; orgId: string }> {
  if (!identity.activeOrgId) {
    return {
      ok: false,
      error: createPlatformError(
        'ORG_SCOPE_REQUIRED',
        'An active organization must be selected',
      ),
      httpStatus: 403,
    }
  }
  return {
    ok: true,
    value: { identity, orgId: identity.activeOrgId },
  }
}

/**
 * Require active org membership.
 * Returns failure with ACCESS_DENIED if not a member.
 */
export function requireOrgMembership(
  identity: AuthenticatedIdentity,
  membership: OrgMembership | null,
  options?: OrgAccessOptions,
): GuardResult<{ identity: AuthenticatedIdentity; membership: OrgMembership }> {
  // Service accounts pass through
  if (identity.isService) {
    return {
      ok: true,
      value: {
        identity,
        membership: membership ?? {
          id: 'svc',
          orgId: identity.activeOrgId ?? '',
          userId: identity.userId,
          role: 'org_admin',
          status: 'active',
        },
      },
    }
  }

  if (!membership || membership.status !== 'active') {
    return {
      ok: false,
      error: createPlatformError('ACCESS_DENIED', 'Not a member of this organization'),
      httpStatus: 403,
    }
  }

  // Check minimum role
  if (options?.minRole) {
    if (!meetsOrgRoleRequirement(membership.role, options.minRole)) {
      return {
        ok: false,
        error: createPlatformError(
          'ACCESS_DENIED',
          `Requires at least ${options.minRole} role`,
        ),
        httpStatus: 403,
      }
    }
  }

  return { ok: true, value: { identity, membership } }
}

/**
 * Require one of the specified platform roles.
 */
export function requirePlatformRoleGuard(
  platformRole: PlatformRole,
  ...allowed: PlatformRole[]
): GuardResult<PlatformRole> {
  if (!allowed.includes(platformRole)) {
    return {
      ok: false,
      error: createPlatformError(
        'ACCESS_DENIED',
        `Requires one of: ${allowed.join(', ')}`,
      ),
      httpStatus: 403,
    }
  }
  return { ok: true, value: platformRole }
}

/**
 * Build a full OrgContext from auth identity + membership.
 * Used after all guards have passed.
 */
export function buildOrgContext(
  identity: AuthenticatedIdentity,
  orgId: string,
  role: string,
  permissions: readonly string[],
  requestId?: string,
): OrgContext {
  return {
    orgId,
    actorId: identity.userId,
    appId: undefined,
    role,
    permissions,
    requestId: requestId ?? crypto.randomUUID(),
    correlationId: undefined,
  }
}
