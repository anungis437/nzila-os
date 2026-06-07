/**
 * AI Management data loader.
 *
 * Sources the live AI/ML platform state via the Console's own ML SDK
 * (`@/lib/ml-server` → `@nzila/ml-sdk`). Follows the workspace loader
 * convention: never throws. If the ML API is unreachable or unconfigured
 * (e.g. local dev without NEXT_PUBLIC_CONSOLE_URL), returns
 * `{ available: false }` and the panel renders structured empty states.
 */
import { mlClient, getEntityId } from '@/lib/ml-server'

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
}

const EMPTY: AiManagementSummary = {
  available: false,
  activeModels: [],
  recentInference: [],
  recentTrainingCount: 0,
  dailyAnomalies: 0,
  txnAnomalies: 0,
}

export async function loadAiManagement(): Promise<AiManagementSummary> {
  try {
    const ml = mlClient()
    const orgId = getEntityId()

    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const startDate = ninetyDaysAgo.toISOString().slice(0, 10)
    const endDate = new Date().toISOString().slice(0, 10)

    const [activeModels, recentTraining, recentInference, dailyScores, txnResult] =
      await Promise.all([
        ml.getActiveModels(orgId),
        ml.getTrainingRuns(orgId, 5),
        ml.getInferenceRuns(orgId, 5),
        ml.getStripeDailyScores({ orgId, startDate, endDate }),
        ml.getStripeTxnScores({ orgId, startDate, endDate, isAnomaly: true, limit: 500 }),
      ])

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
    }
  } catch {
    return EMPTY
  }
}
