import { NextRequest, NextResponse } from 'next/server'
import { withRequiredRole } from '@/lib/rbac/requireRole'
import {
  listTrustcoreDataAssets,
  createTrustcoreDataAsset,
} from '@nzila/db/queries/trustcore'
import { logEvent } from '@/lib/evidence/logEvent'
import { createDataAssetSchema } from '@/lib/validation/dataAsset'

export const GET = withRequiredRole(
  ['org_admin', 'auditor', 'staff', 'platform_admin'],
  async (_request: NextRequest, ctx) => {
    const data = await listTrustcoreDataAssets(ctx.orgId)
    return NextResponse.json({ success: true, data, meta: { orgId: ctx.orgId, total: data.length } })
  },
)

export const POST = withRequiredRole(
  ['org_admin', 'staff', 'platform_admin'],
  async (request: NextRequest, ctx) => {
    const body: unknown = await request.json()
    const parsed = createDataAssetSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', issues: parsed.error.issues },
        { status: 400 },
      )
    }
    const asset = await createTrustcoreDataAsset({ orgId: ctx.orgId, ...parsed.data })
    await logEvent({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: 'data_asset',
      entityId: asset.id,
      action: 'data_asset_created',
      metadata: { name: asset.name, dataCategory: asset.dataCategory, sensitivityLevel: asset.sensitivityLevel },
    })
    return NextResponse.json({ success: true, data: asset }, { status: 201 })
  },
)

