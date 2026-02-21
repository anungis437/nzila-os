// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Cap Table Snapshots
 * GET  /api/entities/[entityId]/equity/cap-table   → list snapshots
 * POST /api/entities/[entityId]/equity/cap-table   → generate snapshot
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@nzila/db'
import {
  capTableSnapshots,
  shareholders,
  shareClasses,
  shareLedgerEntries,
  people,
} from '@nzila/db/schema'
import { eq, desc, sql } from 'drizzle-orm'
import { requireEntityAccess } from '@/lib/api-guards'
import { z } from 'zod'

const CreateSnapshotSchema = z.object({
  asOfDate: z.string().min(1),
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
    .from(capTableSnapshots)
    .where(eq(capTableSnapshots.entityId, entityId))
    .orderBy(desc(capTableSnapshots.createdAt))

  return NextResponse.json(rows)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await params
  const guard = await requireEntityAccess(entityId, { minRole: 'entity_admin' })
  if (!guard.ok) return guard.response
  const { userId } = guard.context

  const body = await req.json()
  const parsed = CreateSnapshotSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Build snapshot from current ledger
  const holdings = await db
    .select({
      holderName: people.legalName,
      className: shareClasses.displayName,
      totalShares: sql<string>`sum(
        CASE WHEN ${shareLedgerEntries.toShareholderId} = ${shareholders.id}
             THEN ${shareLedgerEntries.quantity}
             ELSE -${shareLedgerEntries.quantity} END
      )::text`,
    })
    .from(shareholders)
    .innerJoin(people, eq(people.id, shareholders.holderPersonId))
    .innerJoin(
      shareLedgerEntries,
      sql`(${shareLedgerEntries.toShareholderId} = ${shareholders.id}
           OR ${shareLedgerEntries.fromShareholderId} = ${shareholders.id})
          AND ${shareLedgerEntries.entityId} = ${entityId}
          AND ${shareLedgerEntries.effectiveDate} <= ${parsed.data.asOfDate}`,
    )
    .innerJoin(shareClasses, eq(shareClasses.id, shareLedgerEntries.classId))
    .where(eq(shareholders.entityId, entityId))
    .groupBy(people.legalName, shareClasses.displayName)

  const snapshotJson = {
    asOfDate: parsed.data.asOfDate,
    generatedAt: new Date().toISOString(),
    holdings: holdings.map((h) => ({
      holder: h.holderName,
      class: h.className,
      shares: h.totalShares,
    })),
  }

  const [snapshot] = await db
    .insert(capTableSnapshots)
    .values({
      entityId,
      asOfDate: parsed.data.asOfDate,
      snapshotJson,
      generatedBy: userId,
    })
    .returning()

  return NextResponse.json(snapshot, { status: 201 })
}
