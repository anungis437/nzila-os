// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Single entity operations
 * GET    /api/entities/[entityId]  → get entity details
 * PATCH  /api/entities/[entityId]  → update entity
 */
import { NextRequest, NextResponse } from 'next/server'
import { platformDb } from '@nzila/db/platform'
import { entities } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'
import { requireEntityAccess } from '@/lib/api-guards'
import { z } from 'zod'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await params
  const guard = await requireEntityAccess(entityId)
  if (!guard.ok) return guard.response

  const [entity] = await platformDb
    .select()
    .from(entities)
    .where(eq(entities.id, entityId))
    .limit(1)

  if (!entity) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(entity)
}

const UpdateEntitySchema = z.object({
  legalName: z.string().min(1).optional(),
  jurisdiction: z.string().min(2).max(10).optional(),
  incorporationNumber: z.string().optional(),
  fiscalYearEnd: z.string().regex(/^\d{2}-\d{2}$/).optional(),
  status: z.enum(['active', 'inactive']).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await params
  const guard = await requireEntityAccess(entityId, { minRole: 'entity_admin' })
  if (!guard.ok) return guard.response

  const body = await req.json()
  const parsed = UpdateEntitySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const [updated] = await platformDb
    .update(entities)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(entities.id, entityId))
    .returning()

  return NextResponse.json(updated)
}
