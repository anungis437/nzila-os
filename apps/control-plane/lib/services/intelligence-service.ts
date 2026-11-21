import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, gte, lte } from 'drizzle-orm'
import { platformDb } from '@nzila/db/platform'
import {
  auditRecords,
  decisionAggregates,
  decisionPipelineCheckpoints,
  decisionPipelineRuns,
} from '@nzila/db/schema'
import {
  aggregateDecisionRecords,
  anonymizeAggregates,
  getBenchmark,
  computeFreshnessLag,
  evaluateFreshnessSla,
} from '@nzila/decision-intelligence'
import {
  detectPolicyDrift,
  scorePolicy,
  suggestPolicyImprovements,
} from '@nzila/policy-intelligence'

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
export async function collectDecisionMetrics(input: {
  orgId: string
  from: string | null
  to: string | null
  tier: string
}) {
  const { orgId, from, to, tier } = input
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
            aggregate.metrics.total -
              Math.round(aggregate.metrics.approvalRate * aggregate.metrics.total) -
              Math.round(aggregate.metrics.rejectionRate * aggregate.metrics.total) -
              Math.round(aggregate.metrics.escalationRate * aggregate.metrics.total),
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

  return {
    ok: true,
    data: {
      orgId,
      tier,
      pricingAxes: ['decision_volume', 'audit_storage', 'intelligence_access', 'api_usage'],
      aggregates,
    },
  }
}

export async function collectDecisionBenchmarks(input: {
  orgId: string
  decisionType: string
  domain: string
  from: string | null
  to: string | null
  tier: string
}) {
  const { orgId, decisionType, domain, from, to, tier } = input
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
    aggregates.filter(
      (aggregate: ReturnType<typeof aggregateDecisionRecords>[number]) =>
        aggregate.domain === domain,
    ),
  )
  const benchmark = getBenchmark(aggregates, { decisionType, domain })
  const ownAggregate = aggregates.find(
    (aggregate: ReturnType<typeof aggregateDecisionRecords>[number]) =>
      aggregate.organizationId === orgId && aggregate.domain === domain,
  )

  return {
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
  }
}

export async function collectPolicyInsights(input: {
  orgId: string
  decisionType: string
  oldVersion: string | null
  newVersion: string | null
  from: string | null
  to: string | null
  tier: string
}) {
  const { orgId, decisionType, oldVersion, newVersion, from, to, tier } = input
  const filters = [
    eq(auditRecords.organizationId, orgId),
    eq(auditRecords.decisionType, decisionType),
  ]
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

  const latestVersion = [...aggregates]
    .filter((aggregate) => aggregate.decisionType === decisionType)
    .sort((left, right) => right.timeWindow.end.localeCompare(left.timeWindow.end))[0]
    ?.policy.version

  const scoredVersion = newVersion ?? latestVersion ?? oldVersion ?? 'unknown'
  const score = scorePolicy({ decisionType, policyVersion: scoredVersion, aggregates })
  const recommendations = suggestPolicyImprovements({ decisionType, aggregates })
  const drift =
    oldVersion && newVersion
      ? detectPolicyDrift({ decisionType, oldVersion, newVersion, aggregates })
      : undefined

  return {
    ok: true,
    data: {
      orgId,
      tier,
      score,
      drift,
      recommendations,
    },
  }
}

const PIPELINE_NAME = 'decision-aggregate-materialization'
export async function readIntelligencePipelineHealth() {
  const [checkpoint] = await platformDb
    .select()
    .from(decisionPipelineCheckpoints)
    .where(eq(decisionPipelineCheckpoints.pipelineName, PIPELINE_NAME))
    .limit(1)

  const [lastRun] = await platformDb
    .select()
    .from(decisionPipelineRuns)
    .where(eq(decisionPipelineRuns.pipelineName, PIPELINE_NAME))
    .orderBy(desc(decisionPipelineRuns.startedAt))
    .limit(1)

  let freshness: { lagMs: number; status: 'healthy' | 'warning' | 'breached' } | null = null

  if (checkpoint?.lastSuccessfulAuditCreatedAt && checkpoint.lastRunCompletedAt) {
    const { lagMs } = computeFreshnessLag({
      latestAuditRecordAt: checkpoint.lastSuccessfulAuditCreatedAt,
      latestAggregateWindowEnd: checkpoint.lastRunCompletedAt,
    })
    const { status } = evaluateFreshnessSla({ lagMs })
    freshness = { lagMs, status }
  }

  const healthy =
    checkpoint?.lastRunStatus === 'success' &&
    (freshness === null || freshness.status !== 'breached')

  return {
    ok: true,
    data: {
      pipelineName: PIPELINE_NAME,
      healthy,
      checkpoint: checkpoint
        ? {
            lastSuccessfulAuditCreatedAt:
              checkpoint.lastSuccessfulAuditCreatedAt?.toISOString() ?? null,
            lastSuccessfulAuditId: checkpoint.lastSuccessfulAuditId ?? null,
            lastRunStartedAt: checkpoint.lastRunStartedAt?.toISOString() ?? null,
            lastRunCompletedAt: checkpoint.lastRunCompletedAt?.toISOString() ?? null,
            lastRunStatus: checkpoint.lastRunStatus ?? null,
            recordsScanned: checkpoint.recordsScanned ?? 0,
            recordsMaterialized: checkpoint.recordsMaterialized ?? 0,
            failureReason: checkpoint.failureReason ?? null,
          }
        : null,
      lastRun: lastRun
        ? {
            id: lastRun.id,
            mode: lastRun.mode,
            organizationId: lastRun.organizationId ?? null,
            startedAt: lastRun.startedAt?.toISOString() ?? null,
            completedAt: lastRun.completedAt?.toISOString() ?? null,
            status: lastRun.status,
            recordsScanned: lastRun.recordsScanned ?? 0,
            recordsMaterialized: lastRun.recordsMaterialized ?? 0,
            aggregatesWritten: lastRun.aggregatesWritten ?? 0,
            freshnessLagMs: lastRun.freshnessLagMs !== null ? Number(lastRun.freshnessLagMs) : null,
            errorCode: lastRun.errorCode ?? null,
            errorMessage: lastRun.errorMessage ?? null,
          }
        : null,
      freshness,
    },
  }
}
