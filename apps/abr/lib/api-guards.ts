/**
 * Shared API route guards — authentication + request context
 *
 * Centralises the auth boilerplate for all API routes,
 * combining platform authentication with os-core request context
 * (AsyncLocalStorage-based tracing + automatic log enrichment).
 *
 * ## Trust model (documented for CourtLens Phase 2C.5)
 *
 * - `authenticateUser` and `authenticateWithOrg` derive `userId` from the
 *   server-side platform-auth session. Trusted.
 * - `resolveOrgContext` reads `x-org-id` from the request headers. This is
 *   currently client-controllable and MUST be paired with server-side
 *   membership verification before production use. See TENANT_MEMBERSHIP_TODO
 *   below and docs/courtlens/phase-2/tenant-matter-queue-api.md.
 * - `requirePermission` reads `x-abr-role` from the request headers. This is
 *   currently client-controllable and MUST be replaced with a server-derived
 *   role source (session/membership) before production use.
 *
 * The current guards are safe for dev/test/pilot behind trusted-network
 * conditions. They are NOT safe for public production traffic until the
 * TODOs below are resolved.
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

/**
 * TENANT_MEMBERSHIP_TODO (Phase 2C.5 — closed in Phase 2C.6 for CourtLens routes):
 *
 * `requireOrgAccess` does not verify that `userId` is a member of `orgId`.
 * Combined with the client-controllable `x-org-id` header, an authenticated
 * user can currently access matters for any org.
 *
 * For CourtLens routes, use `requireVerifiedOrgAccess` (below) instead.
 * The legacy `requireOrgAccess` is retained for the older ABR incident routes
 * and remains safe for dev/test/pilot behind trusted-network conditions.
 *
 * Before those legacy routes ship to public production traffic, migrate
 * them to `requireVerifiedOrgAccess`.
 */
export async function requireOrgAccess(
  req: NextRequest | Request,
): Promise<
  | { ok: true; userId: string; orgId: string; orgSource: 'header' | 'demo-default' }
  | { ok: false; response: NextResponse }
> {
  return authenticateWithOrg(req)
}

/**
 * ROLE_SOURCE_TODO (Phase 2C.5 — closed in Phase 2C.6 for CourtLens routes):
 *
 * `requirePermission` reads `x-abr-role` from the request headers. In
 * production, this MUST be replaced with a role derived from the server-side
 * session or org membership record, never from a client-controlled header.
 *
 * For CourtLens routes, use `requireVerifiedPermission` (below) instead.
 * The legacy `requirePermission` is retained for the older ABR incident routes
 * and remains safe for dev/test/pilot behind trusted-network conditions.
 *
 * Before those legacy routes ship to public production traffic, migrate
 * them to `requireVerifiedPermission`.
 */
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

// ── Phase 2C.6 trusted guards ───────────────────────────────────────────────
//
// These guards close ROLE_SOURCE_TODO and TENANT_MEMBERSHIP_TODO for the
// CourtLens routes. They:
//   1. Authenticate via platform-auth session (userId is trusted).
//   2. Verify that the authenticated user has an active membership in the
//      requested org (via verifyAbrOrgMembership).
//   3. Derive the ABR role from the verified membership record.
//   4. Ignore browser-supplied x-abr-role in production.
//
// Prefer these for any new CourtLens route. The legacy `requireOrgAccess` and
// `requirePermission` above remain for existing ABR incident routes and are
// safe only for dev/test/pilot behind trusted-network conditions.

import { verifyAbrOrgMembership, resolveAbrRoleForRequest, type MembershipSource } from '@/lib/trusted-auth'

export interface VerifiedAuthContext {
  userId: string
  orgId: string
  orgSource: 'header' | 'demo-default'
  role: AbrRole
  membershipSource: MembershipSource | 'x_abr_role_dev_header'
}

/**
 * Trusted org access guard.
 * Authenticates the user, resolves the requested org from `x-org-id`
 * (or demo default), then verifies membership server-side.
 * Fails closed if the user is not an active member of the requested org.
 */
export async function requireVerifiedOrgAccess(
  req: NextRequest | Request,
): Promise<
  | { ok: true; context: VerifiedAuthContext }
  | { ok: false; response: NextResponse }
> {
  const withOrg = await authenticateWithOrg(req)
  if (!withOrg.ok) return withOrg

  const membership = await verifyAbrOrgMembership(withOrg.userId, withOrg.orgId)
  if (!membership.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Org access denied',
          code: 'ORG_MEMBERSHIP_REQUIRED',
          reason: membership.reason,
        },
        { status: 403 },
      ),
    }
  }

  const roleResolution = resolveAbrRoleForRequest(req, membership)

  return {
    ok: true,
    context: {
      userId: withOrg.userId,
      orgId: withOrg.orgId,
      orgSource: withOrg.orgSource,
      role: roleResolution.role,
      membershipSource: roleResolution.source,
    },
  }
}

/**
 * Trusted permission gate.
 * Requires an already-verified org context and checks that the trusted role
 * has the given permission. This never consults browser-supplied role headers
 * in production because the role in the context is always server-derived.
 */
export function requireVerifiedPermission(
  context: VerifiedAuthContext,
  permission: AbrPermission,
):
  | { ok: true }
  | { ok: false; response: NextResponse } {
  if (!hasPermission(context.role, permission)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Forbidden',
          code: 'INSUFFICIENT_PERMISSION',
          permission,
          role: context.role,
        },
        { status: 403 },
      ),
    }
  }
  return { ok: true }
}
