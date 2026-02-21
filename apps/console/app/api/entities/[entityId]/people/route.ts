// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — People & Entity Roles
 * GET  /api/entities/[entityId]/people   → list people with their roles
 * POST /api/entities/[entityId]/people   → create person + assign role
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@nzila/db'
import { people, entityRoles } from '@nzila/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { requireEntityAccess } from '@/lib/api-guards'
import { recordAuditEvent, AUDIT_ACTIONS } from '@/lib/audit-db'
import { z } from 'zod'

const CreatePersonSchema = z.object({
  type: z.enum(['individual', 'entity']),
  legalName: z.string().min(1),
  email: z.string().email().optional(),
  notes: z.string().optional(),
  // Optional immediate role assignment
  role: z.enum(['director', 'officer', 'shareholder', 'counsel', 'auditor']).optional(),
  title: z.string().optional(),
  startDate: z.string().optional(), // ISO date
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await params
  const guard = await requireEntityAccess(entityId)
  if (!guard.ok) return guard.response

  // People with their roles for this entity
  const rows = await db
    .select({
      personId: people.id,
      type: people.type,
      legalName: people.legalName,
      email: people.email,
      notes: people.notes,
      personCreatedAt: people.createdAt,
      roleId: entityRoles.id,
      role: entityRoles.role,
      roleTitle: entityRoles.title,
      startDate: entityRoles.startDate,
      endDate: entityRoles.endDate,
    })
    .from(people)
    .innerJoin(
      entityRoles,
      and(
        eq(entityRoles.personId, people.id),
        eq(entityRoles.entityId, entityId),
      ),
    )
    .orderBy(desc(people.createdAt))

  // Group by person
  const grouped = new Map<string, {
    id: string
    type: string
    legalName: string
    email: string | null
    notes: string | null
    roles: Array<{
      id: string | null
      role: string | null
      title: string | null
      startDate: string | null
      endDate: string | null
    }>
  }>()

  for (const row of rows) {
    if (!grouped.has(row.personId)) {
      grouped.set(row.personId, {
        id: row.personId,
        type: row.type,
        legalName: row.legalName,
        email: row.email,
        notes: row.notes,
        roles: [],
      })
    }
    const person = grouped.get(row.personId)!
    if (row.roleId) {
      person.roles.push({
        id: row.roleId,
        role: row.role,
        title: row.roleTitle,
        startDate: row.startDate,
        endDate: row.endDate,
      })
    }
  }

  return NextResponse.json([...grouped.values()])
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await params
  const guard = await requireEntityAccess(entityId, { minRole: 'entity_secretary' })
  if (!guard.ok) return guard.response

  const body = await req.json()
  const parsed = CreatePersonSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Create person
  const [person] = await db
    .insert(people)
    .values({
      type: parsed.data.type,
      legalName: parsed.data.legalName,
      email: parsed.data.email ?? null,
      notes: parsed.data.notes ?? null,
    })
    .returning()

  // Optionally assign a role
  let role = null
  if (parsed.data.role) {
    const [r] = await db
      .insert(entityRoles)
      .values({
        entityId,
        personId: person.id,
        role: parsed.data.role,
        title: parsed.data.title ?? null,
        startDate: parsed.data.startDate ?? new Date().toISOString().slice(0, 10),
      })
      .returning()
    role = r
  }

  // Audit: member added to entity
  await recordAuditEvent({
    entityId,
    actorClerkUserId: guard.context.userId,
    actorRole: guard.context.membership?.role ?? String(guard.context.platformRole),
    action: AUDIT_ACTIONS.MEMBER_ADD,
    targetType: 'person',
    targetId: person.id,
    afterJson: {
      legalName: parsed.data.legalName,
      type: parsed.data.type,
      assignedRole: parsed.data.role ?? null,
    },
  })

  return NextResponse.json({ person, role }, { status: 201 })
}
