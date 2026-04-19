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
 *     // ... handler logic
 *   })
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@nzila/platform-auth/entra/server'
import {
  createRequestContext,
  runWithContext,
} from '@nzila/os-core/telemetry'
import { hasPermission, normalizeRole, type AbrPermission, type AbrRole } from '@/lib/rbac'
import { resolveOrgContext } from '@/lib/org-context'

// ── Authentication ──────────────────────────────────────────────────────────

export async function authenticateUser(): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
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

export async function authenticateWithOrg(
  req: NextRequest | Request,
): Promise<
  | { ok: true; userId: string; orgId: string; orgSource: 'header' | 'demo-default' }
  | { ok: false; response: NextResponse }
> {
  const authn = await authenticateUser()
  if (!authn.ok) return authn

  const org = resolveOrgContext(req)
  if (!org) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Missing organization context', code: 'ORG_CONTEXT_REQUIRED' },
        { status: 400 },
      ),
    }
  }

  return {
    ok: true,
    userId: authn.userId,
    orgId: org.orgId,
    orgSource: org.source,
  }
}

export async function requireOrgAccess(
  req: NextRequest | Request,
): Promise<
  | { ok: true; userId: string; orgId: string; orgSource: 'header' | 'demo-default' }
  | { ok: false; response: NextResponse }
> {
  return authenticateWithOrg(req)
}

export function requirePermission(
  req: NextRequest | Request,
  permission: AbrPermission,
):
  | { ok: true; role: AbrRole }
  | { ok: false; response: NextResponse } {
  const role = normalizeRole(req.headers.get('x-abr-role'))
  if (!hasPermission(role, permission)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden', code: 'INSUFFICIENT_PERMISSION', permission, role },
        { status: 403 },
      ),
    }
  }

  return { ok: true, role }
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
  const ctx = createRequestContext(req, { appName: 'abr' })
  return runWithContext(ctx, handler)
}
