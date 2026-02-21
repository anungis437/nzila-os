// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Entities CRUD
 * GET  /api/entities          → list entities for current user
 * POST /api/entities          → create entity (platform_admin, studio_admin, ops)
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@nzila/db'
import { entities, entityMembers } from '@nzila/db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { authenticateUser, requirePlatformRole } from '@/lib/api-guards'

const CreateEntitySchema = z.object({
  legalName: z.string().min(1),
  jurisdiction: z.string().min(2).max(10),
  incorporationNumber: z.string().optional(),
  fiscalYearEnd: z.string().regex(/^\d{2}-\d{2}$/).optional(), // MM-DD
})

export async function GET() {
  const authResult = await authenticateUser()
  if (!authResult.ok) return authResult.response
  const { userId } = authResult

  // Return entities where user is a member
  const rows = await db
    .select({
      id: entities.id,
      legalName: entities.legalName,
      jurisdiction: entities.jurisdiction,
      incorporationNumber: entities.incorporationNumber,
      fiscalYearEnd: entities.fiscalYearEnd,
      status: entities.status,
      createdAt: entities.createdAt,
    })
    .from(entities)
    .innerJoin(entityMembers, and(
      eq(entityMembers.entityId, entities.id),
      eq(entityMembers.clerkUserId, userId),
      eq(entityMembers.status, 'active'),
    ))

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  // Only platform_admin, studio_admin, and ops can create entities
  const authResult = await requirePlatformRole('platform_admin', 'studio_admin', 'ops')
  if (!authResult.ok) return authResult.response
  const { userId } = authResult

  const body = await req.json()
  const parsed = CreateEntitySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const [entity] = await db
    .insert(entities)
    .values({
      legalName: parsed.data.legalName,
      jurisdiction: parsed.data.jurisdiction,
      incorporationNumber: parsed.data.incorporationNumber ?? null,
      fiscalYearEnd: parsed.data.fiscalYearEnd ?? null,
    })
    .returning()

  // Auto-add creator as entity_admin
  await db.insert(entityMembers).values({
    entityId: entity.id,
    clerkUserId: userId,
    role: 'entity_admin',
  })

  return NextResponse.json(entity, { status: 201 })
}
