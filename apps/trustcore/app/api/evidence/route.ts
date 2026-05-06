import { NextRequest, NextResponse } from 'next/server'
import { withRequiredRole } from '@/lib/rbac/requireRole'
import {
  listTrustcoreEvidenceEvents,
  createTrustcoreEvidenceEvent,
} from '@nzila/db/queries/trustcore'
import { z } from 'zod'

const createEventSchema = z.object({
  actorId: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  action: z.string().min(1),
  summary: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const GET = withRequiredRole(
  ['org_admin', 'auditor', 'staff', 'platform_admin'],
  async (_request: NextRequest, ctx) => {
    const data = await listTrustcoreEvidenceEvents(ctx.orgId)
    return NextResponse.json({ success: true, data, meta: { orgId: ctx.orgId, total: data.length } })
  },
)

export const POST = withRequiredRole(
  ['org_admin', 'platform_admin'],
  async (request: NextRequest, ctx) => {
    const body: unknown = await request.json()
    const parsed = createEventSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', issues: parsed.error.issues },
        { status: 400 },
      )
    }
    const event = await createTrustcoreEvidenceEvent({
      orgId: ctx.orgId,
      ...parsed.data,
    })
    return NextResponse.json({ success: true, data: event }, { status: 201 })
  },
)

