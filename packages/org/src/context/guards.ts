/**
 * @nzila/org — Fail-Closed Guards
 *
 * Strict guards that enforce org_scope presence and validity.
 * Used at API boundaries and server action entry points.
 *
 * DENY BY DEFAULT: unknown request without valid org context fails closed.
 *
 * @invariant FAIL_CLOSED_001
 */
import type { OrgContext, DbContext } from './types.js'
import { isOrgContext } from './types.js'

// ── Error Types ─────────────────────────────────────────────────────────────

export class OrgScopeRequiredError extends Error {
  readonly code = 'ORG_SCOPE_REQUIRED' as const
  constructor(message = 'Org scope is required for this operation') {
    super(message)
    this.name = 'OrgScopeRequiredError'
  }
}

export class OrgScopeInvalidError extends Error {
  readonly code = 'ORG_SCOPE_INVALID' as const
  constructor(message = 'Org scope is invalid') {
    super(message)
    this.name = 'OrgScopeInvalidError'
  }
}

export class OrgAccessDeniedError extends Error {
  readonly code = 'ACCESS_DENIED' as const
  constructor(message = 'Access denied for this org scope') {
    super(message)
    this.name = 'OrgAccessDeniedError'
  }
}

// ── Guards ──────────────────────────────────────────────────────────────────

/**
 * Require a valid OrgContext. Throws OrgScopeRequiredError if missing
 * or OrgScopeInvalidError if malformed.
 *
 * Use at the top of every org-scoped server action / API handler.
 */
export function requireOrgScope<R extends string = string>(
  ctx: OrgContext<R> | null | undefined,
): asserts ctx is OrgContext<R> {
  if (!ctx) {
    throw new OrgScopeRequiredError()
  }
  if (!isOrgContext(ctx)) {
    throw new OrgScopeInvalidError()
  }
}

/**
 * Require that the actor has a specific permission.
 * Throws OrgAccessDeniedError if the permission is missing.
 */
export function requirePermission(
  ctx: OrgContext,
  permission: string,
): void {
  if (!ctx.permissions.includes(permission)) {
    throw new OrgAccessDeniedError(
      `Permission '${permission}' is required for this operation`,
    )
  }
}

/**
 * Require that the actor has one of the specified roles.
 * Throws OrgAccessDeniedError if role does not match.
 */
export function requireRole(
  ctx: OrgContext,
  ...allowedRoles: string[]
): void {
  if (!allowedRoles.includes(ctx.role)) {
    throw new OrgAccessDeniedError(
      `One of roles [${allowedRoles.join(', ')}] is required`,
    )
  }
}

/**
 * Assert that two org contexts reference the same org.
 * Prevents cross-org data access.
 *
 * @invariant CROSS_ORG_DENY_001
 */
export function assertSameOrg(
  ctx: OrgContext | DbContext,
  targetOrgId: string,
): void {
  if (ctx.orgId !== targetOrgId) {
    throw new OrgAccessDeniedError('Cross-org access is denied')
  }
}

/**
 * Guard wrapper that enforces org_scope on a function.
 * Returns a new function that checks org context before calling the original.
 */
export function withOrgScope<Args extends [OrgContext, ...unknown[]], R>(
  fn: (...args: Args) => R,
): (...args: Args) => R {
  return (...args: Args) => {
    requireOrgScope(args[0])
    return fn(...args)
  }
}
