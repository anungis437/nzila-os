// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Audit events (append-only)
 * GET  /api/entities/[entityId]/audit   → list audit trail
 * POST /api/entities/[entityId]/audit   → log event (internal use)
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@nzila/db'
import { auditEvents } from '@nzila/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireEntityAccess } from '@/lib/api-guards'
import { z } from 'zod'
import { computeEntryHash } from '@nzila/os-core'
import { auditLog } from '@/lib/audit'

const CreateAuditEventSchema = z.object({
  action: z.string().min(1),
  targetType: z.string().min(1),
  targetId: z.string().uuid().optional(),
  beforeJson: z.record(z.unknown()).optional(),
  afterJson: z.record(z.unknown()).optional(),
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
    .from(auditEvents)
    .where(eq(auditEvents.entityId, entityId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(200)

  return NextResponse.json(rows)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await params
  const guard = await requireEntityAccess(entityId)
  if (!guard.ok) return guard.response
  const { userId } = guard.context
  const membershipRole = guard.context.membership?.role ?? 'entity_viewer'

  const body = await req.json()
  const parsed = CreateAuditEventSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Get previous hash
  const [lastEvent] = await db
    .select({ hash: auditEvents.hash })
    .from(auditEvents)
    .where(eq(auditEvents.entityId, entityId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(1)

  const previousHash = lastEvent?.hash ?? null
  const payload = { ...parsed.data, entityId, actorClerkUserId: userId }
  const hash = computeEntryHash(payload, previousHash)

  const [event] = await db
    .insert(auditEvents)
    .values({
      entityId,
      actorClerkUserId: userId,
      actorRole: membershipRole,
      action: parsed.data.action,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId ?? null,
      beforeJson: parsed.data.beforeJson ?? null,
      afterJson: parsed.data.afterJson ?? null,
      hash,
      previousHash,
    })
    .returning()

  // Secondary stdout audit sink
  auditLog({
    userId,
    action: parsed.data.action,
    resource: `${parsed.data.targetType}/${parsed.data.targetId ?? entityId}`,
    metadata: { entityId, hash },
  })

  return NextResponse.json(event, { status: 201 })
}
