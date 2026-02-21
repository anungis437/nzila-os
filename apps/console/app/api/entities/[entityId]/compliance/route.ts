// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Compliance Tasks
 * GET  /api/entities/[entityId]/compliance   → list compliance tasks
 * POST /api/entities/[entityId]/compliance   → create compliance task
 * PATCH (via POST with _action: 'update')   → update task status
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@nzila/db'
import { complianceTasks } from '@nzila/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { requireEntityAccess } from '@/lib/api-guards'
import { z } from 'zod'

const CreateComplianceTaskSchema = z.object({
  kind: z.enum(['year_end', 'month_close', 'governance']),
  title: z.string().min(1),
  dueDate: z.string(), // ISO date
  status: z.enum(['open', 'done', 'blocked']).optional(),
  evidenceDocumentId: z.string().uuid().optional(),
})

const UpdateComplianceTaskSchema = z.object({
  _action: z.literal('update'),
  id: z.string().uuid(),
  status: z.enum(['open', 'done', 'blocked']).optional(),
  evidenceDocumentId: z.string().uuid().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await params
  const guard = await requireEntityAccess(entityId)
  if (!guard.ok) return guard.response

  const rows = await db
    .select()
    .from(complianceTasks)
    .where(eq(complianceTasks.entityId, entityId))
    .orderBy(desc(complianceTasks.dueDate))

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

  // Handle update action
  if (body._action === 'update') {
    const parsed = UpdateComplianceTaskSchema.safeParse(body)
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const updates: Record<string, unknown> = {}
    if (parsed.data.status) updates.status = parsed.data.status
    if (parsed.data.evidenceDocumentId) updates.evidenceDocumentId = parsed.data.evidenceDocumentId

    const [updated] = await db
      .update(complianceTasks)
      .set(updates)
      .where(
        and(
          eq(complianceTasks.id, parsed.data.id),
          eq(complianceTasks.entityId, entityId),
        ),
      )
      .returning()

    if (!updated)
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })

    return NextResponse.json(updated)
  }

  // Default: create task
  const parsed = CreateComplianceTaskSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const [task] = await db
    .insert(complianceTasks)
    .values({
      entityId,
      kind: parsed.data.kind,
      title: parsed.data.title,
      dueDate: parsed.data.dueDate,
      status: parsed.data.status ?? 'open',
      evidenceDocumentId: parsed.data.evidenceDocumentId ?? null,
    })
    .returning()

  return NextResponse.json(task, { status: 201 })
}
