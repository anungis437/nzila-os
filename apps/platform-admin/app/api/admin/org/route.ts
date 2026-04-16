/**
 * Platform Admin — Org Admin API
 *
 * GET  /api/admin/org       — Resolve org context (entitlements, decisions)
 * POST /api/admin/org/check-entitlement — Check org feature entitlement via CP
 *
 * All routes are strictly org-scoped. Cross-org access is blocked.
 * All mutations flow through the Control Plane client.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireOrgScope, handleOrgScopeError } from '../../../../lib/org-scope-guard'
import { getOrgScopedCpClient } from '../../../../lib/control-plane-client'

// GET /api/admin/org?orgId=<uuid>
export async function GET(request: NextRequest) {
  try {
    const context = await requireOrgScope(request)
    const cp = getOrgScopedCpClient(context.orgId)

    const [decisions] = await Promise.all([
      cp.getOrgDecisions(),
    ])

    return NextResponse.json({
      ok: true,
      data: {
        orgId: context.orgId,
        actorId: context.actorId,
        orgRole: context.orgRole,
        recentDecisions: decisions.slice(0, 10),
      },
    })
  } catch (error) {
    return handleOrgScopeError(error)
  }
}

// POST /api/admin/org — check entitlement
export async function POST(request: NextRequest) {
  try {
    const context = await requireOrgScope(request)
    const body = await request.json() as { feature?: string }

    if (!body.feature || typeof body.feature !== 'string') {
      return NextResponse.json(
        { ok: false, error: { code: 'MISSING_FEATURE', message: 'feature is required' } },
        { status: 400 },
      )
    }

    const cp = getOrgScopedCpClient(context.orgId)
    const entitlement = await cp.checkEntitlement(body.feature, context.actorId)

    return NextResponse.json({ ok: true, data: entitlement })
  } catch (error) {
    return handleOrgScopeError(error)
  }
}
