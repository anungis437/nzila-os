import { NextRequest, NextResponse } from 'next/server'
import { withRequiredRole } from '@/lib/rbac/requireRole'
import { evaluateCompliance } from '@/lib/compliance/engine'

export const GET = withRequiredRole(
  ['org_admin', 'auditor', 'staff', 'platform_admin'],
  async (_request: NextRequest, ctx) => {
    const evaluation = await evaluateCompliance(ctx.orgId)
    return NextResponse.json({ success: true, data: evaluation })
  },
)
