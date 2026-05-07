/**
 * API route guards — TrustCore app.
 *
 * Centralises auth boilerplate for TrustCore API routes, combining
 * platform authentication, org membership verification, and role checks.
 *
 * Re-exports withRequiredRole from lib/rbac/requireRole for convenience.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@nzila/platform-auth/entra/server'

// ── Re-exports ───────────────────────────────────────────────────────────────
export { withRequiredRole } from '@/lib/rbac/requireRole'

export interface TrustCoreAuthContext {
  userId: string
  orgId: string
}

/**
 * Authenticate the current request and resolve the org context.
 * Returns a TrustCoreAuthContext or a NextResponse error (401/403).
 */
export async function authenticateRequest(
  req: NextRequest,
): Promise<{ ok: true; ctx: TrustCoreAuthContext } | { ok: false; response: NextResponse }> {
  const session = await auth()
  if (!session?.userId) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const orgId = req.headers.get('x-org-id') ?? session.activeOrgId
  if (!orgId) {
    return { ok: false, response: NextResponse.json({ error: 'Org context required' }, { status: 403 }) }
  }

  return { ok: true, ctx: { userId: session.userId, orgId } }
}
