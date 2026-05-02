import { NextRequest, NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'

import { requireAuditReadAuth, handleAuthError } from '@/lib/api-auth'
import { platformDb } from '@nzila/db/platform'
import { decisionPipelineCheckpoints, decisionPipelineRuns } from '@nzila/db/schema'
import { computeFreshnessLag, evaluateFreshnessSla } from '@nzila/decision-intelligence'

const PIPELINE_NAME = 'decision-aggregate-materialization'

export async function GET(request: NextRequest) {
  try {
    await requireAuditReadAuth(request)

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

    return NextResponse.json({
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
    })
  } catch (error) {
    return handleAuthError(error)
  }
}
