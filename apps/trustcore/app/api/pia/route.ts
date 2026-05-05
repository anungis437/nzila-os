import { NextRequest, NextResponse } from 'next/server'
import { withRequiredRole } from '@/lib/rbac/requireRole'
import {
  listTrustcorePias,
  createTrustcorePia,
} from '@nzila/db/queries/trustcore'
import { logEvent } from '@/lib/evidence/logEvent'
import { createPiaSchema } from '@/lib/validation/pia'

export const GET = withRequiredRole(
  ['org_admin', 'auditor', 'staff', 'platform_admin'],
  async (_request: NextRequest, ctx) => {
    const data = await listTrustcorePias(ctx.orgId)
    return NextResponse.json({ success: true, data, meta: { orgId: ctx.orgId, total: data.length } })
  },
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
    const pia = await createTrustcorePia({ orgId: ctx.orgId, ...parsed.data })
    await logEvent({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: 'pia',
      entityId: pia.id,
      action: 'pia_created',
      metadata: { title: pia.title, triggerType: pia.triggerType, riskScore: pia.riskScore },
    })
    return NextResponse.json({ success: true, data: pia }, { status: 201 })
  },
)

