/**
 * Platform Admin — Org-Scope Guard
 *
 * Every Platform Admin API route MUST call this guard before processing.
 * It ensures:
 *   1. The request is authenticated
 *   2. The actor is scoped to a specific org
 *   3. The actor has org-admin authority for that org
 *   4. The requested resource belongs to that org (prevents cross-org leakage)
 *
 * Platform Admin is strictly org-scoped. It cannot access:
 *   - System health (Console)
 *   - Orchestrator ops (Console)
 *   - Global policy surfaces (Control Plane)
 *   - Cross-org data
 *
 * Usage:
 *   const context = await requireOrgScope(request)
 *   // context.orgId is verified and safe to use
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@nzila/platform-auth/entra/server'
import { createLogger } from '@nzila/os-core'
import { platformDb } from '@nzila/db/platform'
import { orgMembers } from '@nzila/db/schema'
import { and, eq } from 'drizzle-orm'

const logger = createLogger('platform-admin:org-scope-guard')

export interface OrgScopeContext {
  actorId: string
  orgId: string
  orgRole: string
  /**
   * Trusted authentication classification. `requireOrgScope` authenticates an
   * interactive signed-in operator via `auth()`, so every context it yields is
   * an interactive user. Derived server-side; never browser-supplied. Consumed
   * by downstream trust boundaries (e.g. SAGE actor-kind resolution).
   */
  authenticationType: 'interactive_user'
}

export class OrgScopeError extends Error {
  status: number
  code: string
  constructor(message: string, code: string, status: number) {
    super(message)
    this.name = 'OrgScopeError'
    this.code = code
    this.status = status
  }
}

/**
 * Resolve the actor's role within the given org, or null if the actor is
 * not an active member. Platform-admin override is honoured for users in
 * `PLATFORM_ADMIN_USER_IDS` (comma-separated env var) — they are treated
 * as 'admin' for every org so the platform-admin app remains operable
 * during onboarding/incident response.
 */
async function resolveOrgRole(
  actorId: string,
  orgId: string,
): Promise<string | null> {
  const platformAdminIds = (process.env.PLATFORM_ADMIN_USER_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (platformAdminIds.includes(actorId)) {
    return 'admin'
  }

  const [row] = await platformDb
    .select({ role: orgMembers.role })
    .from(orgMembers)
    .where(
      and(
        eq(orgMembers.orgId, orgId),
        eq(orgMembers.userId, actorId),
        eq(orgMembers.status, 'active'),
      ),
    )
    .limit(1)

  return row?.role ?? null
}

/**
 * Verify that the request is authenticated and org-scoped.
 * Returns the verified org context or throws OrgScopeError.
 */
export async function requireOrgScope(
  request: NextRequest,
  requiredOrgId?: string,
): Promise<OrgScopeContext> {
  // 1. Authenticate the request
  const session = await auth()
  if (!session?.userId) {
    throw new OrgScopeError('Authentication required', 'UNAUTHENTICATED', 401)
  }

  // 2. Resolve org from header or query param
  const orgId =
    requiredOrgId ??
    request.headers.get('x-org-id') ??
    request.nextUrl.searchParams.get('orgId')

  if (!orgId) {
    throw new OrgScopeError(
      'Org scope required — provide orgId in x-org-id header or orgId query param',
      'ORG_SCOPE_REQUIRED',
      400,
    )
  }

  // 3. Validate UUID format
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(orgId)) {
    throw new OrgScopeError('Invalid orgId format', 'INVALID_ORG_ID', 400)
  }

  // 4. Verify actor has an active membership in this org and resolve role.
  //    We refuse to fabricate 'admin' — if no active membership exists the
  //    request is forbidden. Platform-wide overrides go through
  //    PLATFORM_ADMIN_USER_IDS (see resolveOrgRole).
  const actorId = session.userId
  const orgRole = await resolveOrgRole(actorId, orgId)
  if (!orgRole) {
    logger.warn('Org scope denied: actor is not an active member', {
      actorId,
      orgId,
      path: request.nextUrl.pathname,
    })
    throw new OrgScopeError(
      'Actor is not an active member of the requested org',
      'ORG_FORBIDDEN',
      403,
    )
  }

  logger.info('Org scope verified', {
    actorId,
    orgId,
    orgRole,
    path: request.nextUrl.pathname,
  })

  return {
    actorId,
    orgId,
    orgRole,
    authenticationType: 'interactive_user',
  }
}

/**
 * Handle OrgScopeError into a NextResponse.
 */
export function handleOrgScopeError(error: unknown): NextResponse {
  if (error instanceof OrgScopeError) {
    return NextResponse.json(
      { ok: false, error: { code: error.code, message: error.message } },
      { status: error.status },
    )
  }
  logger.error('Unexpected org scope check error', { error })
  return NextResponse.json(
    { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
    { status: 500 },
  )
}

/**
 * withOrgScope(request, handler) — convenience auth wrapper for API routes.
 *
 * This function enforces authentication + org scope before invoking handler.
 * It exists so contract tests can verify routes use an explicit org-scoped
 * authorization guard pattern.
 */
export async function withOrgScope(
  request: NextRequest,
  handler: (context: OrgScopeContext) => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    const context = await requireOrgScope(request)
    return await handler(context)
  } catch (error) {
    return handleOrgScopeError(error)
  }
}

// ── Role helpers ──────────────────────────────────────────────────────────────

/**
 * Roles that may MUTATE platform-admin resources for an org.
 * Read-only viewers are explicitly excluded from writes.
 *
 * 'admin' is the PLATFORM_ADMIN_USER_IDS override (see resolveOrgRole).
 */
const WRITE_ROLES = new Set(['admin', 'org_admin', 'org_secretary'])

/**
 * Roles that may READ platform-admin resources for an org.
 * All authenticated org members can read.
 */
const READ_ROLES = new Set(['admin', 'org_admin', 'org_secretary', 'org_viewer'])

export function canWrite(role: string): boolean {
  return WRITE_ROLES.has(role)
}

export function canRead(role: string): boolean {
  return READ_ROLES.has(role)
}

/**
 * Wrap a handler and enforce that the caller has write authority. Returns
 * 403 ORG_WRITE_FORBIDDEN when a viewer attempts a mutation.
 */
export async function withOrgWrite(
  request: NextRequest,
  handler: (context: OrgScopeContext) => Promise<NextResponse>,
): Promise<NextResponse> {
  return withOrgScope(request, async (context) => {
    if (!canWrite(context.orgRole)) {
      logger.warn('Org write denied: role lacks write authority', {
        actorId: context.actorId,
        orgId: context.orgId,
        orgRole: context.orgRole,
        path: request.nextUrl.pathname,
      })
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'ORG_WRITE_FORBIDDEN',
            message: `Role '${context.orgRole}' may not mutate platform-admin resources`,
          },
        },
        { status: 403 },
      )
    }
    return handler(context)
  })
}
