import { NextRequest, NextResponse } from 'next/server'
import { withRequiredRole } from '@/lib/rbac/requireRole'
import {
  listTrustcorePias,
  createTrustcorePia,
} from '@nzila/db/queries/trustcore'
import { logEvent } from '@/lib/evidence/logEvent'
import { createPiaSchema } from '@/lib/validation/pia'
import { withNzilaSpan } from '@nzila/otel-core'
import { buildPlatformEvent } from '@nzila/platform-event-fabric'

export const GET = withRequiredRole(
  ['org_admin', 'auditor', 'staff', 'platform_admin'],
  async (_request: NextRequest, ctx) =>
    withNzilaSpan('trustcore.pia.list', ctx.orgId, async () => {
      const data = await listTrustcorePias(ctx.orgId)
      return NextResponse.json({ success: true, data, meta: { orgId: ctx.orgId, total: data.length } })
    }),
)

export const POST = withRequiredRole(
  ['org_admin', 'staff', 'platform_admin'],
  async (request: NextRequest, ctx) => {
    const body: unknown = await request.json()
    const parsed = createPiaSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', issues: parsed.error.issues },
        { status: 400 },
      )
    }
    return withNzilaSpan('trustcore.pia.create', ctx.orgId, async () => {
      const pia = await createTrustcorePia({ orgId: ctx.orgId, ...parsed.data })
      await logEvent({
        orgId: ctx.orgId,
        actorId: ctx.userId,
        entityType: 'pia',
        resourceId: pia.id,
        action: 'pia_created',
        metadata: { title: pia.title, triggerType: pia.triggerType, riskScore: pia.riskScore },
      })
      buildPlatformEvent({
        type: 'trustcore.pia.created',
        payload: { id: pia.id, title: pia.title, triggerType: pia.triggerType, riskScore: pia.riskScore },
        tenantId: ctx.orgId,
        orgId: ctx.orgId,
        actorId: ctx.userId,
        source: '@nzila/trustcore',
      })
      return NextResponse.json({ success: true, data: pia }, { status: 201 })
    })
  },
)

