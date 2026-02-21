// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Year-End Readiness
 * GET  /api/entities/[entityId]/year-end   → year-end checklist status
 *
 * Aggregates compliance tasks, filings, and governance status
 * to produce a readiness overview for fiscal year-end.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@nzila/db'
import {
  complianceTasks,
  filings,
  documents,
  entities,
  governanceActions,
} from '@nzila/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { requireEntityAccess } from '@/lib/api-guards'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await params
  const guard = await requireEntityAccess(entityId)
  if (!guard.ok) return guard.response

  // Fetch entity for fiscal year end
  const [entity] = await db
    .select({ fiscalYearEnd: entities.fiscalYearEnd, legalName: entities.legalName })
    .from(entities)
    .where(eq(entities.id, entityId))
    .limit(1)

  // Compliance tasks for year-end
  const yearEndTasks = await db
    .select()
    .from(complianceTasks)
    .where(
      and(
        eq(complianceTasks.entityId, entityId),
        eq(complianceTasks.kind, 'year_end'),
      ),
    )

  // Filing status
  const [filingStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      pending: sql<number>`count(case when ${filings.status} = 'pending' then 1 end)::int`,
      submitted: sql<number>`count(case when ${filings.status} = 'submitted' then 1 end)::int`,
      accepted: sql<number>`count(case when ${filings.status} = 'accepted' then 1 end)::int`,
    })
    .from(filings)
    .where(eq(filings.entityId, entityId))

  // Document counts
  const [docStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      yearEnd: sql<number>`count(case when ${documents.category} = 'year_end' then 1 end)::int`,
    })
    .from(documents)
    .where(eq(documents.entityId, entityId))

  // Pending governance actions
  const [actionStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      pending: sql<number>`count(case when ${governanceActions.status} IN ('draft', 'pending_approval') then 1 end)::int`,
    })
    .from(governanceActions)
    .where(eq(governanceActions.entityId, entityId))

  // Build checklist
  const tasksComplete = yearEndTasks.filter((t) => t.status === 'done').length
  const tasksTotal = yearEndTasks.length

  const checklist = [
    {
      id: 'compliance_tasks',
      label: 'Year-End Compliance Tasks',
      status: tasksTotal === 0 ? 'not_started' : tasksComplete === tasksTotal ? 'complete' : 'in_progress',
      detail: `${tasksComplete}/${tasksTotal} tasks done`,
    },
    {
      id: 'filings',
      label: 'Regulatory Filings',
      status: (filingStats?.total ?? 0) === 0 ? 'not_started' : (filingStats?.pending ?? 0) === 0 ? 'complete' : 'in_progress',
      detail: `${filingStats?.accepted ?? 0} accepted, ${filingStats?.pending ?? 0} pending`,
    },
    {
      id: 'documents',
      label: 'Year-End Documents',
      status: (docStats?.yearEnd ?? 0) > 0 ? 'complete' : 'not_started',
      detail: `${docStats?.yearEnd ?? 0} year-end documents uploaded`,
    },
    {
      id: 'governance_actions',
      label: 'Outstanding Governance Actions',
      status: (actionStats?.pending ?? 0) === 0 ? 'complete' : 'in_progress',
      detail: `${actionStats?.pending ?? 0} pending actions`,
    },
    {
      id: 'minute_book',
      label: 'Minute Book Up to Date',
      status: 'requires_review',
      detail: 'Manual review required',
    },
    {
      id: 'share_register',
      label: 'Share Register Reconciled',
      status: 'requires_review',
      detail: 'Manual review required',
    },
    {
      id: 'annual_return',
      label: 'Annual Return Filed',
      status: 'requires_review',
      detail: 'Check with jurisdiction registry',
    },
    {
      id: 'tax_filing',
      label: 'Tax Returns Filed',
      status: 'requires_review',
      detail: 'Confirm with accountant',
    },
    {
      id: 'audit_trail',
      label: 'Audit Trail Verified',
      status: 'requires_review',
      detail: 'Run chain verification',
    },
  ]

  const readyItems = checklist.filter((c) => c.status === 'complete').length
  const readinessPercent = checklist.length > 0
    ? Math.round((readyItems / checklist.length) * 100)
    : 0

  return NextResponse.json({
    entityId,
    entityName: entity?.legalName ?? 'Unknown',
    fiscalYearEnd: entity?.fiscalYearEnd ?? null,
    readinessPercent,
    checklist,
    tasks: yearEndTasks,
    filings: filingStats,
    documents: docStats,
    governanceActions: actionStats,
  })
}
