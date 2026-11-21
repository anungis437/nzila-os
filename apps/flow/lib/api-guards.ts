/**
 * Shared API route guards — authentication + request context
 *
 * Centralises the auth boilerplate for all API routes,
 * combining platform authentication with os-core request context
 * (AsyncLocalStorage-based tracing + automatic log enrichment).
 *
 * Usage in API routes:
 *   const result = await authenticateUser()
 *   if (!result.ok) return result.response
 *   const { userId } = result
 *
 * Usage with request context (enables auto-attached requestId in logs):
 *   return withRequestContext(request, async () => {
 *     const result = await authenticateUser()
 *     if (!result.ok) return result.response
 *     // ... handler logic — all logger calls auto-attach requestId
 *   })
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@nzila/platform-auth/entra/server'
import { createRequestContext, runWithContext } from '@nzila/os-core/telemetry'

// ── Authentication ──────────────────────────────────────────────────────────

export async function authenticateUser(): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse }
> {
  const { userId } = await auth()
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  return { ok: true, userId }
}

/** Platform roles that may read global (cross-organization) Flow operational aggregates. */
export const GLOBAL_OPERATOR_ROLES = ['platform_admin', 'studio_admin', 'ops', 'platform.admin', 'system.admin'] as const

/**
 * Guard for platform-level routes (not org-scoped), named and shaped like the console/cfo guard of the same name.
 * Global commerce totals require a platform assignment, never an org role. auth() exposes verified Entra app
 * assignments in sessionClaims.roles; its has({ role }) also accepts org roles, so it is unsuitable for this boundary.
 * No allowed role means no access.
 */
export async function requirePlatformRole(
  ...allowed: readonly string[]
): Promise<{ ok: true; userId: string; platformRole: string } | { ok: false; response: NextResponse }> {
  const session = await auth()
  if (!session.userId) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const roles = session.sessionClaims?.roles
  const platformRole =
    Array.isArray(roles) && roles.every((role) => typeof role === 'string')
      ? roles.find((role: string) => allowed.includes(role))
      : undefined
  if (!platformRole) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden: platform operator required' },
        { status: 403 },
      ),
    }
  }
  return { ok: true, userId: session.userId, platformRole }
}

/**
 * Authenticate AND resolve org context for API routes.
 * Returns userId + orgId from auth session, or a 401/403 JSON response.
 */
export async function authenticateOrgUser(): Promise<
  { ok: true; userId: string; orgId: string } | { ok: false; response: NextResponse }
> {
  const { userId, orgId } = await auth()
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  if (!orgId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'No active organization' }, { status: 403 }),
    }
  }
  return { ok: true, userId, orgId }
}

// ── Request Context wrapper ─────────────────────────────────────────────────

/**
 * Wraps a route handler with os-core request context.
 * Extracts x-request-id and W3C traceparent from headers,
 * then runs the handler inside AsyncLocalStorage so the
 * os-core logger auto-attaches requestId/traceId to every log.
 */
export async function withRequestContext<T>(
  req: NextRequest | Request,
  handler: () => Promise<T>,
): Promise<T> {
  const ctx = createRequestContext(req, { appName: 'flow' })
  return runWithContext(ctx, handler)
}
