import { buildAuditInsightsCsv } from '@/lib/services/audit-inspection-service'
/**
 * Nzila OS — Audit Insights CSV Export
 *
 * Returns aggregated audit data as CSV download.
 * Platform admin sees all; org-scoped users see only their org.
 */
import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser, getOrgMembership } from '@/lib/api-guards'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authResult = await authenticateUser()
  if (!authResult.ok) return authResult.response

  const { platformRole, userId } = authResult
  const isPlatformAdmin = platformRole === 'platform_admin' || platformRole === 'studio_admin'
  const orgId = req.nextUrl.searchParams.get('orgId')

  if (!isPlatformAdmin && !orgId) {
    return NextResponse.json({ error: 'orgId is required for non-platform users' }, { status: 400 })
  }

  if (!isPlatformAdmin && orgId) {
    const membership = await getOrgMembership(orgId, userId)
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const csv = await buildAuditInsightsCsv(orgId)

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="audit-insights-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
