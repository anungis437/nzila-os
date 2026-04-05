// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Cross-entity approvals aggregation
 * GET  /api/approvals   → all pending approvals across user's orgs
 */
import { NextResponse } from 'next/server'
import { platformDb } from '@nzila/db/platform'
import { approvals, orgs, orgMembers } from '@nzila/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { authenticateUser } from '@/lib/api-guards'

export async function GET() {
  const authResult = await authenticateUser()
  if (!authResult.ok) return authResult.response
  const { userId } = authResult

  // Get all approvals from orgs the user has access to
  const rows = await platformDb
    .select({
      id: approvals.id,
      orgId: approvals.orgId,
      entityName: orgs.legalName,
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
    .innerJoin(orgs, eq(orgs.id, approvals.orgId))
    .innerJoin(
      orgMembers,
      and(
        eq(orgMembers.orgId, approvals.orgId),
        eq(orgMembers.userId, userId),
        eq(orgMembers.status, 'active'),
      ),
    )
    .orderBy(desc(approvals.createdAt))

  return NextResponse.json(rows)
}
