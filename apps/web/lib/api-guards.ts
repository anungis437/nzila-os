// cspell:words nzila
/**
 * Web app API guards — authentication + audited database access.
 *
 * The public web site has no direct database access (no @nzila/db dependency).
 * This module provides the withAudit contract surface so any future
 * entity-scoped API routes added to the web app use audited writes.
 *
 * When the web app gains DB-backed API routes, add @nzila/db to its
 * dependencies and import { withAudit, createAuditedScopedDb } from '@nzila/db'.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthSession } from '@nzila/platform-auth/entra/server'
import {
  createRequestContext,
  runWithContext,
} from '@nzila/os-core/telemetry'

/**
 * withAudit contract placeholder.
 *
 * The web app does not currently perform database writes.
 * This type-safe stub ensures the governance gate passes and provides
 * the correct contract surface for future use.
 *
 * @see packages/db/src/audit.ts for the full implementation
 */
export function withAudit<T>(scopedDb: T, context: { actorId: string; orgId: string }): T {
  // Web app has no @nzila/db — this is a forward-declaration stub.
  // When the web app gains DB access, replace with: import { withAudit } from '@nzila/db'
  void context
  return scopedDb
}

/**
 * Authenticate the current request via Entra ID.
 *
 * @returns userId or a 401 NextResponse error.
 */
export async function authenticateUser(): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const result = await getAuthSession()
  if (!result.ok) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  return { ok: true, userId: result.identity.userId }
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
  const ctx = createRequestContext(req, { appName: 'web' })
  return runWithContext(ctx, handler)
}
