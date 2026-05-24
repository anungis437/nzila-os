/**
 * Platform Admin — Ticket-Type Field Definitions API
 *
 *   GET  /api/itsm-config/ticket-types/[type]/fields           — list field defs
 *   POST /api/itsm-config/ticket-types/[type]/fields           — create a field
 */
import { NextRequest, NextResponse } from 'next/server'
import { TICKET_TYPES, type TicketType } from '@nzila/itsm-core'
import { withOrgScope, withOrgWrite } from '../../../../../../lib/org-scope-guard'
import {
  createFieldDef,
  createFieldDefSchema,
  listFieldDefsForType,
} from '../../../../../../lib/ticket-type-queries'
import { recordItsmAudit } from '../../../../../../lib/itsm-audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED: ReadonlySet<string> = new Set(TICKET_TYPES)

function badType() {
  return NextResponse.json(
    { ok: false, error: { code: 'INVALID_TICKET_TYPE', message: 'Unknown ticket type' } },
    { status: 400 },
  )
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params
  if (!ALLOWED.has(type)) return badType()
  return withOrgScope(request, async (ctx) => {
    const fields = await listFieldDefsForType(ctx.orgId, type as TicketType)
    return NextResponse.json({ ok: true, data: fields })
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params
  if (!ALLOWED.has(type)) return badType()

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
    // Force ticketType from the URL — the caller cannot specify a different one.
    const withType = { ...(body as Record<string, unknown>), ticketType: type }
    const parsed = createFieldDefSchema.safeParse(withType)
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid field definition payload',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 },
      )
    }

    const result = await createFieldDef(ctx.orgId, parsed.data)
    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: result.error,
            message:
              result.error === 'FIELD_KEY_TAKEN'
                ? `A field with key "${parsed.data.fieldKey}" already exists for this ticket type`
                : 'Operation failed',
          },
        },
        { status: result.error === 'FIELD_KEY_TAKEN' ? 409 : 400 },
      )
    }

    await recordItsmAudit({
      orgId: ctx.orgId,
      actorId: ctx.actorId,
      actorRole: ctx.orgRole,
      actionType: 'itsm.ticket_field_def.created',
      resourceType: 'itsm_ticket_field_def',
      resourceId: result.data.id,
      input: parsed.data,
      outcome: {
        id: result.data.id,
        ticketType: result.data.ticketType,
        fieldKey: result.data.fieldKey,
      },
    })
    return NextResponse.json({ ok: true, data: result.data }, { status: 201 })
  })
}
