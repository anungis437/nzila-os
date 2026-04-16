/**
 * Control Plane API — Entitlement Resolution
 *
 * POST /api/control-plane/authority/entitlements
 *
 * The canonical entitlement resolution endpoint. All apps must call this
 * to determine whether an org is entitled to a feature.
 *
 * No app may evaluate entitlements locally.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'
import { resolveEntitlements, resolveEntitlementsBulk } from '@/server/authority/entitlements'
import { createLogger } from '@nzila/os-core'

export const dynamic = 'force-dynamic'

const logger = createLogger('control-plane:api:authority:entitlements')

const SingleQuerySchema = z.object({
  orgId: z.string().uuid(),
  feature: z.string().min(1),
  actorId: z.string().optional(),
})

const BulkQuerySchema = z.object({
  orgId: z.string().uuid(),
  features: z.array(z.string().min(1)).min(1).max(50),
  actorId: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    await requireApiAuth(request)
  } catch (err) {
    return handleAuthError(err)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } },
      { status: 400 },
    )
  }

  // Try bulk first, then single
  const bulkParsed = BulkQuerySchema.safeParse(body)
  if (bulkParsed.success) {
    const { orgId, features, actorId } = bulkParsed.data
    logger.info('Bulk entitlement resolution', { orgId, featureCount: features.length })
    const results = await resolveEntitlementsBulk(orgId, features, actorId)
    return NextResponse.json({ ok: true, data: results })
  }

  const singleParsed = SingleQuerySchema.safeParse(body)
  if (!singleParsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request must include orgId + feature (single) or orgId + features[] (bulk)',
          details: singleParsed.error.flatten(),
        },
      },
      { status: 400 },
    )
  }

  const result = await resolveEntitlements(singleParsed.data)
  logger.info('Single entitlement resolved', {
    orgId: result.orgId,
    feature: result.feature,
    granted: result.granted,
  })
  return NextResponse.json({ ok: true, data: result })
}
