/**
 * API — Approvals & Votes
 * GET  /api/entities/[entityId]/approvals   → list approvals with vote counts
 * POST /api/entities/[entityId]/approvals   → create approval request
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@nzila/db'
import { approvals, votes } from '@nzila/db/schema'
import { eq, desc, sql } from 'drizzle-orm'
import { requireEntityAccess } from '@/lib/api-guards'
import { z } from 'zod'

const CreateApprovalSchema = z.object({
  subjectType: z.enum(['resolution', 'governance_action']),
  subjectId: z.string().uuid(),
  approvalType: z.enum(['board', 'shareholder']),
  threshold: z.number().min(0).max(1).optional(),
  notes: z.string().optional(),
})

const CastVoteSchema = z.object({
  approvalId: z.string().uuid(),
  voterPersonId: z.string().uuid(),
  choice: z.enum(['yes', 'no', 'abstain']),
  weight: z.number().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await params
  const guard = await requireEntityAccess(entityId)
  if (!guard.ok) return guard.response

  // Fetch approvals with vote aggregation
  const rows = await db
    .select({
      id: approvals.id,
      entityId: approvals.entityId,
      subjectType: approvals.subjectType,
      subjectId: approvals.subjectId,
      approvalType: approvals.approvalType,
      threshold: approvals.threshold,
      status: approvals.status,
      decidedAt: approvals.decidedAt,
      notes: approvals.notes,
      createdAt: approvals.createdAt,
      updatedAt: approvals.updatedAt,
      yesCount: sql<number>`count(case when ${votes.choice} = 'yes' then 1 end)::int`,
      noCount: sql<number>`count(case when ${votes.choice} = 'no' then 1 end)::int`,
      abstainCount: sql<number>`count(case when ${votes.choice} = 'abstain' then 1 end)::int`,
    })
    .from(approvals)
    .leftJoin(votes, eq(votes.approvalId, approvals.id))
    .where(eq(approvals.entityId, entityId))
    .groupBy(approvals.id)
    .orderBy(desc(approvals.createdAt))

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

  // Support both approval creation and vote casting
  if (body._action === 'vote') {
    const parsed = CastVoteSchema.safeParse(body)
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const [vote] = await db
      .insert(votes)
      .values({
        entityId,
        approvalId: parsed.data.approvalId,
        voterPersonId: parsed.data.voterPersonId,
        choice: parsed.data.choice,
        weight: parsed.data.weight?.toString() ?? '1',
      })
      .returning()

    return NextResponse.json(vote, { status: 201 })
  }

  // Default: create approval
  const parsed = CreateApprovalSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const [approval] = await db
    .insert(approvals)
    .values({
      entityId,
      subjectType: parsed.data.subjectType,
      subjectId: parsed.data.subjectId,
      approvalType: parsed.data.approvalType,
      threshold: parsed.data.threshold?.toString() ?? null,
      notes: parsed.data.notes ?? null,
    })
    .returning()

  return NextResponse.json(approval, { status: 201 })
}
