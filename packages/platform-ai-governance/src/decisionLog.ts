import { randomUUID } from 'node:crypto'
import type { AIDecisionLogEntry } from './types'
import { getGovernanceStore, persistGovernanceCollection } from './store'

export function logAIDecision(params: {
  modelId: string
  promptId: string
  app: string
  orgId: string
  inputSummary: string
  outputSummary: string
  confidence: number
  confidenceThreshold?: number
  modelVersion?: string
  engineVersion?: string
  evidenceRefs?: string[]
}): AIDecisionLogEntry {
  const decisionLog = getGovernanceStore().getDecisionLog()
  // All AI outputs require human review — confidence threshold determines reviewStatus
  const threshold = params.confidenceThreshold ?? 0.7
  const requiresHumanReview = true

  const entry: AIDecisionLogEntry = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    modelId: params.modelId,
    promptId: params.promptId,
    app: params.app,
    orgId: params.orgId,
    inputSummary: params.inputSummary,
    outputSummary: params.outputSummary,
    confidence: params.confidence,
    requiresHumanReview,
    reviewStatus: params.confidence < threshold ? 'pending' : undefined,
    modelVersion: params.modelVersion,
    engineVersion: params.engineVersion,
    evidenceRefs: params.evidenceRefs,
  }
  decisionLog.push(entry)
  persistGovernanceCollection('decisionLog')
  return entry
}

export function getDecisionsPendingReview(): AIDecisionLogEntry[] {
  const decisionLog = getGovernanceStore().getDecisionLog()
  return decisionLog.filter(
    (d) => d.requiresHumanReview && d.reviewStatus === 'pending',
  )
}

export function reviewDecision(
  decisionId: string,
  params: { status: 'approved' | 'rejected'; reviewedBy: string },
): AIDecisionLogEntry | undefined {
  const decisionLog = getGovernanceStore().getDecisionLog()
  const entry = decisionLog.find((d) => d.id === decisionId)
  if (entry) {
    entry.reviewStatus = params.status
    entry.reviewedBy = params.reviewedBy
    entry.reviewedAt = new Date().toISOString()
    persistGovernanceCollection('decisionLog')
  }
  return entry
}

export function getDecisionLog(filters?: {
  app?: string
  modelId?: string
}): AIDecisionLogEntry[] {
  const decisionLog = getGovernanceStore().getDecisionLog()
  let results = [...decisionLog]
  if (filters?.app) results = results.filter((d) => d.app === filters.app)
  if (filters?.modelId) results = results.filter((d) => d.modelId === filters.modelId)
  return results
}

export function clearDecisionLog(): void {
  const decisionLog = getGovernanceStore().getDecisionLog()
  decisionLog.length = 0
  persistGovernanceCollection('decisionLog')
}
