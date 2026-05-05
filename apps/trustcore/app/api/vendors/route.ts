import { NextRequest, NextResponse } from 'next/server'
import { withRequiredRole } from '@/lib/rbac/requireRole'
import { listTrustcoreVendors } from '@nzila/db/queries/trustcore'

export const GET = withRequiredRole(
  ['org_admin', 'auditor', 'staff', 'platform_admin'],
  async (_request: NextRequest, ctx) => {
    const data = await listTrustcoreVendors(ctx.orgId)
    return NextResponse.json({ success: true, data, meta: { orgId: ctx.orgId, total: data.length } })
  },
)

export const POST = withRequiredRole(
  ['org_admin', 'platform_admin'],
  async (request: NextRequest, ctx) => {
    const body: unknown = await request.json()
    return NextResponse.json(
      { success: true, data: null, meta: { orgId: ctx.orgId }, received: body },
      { status: 201 },
    )
  },
)

