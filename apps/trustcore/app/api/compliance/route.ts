import { NextRequest, NextResponse } from 'next/server'
import { withRequiredRole } from '@/lib/rbac/requireRole'
import { getTrustcoreDashboardSummary } from '@nzila/db/queries/trustcore'

export const GET = withRequiredRole(
  ['org_admin', 'auditor', 'staff', 'platform_admin'],
  async (_request: NextRequest, ctx) => {
    const summary = await getTrustcoreDashboardSummary(ctx.orgId)
    return NextResponse.json({ success: true, data: summary })
  },
)
