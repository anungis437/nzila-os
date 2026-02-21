// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Cross-entity approvals aggregation
 * GET  /api/approvals   → all pending approvals across user's entities
 */
import { NextResponse } from 'next/server'
import { db } from '@nzila/db'
import { approvals, entities, entityMembers } from '@nzila/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { authenticateUser } from '@/lib/api-guards'

export async function GET() {
  const authResult = await authenticateUser()
  if (!authResult.ok) return authResult.response
  const { userId } = authResult

  // Get all approvals from entities the user has access to
  const rows = await db
    .select({
      id: approvals.id,
      entityId: approvals.entityId,
      entityName: entities.legalName,
      subjectType: approvals.subjectType,
      subjectId: approvals.subjectId,
      approvalType: approvals.approvalType,
      threshold: approvals.threshold,
      status: approvals.status,
      decidedAt: approvals.decidedAt,
      notes: approvals.notes,
      createdAt: approvals.createdAt,
    })
    .from(approvals)
    .innerJoin(entities, eq(entities.id, approvals.entityId))
    .innerJoin(
      entityMembers,
      and(
        eq(entityMembers.entityId, approvals.entityId),
        eq(entityMembers.clerkUserId, userId),
        eq(entityMembers.status, 'active'),
      ),
    )
    .orderBy(desc(approvals.createdAt))

  return NextResponse.json(rows)
}
