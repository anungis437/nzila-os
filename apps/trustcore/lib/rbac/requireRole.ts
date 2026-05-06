/**
 * TrustCore — RBAC Middleware
 *
 * Provides role enforcement for both:
 *  - Server components (requireRole — throws on violation)
 *  - API route handlers (withRequiredRole — returns 401/403 JSON response)
 *
 * Usage (server component / page):
 *   await requireRole(['org_admin', 'auditor'])
 *
 * Usage (API route):
 *   export const GET = withRequiredRole(['org_admin'], async (req, ctx) => { ... })
 */

import { NextRequest, NextResponse } from 'next/server'
import { hasPlatformRole, requirePlatformRoleGuard } from '@nzila/platform-auth'
import type { PlatformRole } from '@nzila/platform-contracts'
import { getAuthContext } from '@/lib/auth/getAuthContext'
import type { AuthContext, Role } from '@/types/core'

function toPlatformRole(role: Role): PlatformRole {
  switch (role) {
    case 'platform_admin':
      return 'platform_admin'
    case 'org_admin':
      return 'org_admin'
    case 'staff':
      return 'org_member'
    case 'auditor':
      return 'org_viewer'
  }
}

export function hasMinRole(userRole: Role, minRole: Role): boolean {
  return hasPlatformRole(toPlatformRole(userRole), toPlatformRole(minRole))
}

// ── Server-component guard ─────────────────────────────────────────────────

/**
 * Enforce that the current user holds one of the allowed roles.
 * Throws when auth fails or role is insufficient — the caller
 * (or Next.js error boundary) is responsible for handling the throw.
 *
 * @returns The resolved AuthContext when access is granted.
 * @throws {Error} 'Unauthorized' or 'Forbidden'
 */
export async function requireRole(allowed: Role[]): Promise<AuthContext> {
  const ctx = await getAuthContext()

  const roleCheck = requirePlatformRoleGuard(
    toPlatformRole(ctx.role),
    ...allowed.map(toPlatformRole),
  )

  if (!roleCheck.ok) {
    throw new Error(
      `Forbidden: role "${ctx.role}" is not in [${allowed.join(', ')}]`,
    )
  }

  return ctx
}

// ── API route handler guard ────────────────────────────────────────────────

type RouteHandler = (
  request: NextRequest,
  context: AuthContext,
  routeParams?: Record<string, string>,
) => Promise<NextResponse> | NextResponse

/**
 * Wrap an API route handler with role enforcement.
 * Returns structured JSON error responses on auth/authz failure.
 *
 * @example
 *   export const GET = withRequiredRole(['org_admin', 'auditor'], async (req, ctx) => {
 *     return NextResponse.json({ orgId: ctx.orgId })
 *   })
 */
export function withRequiredRole(
  allowed: Role[],
  handler: RouteHandler,
) {
  return async (
    request: NextRequest,
    routeContext?: { params: Promise<Record<string, string>> | Record<string, string> },
  ): Promise<NextResponse> => {
    let ctx: AuthContext

    try {
      ctx = await getAuthContext()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unauthorized'
      if (message === 'OrgRequired') {
        return NextResponse.json(
          { success: false, error: 'Organization context required' },
          { status: 403 },
        )
      }
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      )
    }

    const roleCheck = requirePlatformRoleGuard(
      toPlatformRole(ctx.role),
      ...allowed.map(toPlatformRole),
    )

    if (!roleCheck.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Forbidden: role "${ctx.role}" is not in [${allowed.join(', ')}]`,
        },
        { status: 403 },
      )
    }

    const params = routeContext?.params
      ? await Promise.resolve(routeContext.params)
      : undefined

    return handler(request, ctx, params)
  }
}
