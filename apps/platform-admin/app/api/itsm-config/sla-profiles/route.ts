/**
 * Platform Admin — ITSM SLA Profiles API
 *
 * GET  /api/itsm-config/sla-profiles   — list org's SLA profiles
 * POST /api/itsm-config/sla-profiles   — create a new SLA profile
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  withOrgScope,
  withOrgWrite,
} from '../../../../lib/org-scope-guard'
import {
  listSlaProfiles,
  createSlaProfile,
  createSlaProfileSchema,
} from '../../../../lib/itsm-queries'
import { recordItsmAudit } from '../../../../lib/itsm-audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return withOrgScope(request, async (ctx) => {
    const profiles = await listSlaProfiles(ctx.orgId)
    return NextResponse.json({ ok: true, data: profiles })
  })
}

export async function POST(request: NextRequest) {
  const idempotencyKey = request.headers.get('Idempotency-Key')
  if (!idempotencyKey || idempotencyKey.trim().length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'IDEMPOTENCY_KEY_REQUIRED',
          message: 'Idempotency-Key header is required',
        },
      },
      { status: 400 },
    )
  }

  return withOrgWrite(request, async (ctx) => {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_JSON', message: 'Body must be JSON' } },
        { status: 400 },
      )
    }
    const parsed = createSlaProfileSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid SLA profile payload',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 },
      )
    }
    const row = await createSlaProfile(ctx.orgId, parsed.data)
    await recordItsmAudit({
      orgId: ctx.orgId,
      actorId: ctx.actorId,
      actorRole: ctx.orgRole,
      actionType: 'itsm.sla_profile.created',
      resourceType: 'itsm_sla_profile',
      resourceId: row.id,
      input: parsed.data,
      outcome: { id: row.id, name: row.name },
    })
    return NextResponse.json({ ok: true, data: row }, { status: 201 })
  })
}
