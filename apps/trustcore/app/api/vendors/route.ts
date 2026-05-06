import { NextRequest, NextResponse } from 'next/server'
import { withRequiredRole } from '@/lib/rbac/requireRole'
import {
  listTrustcoreVendors,
  createTrustcoreVendor,
} from '@nzila/db/queries/trustcore'
import { logEvent } from '@/lib/evidence/logEvent'
import { createVendorSchema } from '@/lib/validation/vendor'
import { withNzilaSpan } from '@nzila/otel-core'

export const GET = withRequiredRole(
  ['org_admin', 'auditor', 'staff', 'platform_admin'],
  async (_request: NextRequest, ctx) =>
    withNzilaSpan('trustcore.vendor.list', ctx.orgId, async () => {
      const data = await listTrustcoreVendors(ctx.orgId)
      return NextResponse.json({ success: true, data, meta: { orgId: ctx.orgId, total: data.length } })
    }),
)

export const POST = withRequiredRole(
  ['org_admin', 'staff', 'platform_admin'],
  async (request: NextRequest, ctx) => {
    const body: unknown = await request.json()
    const parsed = createVendorSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', issues: parsed.error.issues },
        { status: 400 },
      )
    }
    return withNzilaSpan('trustcore.vendor.create', ctx.orgId, async () => {
      const vendor = await createTrustcoreVendor({ orgId: ctx.orgId, ...parsed.data })
      await logEvent({
        orgId: ctx.orgId,
        actorId: ctx.userId,
        entityType: 'vendor',
        entityId: vendor.id,
        action: 'vendor_added',
        metadata: {
          name: vendor.name,
          country: vendor.country,
          riskLevel: vendor.riskLevel,
          crossBorderTransfer: vendor.crossBorderTransfer,
        },
      })
      return NextResponse.json({ success: true, data: vendor }, { status: 201 })
    })
  },
)

