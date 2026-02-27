/**
 * Nzila OS — Unified Org Data Export API
 *
 * Streams org data as a JSON response (exportable datasets).
 * Org admin can export own org only; platform admin can export any org.
 */
import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser, getEntityMembership } from '@/lib/api-guards'
import { exportOrgData, datasetToCsv } from '@nzila/platform-export'
import { recordAuditEvent, AUDIT_ACTIONS } from '@/lib/audit-db'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await authenticateUser()
  if (!authResult.ok) return authResult.response

  const { userId, platformRole } = authResult
  const { id: orgId } = await params
  const isPlatformAdmin = platformRole === 'platform_admin' || platformRole === 'studio_admin'

  // Org admin can export own org only
  if (!isPlatformAdmin) {
    const membership = await getEntityMembership(orgId, userId)
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Record the export request as an audit event
  await recordAuditEvent({
    entityId: orgId,
    actorClerkUserId: userId,
    actorRole: platformRole,
    action: AUDIT_ACTIONS.DATA_EXPORT_REQUEST,
    targetType: 'org_export',
    afterJson: { format: 'csv-zip' },
  })

  const data = await exportOrgData(orgId)

  // Build a multi-part CSV response (simplified: JSON with CSV sections)
  const sections: Record<string, string> = {
    claims: datasetToCsv(data.claims),
    revenue: datasetToCsv(data.revenue),
    quotes: datasetToCsv(data.quotes),
    auditEvents: datasetToCsv(data.auditEvents),
  }

  // Stream as JSON with embedded CSVs (for large datasets, a zip streamer would be better)
  return NextResponse.json({
    orgName: data.orgName,
    exportedAt: new Date().toISOString(),
    sections,
  })
}
