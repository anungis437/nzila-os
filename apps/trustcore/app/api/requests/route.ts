import { NextRequest, NextResponse } from 'next/server'
import { withRequiredRole } from '@/lib/rbac/requireRole'
import {
  listTrustcoreDsrRequests,
  createTrustcoreDsrRequest,
} from '@nzila/db/queries/trustcore'
import { logEvent } from '@/lib/evidence/logEvent'
import { createDsrRequestSchema } from '@/lib/validation/dsrRequest'

// Law 25: DSR responses due within 30 days
const DSR_DUE_DAYS = 30

export const GET = withRequiredRole(
  ['org_admin', 'auditor', 'staff', 'platform_admin'],
  async (_request: NextRequest, ctx) => {
    const data = await listTrustcoreDsrRequests(ctx.orgId)
    return NextResponse.json({ success: true, data, meta: { orgId: ctx.orgId, total: data.length } })
  },
)

export const POST = withRequiredRole(
  ['org_admin', 'staff', 'platform_admin'],
  async (request: NextRequest, ctx) => {
    const body: unknown = await request.json()
    const parsed = createDsrRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', issues: parsed.error.issues },
        { status: 400 },
      )
    }
    const now = new Date()
    const dueAt = new Date(now.getTime() + DSR_DUE_DAYS * 24 * 60 * 60 * 1000)
    const dsr = await createTrustcoreDsrRequest({
      orgId: ctx.orgId,
      ...parsed.data,
      receivedAt: now,
      dueAt,
    })
    await logEvent({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: 'dsr_request',
      entityId: dsr.id,
      action: 'dsr_created',
      metadata: {
        requesterEmail: dsr.requesterEmail,
        requestType: dsr.requestType,
        dueAt: dsr.dueAt.toISOString(),
      },
    })
    return NextResponse.json({ success: true, data: dsr }, { status: 201 })
  },
)

