/**
 * Platform Admin — Ticket-Type Field Item API
 *
 *   PATCH  /api/itsm-config/ticket-types/[type]/fields/[fieldId]
 *   DELETE /api/itsm-config/ticket-types/[type]/fields/[fieldId]
 *
 * The `type` path segment is informational only — the field id alone
 * uniquely identifies the row within the org. We still validate that the
 * row belongs to the URL ticket type to avoid cross-type tampering.
 */
import { NextRequest, NextResponse } from 'next/server'
import { TICKET_TYPES } from '@nzila/itsm-core'
import { withOrgWrite } from '../../../../../../../lib/org-scope-guard'
import {
  deleteFieldDef,
  updateFieldDef,
  updateFieldDefSchema,
} from '../../../../../../../lib/ticket-type-queries'
import { recordItsmAudit } from '../../../../../../../lib/itsm-audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ALLOWED: ReadonlySet<string> = new Set(TICKET_TYPES)

function badType() {
  return NextResponse.json(
    { ok: false, error: { code: 'INVALID_TICKET_TYPE', message: 'Unknown ticket type' } },
    { status: 400 },
  )
}

function badId() {
  return NextResponse.json(
    { ok: false, error: { code: 'INVALID_ID', message: 'Invalid field id' } },
    { status: 400 },
  )
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; fieldId: string }> },
) {
  const { type, fieldId } = await params
  if (!ALLOWED.has(type)) return badType()
  if (!UUID_RE.test(fieldId)) return badId()

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
    const parsed = updateFieldDefSchema.safeParse(body)
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

    const result = await updateFieldDef(ctx.orgId, fieldId, parsed.data)
    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: result.error, message: 'Field definition not found' },
        },
        { status: 404 },
      )
    }
    if (result.data.ticketType !== type) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'TYPE_MISMATCH',
            message: 'Field does not belong to the URL ticket type',
          },
        },
        { status: 400 },
      )
    }
    await recordItsmAudit({
      orgId: ctx.orgId,
      actorId: ctx.actorId,
      actorRole: ctx.orgRole,
      actionType: 'itsm.ticket_field_def.updated',
      resourceType: 'itsm_ticket_field_def',
      resourceId: fieldId,
      input: parsed.data,
      outcome: { id: fieldId, ticketType: result.data.ticketType },
    })
    return NextResponse.json({ ok: true, data: result.data })
  })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; fieldId: string }> },
) {
  const { type, fieldId } = await params
  if (!ALLOWED.has(type)) return badType()
  if (!UUID_RE.test(fieldId)) return badId()

  return withOrgWrite(request, async (ctx) => {
    const row = await deleteFieldDef(ctx.orgId, fieldId)
    if (!row) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Field not found' } },
        { status: 404 },
      )
    }
    await recordItsmAudit({
      orgId: ctx.orgId,
      actorId: ctx.actorId,
      actorRole: ctx.orgRole,
      actionType: 'itsm.ticket_field_def.deleted',
      resourceType: 'itsm_ticket_field_def',
      resourceId: fieldId,
      input: {},
      outcome: { id: fieldId, ticketType: type },
    })
    return NextResponse.json({ ok: true, data: { id: fieldId } })
  })
}
