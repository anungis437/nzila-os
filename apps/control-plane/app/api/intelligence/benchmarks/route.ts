import { NextRequest, NextResponse } from 'next/server'
import { and, asc, eq, gte, lte } from 'drizzle-orm'
import { requireApiAuth, requireAuditReadAuth, handleAuthError } from '@/lib/api-auth'
import { requireIntelligenceTier } from '@/lib/intelligence-access'
import { platformDb } from '@nzila/db/platform'
import { auditRecords } from '@nzila/db/schema'
import { aggregateDecisionRecords, anonymizeAggregates, getBenchmark } from '@nzila/decision-intelligence'

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
    const tier = requireIntelligenceTier(request, 'enterprise')
    const orgId = request.nextUrl.searchParams.get('orgId')
    const decisionType = request.nextUrl.searchParams.get('decisionType')
    const domain = request.nextUrl.searchParams.get('domain')
    const from = request.nextUrl.searchParams.get('from')
    const to = request.nextUrl.searchParams.get('to')

    if (!orgId || !decisionType || !domain) {
      return NextResponse.json({ ok: false, error: { code: 'INVALID_REQUEST', message: 'orgId, decisionType, and domain are required' } }, { status: 400 })
    }

    if (auth.role === 'auditor' && auth.organizationId !== orgId) {
      return NextResponse.json({ ok: false, error: { code: 'ORG_SCOPE_MISMATCH', message: 'Auditor token is scoped to another organization' } }, { status: 403 })
    }

    const filters = [eq(auditRecords.decisionType, decisionType)]
    if (from) filters.push(gte(auditRecords.createdAt, new Date(from)))
    if (to) filters.push(lte(auditRecords.createdAt, new Date(to)))

    const rows = await platformDb
      .select()
      .from(auditRecords)
      .where(and(...filters))
      .orderBy(asc(auditRecords.createdAt))
      .limit(10000)

    const aggregates = aggregateDecisionRecords(rows.map(mapAuditRow), {
      windowStart: from ?? rows[0]?.createdAt.toISOString(),
      windowEnd: to ?? rows.at(-1)?.createdAt.toISOString(),
    })
    const anonymized = anonymizeAggregates(
      aggregates.filter((aggregate: ReturnType<typeof aggregateDecisionRecords>[number]) => aggregate.domain === domain),
    )
    const benchmark = getBenchmark(aggregates, { decisionType, domain })
    const ownAggregate = aggregates.find(
      (aggregate: ReturnType<typeof aggregateDecisionRecords>[number]) => aggregate.organizationId === orgId && aggregate.domain === domain,
    )

    return NextResponse.json({
      ok: true,
      data: {
        tier,
        decisionType,
        domain,
        benchmark,
        percentileHint:
          ownAggregate && benchmark
            ? ownAggregate.metrics.approvalRate >= benchmark.topQuartile
              ? 'top_quartile'
              : ownAggregate.metrics.approvalRate <= benchmark.bottomQuartile
                ? 'bottom_quartile'
                : 'middle_band'
            : 'insufficient_data',
        anonymizedSample: anonymized.slice(0, 25),
      },
    })
  } catch (error) {
    return handleAuthError(error)
  }
}