// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Meetings
 * GET  /api/entities/[entityId]/meetings   → list meetings
 * POST /api/entities/[entityId]/meetings   → create meeting
 */
import { NextRequest, NextResponse } from 'next/server'
import { platformDb } from '@nzila/db/platform'
import { meetings } from '@nzila/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireEntityAccess } from '@/lib/api-guards'
import { z } from 'zod'

const CreateMeetingSchema = z.object({
  kind: z.enum(['board', 'shareholder', 'committee']),
  meetingDate: z.string().datetime(),
  location: z.string().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await params
  const guard = await requireEntityAccess(entityId)
  if (!guard.ok) return guard.response

  const rows = await platformDb
    .select()
    .from(meetings)
    .where(eq(meetings.entityId, entityId))
    .orderBy(desc(meetings.meetingDate))

  return NextResponse.json(rows)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await params
  const guard = await requireEntityAccess(entityId, { minRole: 'entity_secretary' })
  if (!guard.ok) return guard.response

  const body = await req.json()
  const parsed = CreateMeetingSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const [meeting] = await platformDb
    .insert(meetings)
    .values({
      entityId,
      kind: parsed.data.kind,
      meetingDate: new Date(parsed.data.meetingDate),
      location: parsed.data.location ?? null,
    })
    .returning()

  return NextResponse.json(meeting, { status: 201 })
}
