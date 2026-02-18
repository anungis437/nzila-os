/**
 * API — Share ledger entries (append-only)
 * GET  /api/entities/[entityId]/equity/ledger   → list ledger entries
 * POST /api/entities/[entityId]/equity/ledger   → append entry
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@nzila/db'
import { shareLedgerEntries } from '@nzila/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireEntityAccess } from '@/lib/api-guards'
import { z } from 'zod'
import { computeEntryHash } from '@nzila/os-core'

const CreateLedgerEntrySchema = z.object({
  entryType: z.enum([
    'issuance',
    'transfer',
    'conversion',
    'repurchase',
    'cancellation',
    'adjustment',
  ]),
  classId: z.string().uuid(),
  fromShareholderId: z.string().uuid().optional(),
  toShareholderId: z.string().uuid().optional(),
  quantity: z.number().int().positive(),
  pricePerShare: z.number().optional(),
  currency: z.string().max(3).default('CAD'),
  effectiveDate: z.string(),
  referenceResolutionId: z.string().uuid().optional(),
  notes: z.string().optional(),
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
    .from(shareLedgerEntries)
    .where(eq(shareLedgerEntries.entityId, entityId))
    .orderBy(desc(shareLedgerEntries.createdAt))

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
  const parsed = CreateLedgerEntrySchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Get previous hash (last entry for this entity)
  const [lastEntry] = await db
    .select({ hash: shareLedgerEntries.hash })
    .from(shareLedgerEntries)
    .where(eq(shareLedgerEntries.entityId, entityId))
    .orderBy(desc(shareLedgerEntries.createdAt))
    .limit(1)

  const previousHash = lastEntry?.hash ?? null
  const payload = { ...parsed.data, entityId }
  const hash = computeEntryHash(payload, previousHash)

  const [entry] = await db
    .insert(shareLedgerEntries)
    .values({
      entityId,
      entryType: parsed.data.entryType,
      classId: parsed.data.classId,
      fromShareholderId: parsed.data.fromShareholderId ?? null,
      toShareholderId: parsed.data.toShareholderId ?? null,
      quantity: BigInt(parsed.data.quantity),
      pricePerShare: parsed.data.pricePerShare?.toString() ?? null,
      currency: parsed.data.currency,
      effectiveDate: parsed.data.effectiveDate,
      referenceResolutionId: parsed.data.referenceResolutionId ?? null,
      notes: parsed.data.notes ?? null,
      hash,
      previousHash,
    })
    .returning()

  // Convert BigInt quantity to string for JSON serialization
  const serializable = { ...entry, quantity: entry.quantity.toString() }
  return NextResponse.json(serializable, { status: 201 })
}
