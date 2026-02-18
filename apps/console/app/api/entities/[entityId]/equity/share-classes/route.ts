/**
 * API — Equity operations
 * GET  /api/entities/[entityId]/equity/share-classes  → list share classes
 * POST /api/entities/[entityId]/equity/share-classes  → create share class
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@nzila/db'
import { shareClasses } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'
import { requireEntityAccess } from '@/lib/api-guards'
import { z } from 'zod'

const CreateShareClassSchema = z.object({
  code: z.string().min(1).max(30),
  displayName: z.string().min(1),
  votesPerShare: z.number().default(1),
  dividendRank: z.number().int().default(0),
  liquidationRank: z.number().int().default(0),
  isConvertible: z.boolean().default(false),
  transferRestricted: z.boolean().default(true),
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
    .from(shareClasses)
    .where(eq(shareClasses.entityId, entityId))

  return NextResponse.json(rows)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await params
  const guard = await requireEntityAccess(entityId, { minRole: 'entity_admin' })
  if (!guard.ok) return guard.response

  const body = await req.json()
  const parsed = CreateShareClassSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const [shareClass] = await db
    .insert(shareClasses)
    .values({
      entityId,
      code: parsed.data.code,
      displayName: parsed.data.displayName,
      votesPerShare: parsed.data.votesPerShare.toString(),
      dividendRank: parsed.data.dividendRank,
      liquidationRank: parsed.data.liquidationRank,
      isConvertible: parsed.data.isConvertible,
      transferRestricted: parsed.data.transferRestricted,
    })
    .returning()

  return NextResponse.json(shareClass, { status: 201 })
}
