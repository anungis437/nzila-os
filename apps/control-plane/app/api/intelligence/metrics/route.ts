import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { and, asc, eq, gte, lte } from 'drizzle-orm'
import { requireApiAuth, requireAuditReadAuth, handleAuthError } from '@/lib/api-auth'
import { requireIntelligenceTier } from '@/lib/intelligence-access'
import { platformDb } from '@nzila/db/platform'
import { auditRecords, decisionAggregates } from '@nzila/db/schema'
import { aggregateDecisionRecords } from '@nzila/decision-intelligence'

type AggregateRecord = Parameters<typeof aggregateDecisionRecords>[0][number]

function mapAuditRow(row: typeof auditRecords.$inferSelect): AggregateRecord {
  return {
    organizationId: row.organizationId,
    decisionType: row.decisionType,
    policyVersion: row.policyVersion,
    createdAt: row.createdAt.toISOString(),
    payload: row.payload as AggregateRecord['payload'],
  }
}

export async function GET(request: NextRequest) {
  try {
    if (request.headers.has('x-api-key')) {
      await requireApiAuth(request)
    }

    const auth = await requireAuditReadAuth(request)
    const tier = requireIntelligenceTier(request, 'basic')
    const orgId = request.nextUrl.searchParams.get('orgId')
    const from = request.nextUrl.searchParams.get('from')
    const to = request.nextUrl.searchParams.get('to')

    if (!orgId) {
      return NextResponse.json({ ok: false, error: { code: 'ORG_ID_REQUIRED', message: 'orgId query param is required' } }, { status: 400 })
    }

    if (auth.role === 'auditor' && auth.organizationId !== orgId) {
      return NextResponse.json({ ok: false, error: { code: 'ORG_SCOPE_MISMATCH', message: 'Auditor token is scoped to another organization' } }, { status: 403 })
    }

    const filters = [eq(auditRecords.organizationId, orgId)]
    if (from) filters.push(gte(auditRecords.createdAt, new Date(from)))
    if (to) filters.push(lte(auditRecords.createdAt, new Date(to)))

    const rows = await platformDb
      .select()
      .from(auditRecords)
      .where(and(...filters))
      .orderBy(asc(auditRecords.createdAt))
      .limit(5000)

    const aggregates = aggregateDecisionRecords(rows.map(mapAuditRow), {
      windowStart: from ?? rows[0]?.createdAt.toISOString(),
      windowEnd: to ?? rows.at(-1)?.createdAt.toISOString(),
    })

    if (aggregates.length > 0) {
      await platformDb
        .insert(decisionAggregates)
        .values(
          aggregates.map((aggregate: ReturnType<typeof aggregateDecisionRecords>[number]) => ({
            id: randomUUID(),
            organizationId: aggregate.organizationId,
            domain: aggregate.domain,
            decisionType: aggregate.decisionType,
            policyVersion: aggregate.policy.version,
            windowStart: new Date(aggregate.timeWindow.start),
            windowEnd: new Date(aggregate.timeWindow.end),
            total: aggregate.metrics.total,
            approvals: Math.round(aggregate.metrics.approvalRate * aggregate.metrics.total),
            rejections: Math.round(aggregate.metrics.rejectionRate * aggregate.metrics.total),
            escalations: Math.round(aggregate.metrics.escalationRate * aggregate.metrics.total),
            pending: Math.max(
              0,
              aggregate.metrics.total
                - Math.round(aggregate.metrics.approvalRate * aggregate.metrics.total)
                - Math.round(aggregate.metrics.rejectionRate * aggregate.metrics.total)
                - Math.round(aggregate.metrics.escalationRate * aggregate.metrics.total),
            ),
            avgDecisionTimeMs: aggregate.metrics.avgDecisionTimeMs,
            overrideRate: aggregate.behavior.overrideRate.toString(),
            humanInterventionRate: aggregate.behavior.humanInterventionRate.toString(),
            effectivenessScore: aggregate.policy.effectivenessScore.toString(),
            source: 'audit_records',
            metrics: aggregate.metrics,
            behavior: aggregate.behavior,
            meta: { tier, generatedFrom: 'audit_records' },
          })),
        )
        .onConflictDoNothing()
    }

    return NextResponse.json({
      ok: true,
      data: {
        orgId,
        tier,
        pricingAxes: ['decision_volume', 'audit_storage', 'intelligence_access', 'api_usage'],
        aggregates,
      },
    })
  } catch (error) {
    return handleAuthError(error)
  }
}