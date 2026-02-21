// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Filings
 * GET  /api/entities/[entityId]/filings   → list filings
 * POST /api/entities/[entityId]/filings   → create a filing
 */
import { NextRequest, NextResponse } from 'next/server'
import { platformDb } from '@nzila/db/platform'
import { filings } from '@nzila/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireEntityAccess } from '@/lib/api-guards'
import { z } from 'zod'

const CreateFilingSchema = z.object({
  kind: z.enum([
    'annual_return',
    'director_change',
    'address_change',
    'articles_amendment',
    'other',
  ]),
  dueDate: z.string().min(1),
  status: z.enum(['pending', 'submitted', 'accepted']).optional(),
  documentId: z.string().uuid().optional(),
  notes: z.string().optional(),
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
    .from(filings)
    .where(eq(filings.entityId, entityId))
    .orderBy(desc(filings.dueDate))

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
  const parsed = CreateFilingSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const [filing] = await platformDb
    .insert(filings)
    .values({
      entityId,
      kind: parsed.data.kind,
      dueDate: parsed.data.dueDate,
      status: parsed.data.status ?? 'pending',
      documentId: parsed.data.documentId ?? null,
      notes: parsed.data.notes ?? null,
    })
    .returning()

  return NextResponse.json(filing, { status: 201 })
}
