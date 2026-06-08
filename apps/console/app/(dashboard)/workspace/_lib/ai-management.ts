/**
 * AI Management data loader.
 *
 * Sources live AI/ML platform state via the Console's own ML SDK
 * (`@/lib/ml-server` → `@nzila/ml-sdk`) and the DB-backed AI governance
 * tables. Follows the workspace loader convention: never throws. If the ML
 * API is unreachable or unconfigured (e.g. local dev without
 * NEXT_PUBLIC_CONSOLE_URL), returns `{ available: false }` and the panel
 * renders structured empty states.
 */
import { platformDb } from '@nzila/db/platform'
import {
  aiActions,
  aiDeployments,
  aiDeploymentRoutes,
  aiKnowledgeSources,
  aiModels,
  aiRequests,
  aiUsageBudgets,
} from '@nzila/db/schema'
import { and, count, eq, sum } from 'drizzle-orm'
import { auth } from '@nzila/platform-auth/entra/server'
import { mlClient } from '@/lib/ml-server'
import { resolveConsoleEntityId } from '@/lib/entity-context'

export interface AiModel {
  id: string
  modelKey: string
  algorithm: string
  version: number
  status: string
  approvedAt: string | null
}

export interface AiInferenceRun {
  id: string
  modelKey: string
  status: string
  startedAt: string
  finishedAt: string | null
}

export interface AiManagementSummary {
  available: boolean
  activeModels: AiModel[]
  recentInference: AiInferenceRun[]
  recentTrainingCount: number
  dailyAnomalies: number
  txnAnomalies: number
  requestCount: number
  requestCostUsd: number
  requestRefusedCount: number
  modelRegistryCount: number
  deploymentCount: number
  deploymentRouteCount: number
  actionCount: number
  actionPendingCount: number
  knowledgeSourceCount: number
  budgetCount: number
  budgetCapUsd: number
  budgetSpentUsd: number
}

const EMPTY: AiManagementSummary = {
  available: false,
  activeModels: [],
  recentInference: [],
  recentTrainingCount: 0,
  dailyAnomalies: 0,
  txnAnomalies: 0,
  requestCount: 0,
  requestCostUsd: 0,
  requestRefusedCount: 0,
  modelRegistryCount: 0,
  deploymentCount: 0,
  deploymentRouteCount: 0,
  actionCount: 0,
  actionPendingCount: 0,
  knowledgeSourceCount: 0,
  budgetCount: 0,
  budgetCapUsd: 0,
  budgetSpentUsd: 0,
}

function isMissingDbObjectError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const maybePg = error as { code?: string; message?: string }
  if (maybePg.code === '42P01' || maybePg.code === '42703') return true
  return typeof maybePg.message === 'string' && maybePg.message.toLowerCase().includes('does not exist')
}

async function safeQuery<T>(_label: string, query: Promise<T>, fallback: T): Promise<T> {
  try {
    return await query
  } catch (error) {
    if (isMissingDbObjectError(error)) {
      return fallback
    }
    throw error
  }
}

export async function loadAiManagement(): Promise<AiManagementSummary> {
  try {
    const { userId } = await auth()
    if (!userId) return EMPTY

    const ml = mlClient()
    const orgId = await resolveConsoleEntityId(userId)
    if (!orgId) return EMPTY

    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const startDate = ninetyDaysAgo.toISOString().slice(0, 10)
    const endDate = new Date().toISOString().slice(0, 10)

    const [
      activeModels,
      recentTraining,
      recentInference,
      dailyScores,
      txnResult,
      requestStats,
      requestRefusals,
      modelRegistryCount,
      deploymentCount,
      routeCount,
      actionStatusCounts,
      knowledgeSourceCount,
      budgetStats,
    ] = await Promise.all([
      ml.getActiveModels(orgId),
      ml.getTrainingRuns(orgId, 5),
      ml.getInferenceRuns(orgId, 5),
      ml.getStripeDailyScores({ orgId, startDate, endDate }),
      ml.getStripeTxnScores({ orgId, startDate, endDate, isAnomaly: true, limit: 500 }),
      safeQuery(
        'request stats query',
        platformDb
          .select({
            requestCount: count(),
            requestCostUsd: sum(aiRequests.costUsd),
          })
          .from(aiRequests)
          .where(eq(aiRequests.orgId, orgId)),
        [{ requestCount: 0, requestCostUsd: '0' }],
      ),
      safeQuery(
        'request refusals query',
        platformDb
          .select({ requestRefusedCount: count() })
          .from(aiRequests)
          .where(and(eq(aiRequests.orgId, orgId), eq(aiRequests.status, 'refused'))),
        [{ requestRefusedCount: 0 }],
      ),
      safeQuery(
        'model registry count query',
        platformDb.select({ modelRegistryCount: count() }).from(aiModels),
        [{ modelRegistryCount: 0 }],
      ),
      safeQuery(
        'deployment count query',
        platformDb.select({ deploymentCount: count() }).from(aiDeployments),
        [{ deploymentCount: 0 }],
      ),
      safeQuery(
        'deployment route count query',
        platformDb
          .select({ deploymentRouteCount: count() })
          .from(aiDeploymentRoutes)
          .where(eq(aiDeploymentRoutes.orgId, orgId)),
        [{ deploymentRouteCount: 0 }],
      ),
      safeQuery(
        'action status counts query',
        platformDb
          .select({
            status: aiActions.status,
            count: count(),
          })
          .from(aiActions)
          .where(eq(aiActions.orgId, orgId))
          .groupBy(aiActions.status),
        [] as Array<{ status: string; count: number }>,
      ),
      safeQuery(
        'knowledge source count query',
        platformDb
          .select({ knowledgeSourceCount: count() })
          .from(aiKnowledgeSources)
          .where(eq(aiKnowledgeSources.orgId, orgId)),
        [{ knowledgeSourceCount: 0 }],
      ),
      safeQuery(
        'budget stats query',
        platformDb
          .select({
            budgetCount: count(),
            budgetCapUsd: sum(aiUsageBudgets.budgetUsd),
            budgetSpentUsd: sum(aiUsageBudgets.spentUsd),
          })
          .from(aiUsageBudgets)
          .where(eq(aiUsageBudgets.orgId, orgId)),
        [{ budgetCount: 0, budgetCapUsd: '0', budgetSpentUsd: '0' }],
      ),
    ])

    const actionCount = actionStatusCounts.reduce((total, row) => total + row.count, 0)
    const actionPendingCount = actionStatusCounts.reduce((total, row) => {
      return ['proposed', 'policy_checked', 'awaiting_approval', 'approved', 'executing'].includes(row.status)
        ? total + row.count
        : total
    }, 0)

    return {
      available: true,
      activeModels: activeModels.map((m) => ({
        id: m.id,
        modelKey: m.modelKey,
        algorithm: m.algorithm,
        version: m.version,
        status: m.status,
        approvedAt: m.meta.approvedAt,
      })),
      recentInference: recentInference.map((r) => ({
        id: r.id,
        modelKey: r.modelKey,
        status: r.status,
        startedAt: r.startedAt,
        finishedAt: r.finishedAt,
      })),
      recentTrainingCount: recentTraining.length,
      dailyAnomalies: dailyScores.filter((s) => s.isAnomaly).length,
      txnAnomalies: txnResult.anomalyInPeriod,
      requestCount: requestStats[0]?.requestCount ?? 0,
      requestCostUsd: Number(requestStats[0]?.requestCostUsd ?? 0),
      requestRefusedCount: requestRefusals[0]?.requestRefusedCount ?? 0,
      modelRegistryCount: modelRegistryCount[0]?.modelRegistryCount ?? 0,
      deploymentCount: deploymentCount[0]?.deploymentCount ?? 0,
      deploymentRouteCount: routeCount[0]?.deploymentRouteCount ?? 0,
      actionCount,
      actionPendingCount,
      knowledgeSourceCount: knowledgeSourceCount[0]?.knowledgeSourceCount ?? 0,
      budgetCount: budgetStats[0]?.budgetCount ?? 0,
      budgetCapUsd: Number(budgetStats[0]?.budgetCapUsd ?? 0),
      budgetSpentUsd: Number(budgetStats[0]?.budgetSpentUsd ?? 0),
    }
  } catch {
    return EMPTY
  }
}
