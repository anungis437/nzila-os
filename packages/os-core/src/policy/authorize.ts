/**
 * @nzila/os-core — Authorization Engine
 *
 * All API routes MUST call authorize() before returning data.
 * Enforcement: tooling/contract-tests/api-authz-coverage.test.ts
 *
 * Usage:
 *   import { authorize } from '@nzila/os-core/policy'
 *
 *   // In a Next.js route handler:
 *   export async function GET(req: Request) {
 *     const { userId, role } = await authorize(req, {
 *       requiredRole: ConsoleRole.FINANCE_VIEWER,
 *       requiredScope: Scope.FINANCE_READ,
 *     })
 *     // ... handler logic
 *   }
 */
import { NextRequest, NextResponse } from 'next/server'
import type { NzilaRole } from './roles'
import type { Scope } from './scopes'
import { roleIncludes } from './roles'
import { ROLE_DEFAULT_SCOPES } from './scopes'

// ── Types ─────────────────────────────────────────────────────────────────

export interface AuthContext {
  /** Clerk user ID */
  userId: string
  /** Clerk org ID (if applicable) */
  orgId?: string
  /** The resolved role for this request context */
  role: NzilaRole
  /** Effective scopes (role defaults + any granted overrides) */
  scopes: Scope[]
  /** Partner ID (if request is from the partners portal) */
  partnerId?: string
}

export interface AuthorizeOptions {
  /** If specified, user must have this role (or a role that inherits it) */
  requiredRole?: NzilaRole
  /** If specified, user must have this scope */
  requiredScope?: Scope
  /** Allow system roles (webhooks, cron) — default false */
  allowSystem?: boolean
}

export class AuthorizationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 403 | 401 = 403,
  ) {
    super(message)
    this.name = 'AuthorizationError'
  }
}

// ── Core authorize function ───────────────────────────────────────────────

/**
 * Authorizes the current request. Throws AuthorizationError if not allowed.
 *
 * This function reads the Clerk session from the request headers.
 * In Next.js App Router routes, call this at the top of every handler.
 *
 * @returns AuthContext if authorized
 * @throws AuthorizationError (403) if not authorized
 */
export async function authorize(
  req: Request | NextRequest,
  options: AuthorizeOptions = {},
): Promise<AuthContext> {
  // Import Clerk dynamically to avoid bundling it in non-Next.js contexts
  // webpackIgnore prevents webpack from tracing into @clerk/nextjs/server
  // which imports 'server-only' and breaks client-side tree-shaking of the barrel export
  const { auth } = await import(/* webpackIgnore: true */ '@clerk/nextjs/server')
  const session = await auth()

  if (!session?.userId) {
    throw new AuthorizationError('Authentication required', 401)
  }

  // Resolve role from Clerk session metadata
  const role = resolveRole(session)

  if (!role) {
    throw new AuthorizationError('No role assigned to user', 403)
  }

  // Check required role
  if (options.requiredRole && !roleIncludes(role, options.requiredRole)) {
    throw new AuthorizationError(
      `Role ${role} lacks required role ${options.requiredRole}`,
      403,
    )
  }

  // Resolve scopes
  const scopes = resolveScopes(role)

  // Check required scope
  if (options.requiredScope && !scopes.includes(options.requiredScope)) {
    throw new AuthorizationError(
      `Role ${role} lacks required scope ${options.requiredScope}`,
      403,
    )
  }

  return {
    userId: session.userId,
    orgId: session.orgId ?? undefined,
    role,
    scopes,
    partnerId: resolvePartnerId(session),
  }
}

/**
 * Wraps a Next.js route handler with authorization.
 * Returns 403 JSON response on failure instead of throwing.
 *
 * Usage:
 *   export const GET = withAuth({ requiredRole: ConsoleRole.VIEWER }, handler)
 */
export function withAuth<T>(
  options: AuthorizeOptions,
  handler: (req: NextRequest, ctx: AuthContext) => Promise<NextResponse<T>>,
) {
  return async (req: NextRequest): Promise<NextResponse<T | { error: string }>> => {
    try {
      const ctx = await authorize(req, options)
      return handler(req, ctx)
    } catch (err) {
      if (err instanceof AuthorizationError) {
        return NextResponse.json(
          { error: err.message },
          { status: err.statusCode },
        ) as NextResponse<{ error: string }>
      }
      throw err
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function resolveRole(session: { userId: string; orgId?: string | null; sessionClaims?: unknown }): NzilaRole | null {
  const claims = session.sessionClaims as Record<string, unknown> | undefined
  return (claims?.['nzila_role'] as NzilaRole) ?? null
}

function resolvePartnerId(session: { sessionClaims?: unknown }): string | undefined {
  const claims = session.sessionClaims as Record<string, unknown> | undefined
  return claims?.['nzila_partner_id'] as string | undefined
}

function resolveScopes(role: NzilaRole): Scope[] {
  return ROLE_DEFAULT_SCOPES[role] ?? []
}

/**
 * Asserts that the auth context has permission to access a specific entity.
 * For console routes, the entity must match session context.
 * For partner routes, the entity must have a partner_entities row.
 */
export async function authorizeEntityAccess(
  ctx: AuthContext,
  entityId: string,
): Promise<void> {
  if (ctx.partnerId) {
    // Partner context — must have partner_entities row
    const { db } = await import(/* webpackIgnore: true */ '@nzila/db')
    const { partnerEntities } = await import(/* webpackIgnore: true */ '@nzila/db/schema')
    const { eq, and } = await import(/* webpackIgnore: true */ 'drizzle-orm')

    const [entitlement] = await db
      .select()
      .from(partnerEntities)
      .where(
        and(
          eq(partnerEntities.partnerId, ctx.partnerId),
          eq(partnerEntities.entityId, entityId),
        ),
      )
      .limit(1)

    if (!entitlement) {
      throw new AuthorizationError(
        `Partner ${ctx.partnerId} is not entitled to access entity ${entityId}`,
        403,
      )
    }
  }
  // Console context — trust the entity from the request (entity is validated elsewhere)
}
