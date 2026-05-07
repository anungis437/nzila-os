import { NextRequest, NextResponse } from 'next/server'
import { withRequiredRole } from '@/lib/rbac/requireRole'
import {
  listTrustcoreIncidents,
  createTrustcoreIncident,
} from '@nzila/db/queries/trustcore'
import { logEvent } from '@/lib/evidence/logEvent'
import { createIncidentSchema } from '@/lib/validation/incident'
import { withNzilaSpan } from '@nzila/otel-core'
import { buildPlatformEvent } from '@nzila/platform-event-fabric'

export const GET = withRequiredRole(
  ['org_admin', 'auditor', 'staff', 'platform_admin'],
  async (_request: NextRequest, ctx) =>
    withNzilaSpan('trustcore.incident.list', ctx.orgId, async () => {
      const data = await listTrustcoreIncidents(ctx.orgId)
      return NextResponse.json({ success: true, data, meta: { orgId: ctx.orgId, total: data.length } })
    }),
)

export const POST = withRequiredRole(
  ['org_admin', 'staff', 'platform_admin'],
  async (request: NextRequest, ctx) => {
    const body: unknown = await request.json()
    const parsed = createIncidentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', issues: parsed.error.issues },
        { status: 400 },
      )
    }
    return withNzilaSpan('trustcore.incident.create', ctx.orgId, async () => {
      const incident = await createTrustcoreIncident({
        orgId: ctx.orgId,
        ...parsed.data,
        dateDetected: new Date(parsed.data.dateDetected),
      })
      await logEvent({
        orgId: ctx.orgId,
        actorId: ctx.userId,
        entityType: 'incident',
        resourceId: incident.id,
        action: 'incident_logged',
        metadata: {
          title: incident.title,
          incidentType: incident.incidentType,
          severity: incident.severity,
          seriousHarmLikely: incident.seriousHarmLikely,
        },
      })
      buildPlatformEvent({
        type: 'trustcore.incident.logged',
        payload: { id: incident.id, title: incident.title, incidentType: incident.incidentType, severity: incident.severity, seriousHarmLikely: incident.seriousHarmLikely },
        tenantId: ctx.orgId,
        orgId: ctx.orgId,
        actorId: ctx.userId,
        source: '@nzila/trustcore',
      })
      return NextResponse.json({ success: true, data: incident }, { status: 201 })
    })
  },
)

