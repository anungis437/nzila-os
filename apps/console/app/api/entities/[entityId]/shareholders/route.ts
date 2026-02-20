/**
 * API — Shareholders
 * GET  /api/entities/[entityId]/shareholders   → list shareholders
 * POST /api/entities/[entityId]/shareholders   → create shareholder
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@nzila/db'
import { shareholders, people } from '@nzila/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireEntityAccess } from '@/lib/api-guards'
import { z } from 'zod'

const CreateShareholderSchema = z.object({
  holderPersonId: z.string().uuid(),
  holderType: z.enum(['individual', 'entity']),
  contactEmail: z.string().email().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await params
  const guard = await requireEntityAccess(entityId)
  if (!guard.ok) return guard.response

  const rows = await db
    .select({
      id: shareholders.id,
      entityId: shareholders.entityId,
      holderPersonId: shareholders.holderPersonId,
      holderType: shareholders.holderType,
      contactEmail: shareholders.contactEmail,
      createdAt: shareholders.createdAt,
      updatedAt: shareholders.updatedAt,
      // Join person name
      personName: people.legalName,
      personEmail: people.email,
    })
    .from(shareholders)
    .innerJoin(people, eq(people.id, shareholders.holderPersonId))
    .where(eq(shareholders.entityId, entityId))
    .orderBy(desc(shareholders.createdAt))

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
  const parsed = CreateShareholderSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const [shareholder] = await db
    .insert(shareholders)
    .values({
      entityId,
      holderPersonId: parsed.data.holderPersonId,
      holderType: parsed.data.holderType,
      contactEmail: parsed.data.contactEmail ?? null,
    })
    .returning()

  return NextResponse.json(shareholder, { status: 201 })
}
