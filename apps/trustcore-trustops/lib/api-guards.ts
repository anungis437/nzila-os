/**
 * Shared API route guards — TrustCore TrustOps.
 *
 * Mirrors apps/zonga/lib/api-guards.ts but trimmed to the surface
 * trustcore-trustops uses today: authentication, request context,
 * and org-scope HTTP wrapper.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@nzila/platform-auth/entra/server'
import {
  createRequestContext,
  runWithContext,
} from '@nzila/os-core/telemetry'
import { getOrganizationIdForUser } from './organization-utils'

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

// ── Request Context wrapper ─────────────────────────────────────────────────

export async function withRequestContext<T>(
  req: NextRequest | Request,
  handler: () => Promise<T>,
): Promise<T> {
  const ctx = createRequestContext(req, { appName: 'trustcore-trustops' })
  return runWithContext(ctx, handler)
}

// ── Org-scoped HTTP wrapper ─────────────────────────────────────────────────

/**
 * `withOrgScope(req, handler)` — wrap a Next.js route handler with:
 *   1. Request context (tracing, requestId).
 *   2. Authenticated user.
 *   3. Resolved app-level org UUID via `getOrganizationIdForUser`.
 *
 * Returns 401 if unauthenticated, 403 if no active org is selected.
 *
 * IMPORTANT: do NOT use `auth().orgId` — it returns the user's first
 * Entra security-group GUID, not the app-level `orgs.id`.
 */
export async function withOrgScope(
  req: NextRequest | Request,
  handler: (ctx: { userId: string; orgId: string }) => Promise<NextResponse>,
): Promise<NextResponse> {
  return withRequestContext(req, async () => {
    const authResult = await authenticateUser()
    if (!authResult.ok) return authResult.response

    const orgId = await getOrganizationIdForUser(authResult.userId)
    if (!orgId) {
      return NextResponse.json(
        {
          error: 'Org scope required',
          message:
            'Select an active organization before accessing this resource.',
          code: 'ORG_SCOPE_REQUIRED',
        },
        { status: 403 },
      )
    }

    return handler({ userId: authResult.userId, orgId })
  })
}
