/**
 * @nzila/intelligence — Reasoning
 *
 * Delegates structured reasoning to @nzila/platform-reasoning-engine
 * and translates results into the unified IntelligenceResponse shape.
 */
import { randomUUID } from 'node:crypto'
import type { IntelligenceRequest, IntelligenceResponse, RiskLevel } from './types'
import { buildContext } from './context'
import { traceFromReasoningChain } from './explainability'
import { NilError } from './types'
import {
  executeReasoningChain,
  type ReasoningChain,
  type ReasoningType,
} from '@nzila/platform-reasoning-engine'
import type { ReasoningStore, ReasoningStrategy } from '@nzila/platform-reasoning-engine'
import type { ContextEnvelope } from '@nzila/platform-context-orchestrator'

// ── Reasoning Dependencies ──────────────────────────────────────────────────

/**
 * Dependencies that must be supplied by the calling app to wire reasoning
 * into the platform-reasoning-engine infrastructure.
 */
export interface ReasoningDeps {
  /** Persistence store for reasoning chains */
  readonly store: ReasoningStore
  /** Strategy that performs the actual reasoning steps */
  readonly strategy: ReasoningStrategy
  /** Context envelope builder — produces the platform context for the request */
  readonly buildContextEnvelope: (request: IntelligenceRequest) => ContextEnvelope
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Run a reasoning use-case through the platform-reasoning-engine
 * and return a unified IntelligenceResponse.
 */
export async function executeReasoning(
  deps: ReasoningDeps,
  request: IntelligenceRequest,
): Promise<IntelligenceResponse> {
  const start = Date.now()
  const ctx = buildContext(request)
  const contextEnvelope = deps.buildContextEnvelope(request)

  const reasoningType: ReasoningType =
    (request.input['reasoningType'] as ReasoningType) ?? 'deductive'

  try {
    const chain: ReasoningChain = await executeReasoningChain({
      store: deps.store,
      strategy: deps.strategy,
      context: contextEnvelope,
      request: {
        orgId: request.orgId,
        reasoningType,
        entityType: (request.input['entityType'] as string) ?? '',
        entityId: (request.input['entityId'] as string) ?? '',
        question: (request.input['question'] as string) ?? '',
        requestedBy: ctx.actorId ?? 'nil-system',
      },
    })

    const explanation = traceFromReasoningChain(chain)
    const riskLevel = mapConfidenceToRisk(chain.totalConfidence)

    return {
      requestId: randomUUID(),
      success: chain.status === 'completed',
      output: {
        chainId: chain.id,
        status: chain.status,
        conclusion: chain.conclusion
          ? {
              summary: chain.conclusion.summary,
              recommendation: chain.conclusion.recommendation,
              riskLevel: chain.conclusion.riskLevel,
              confidence: chain.conclusion.confidence,
              alternatives: chain.conclusion.alternativeConclusions,
            }
          : null,
        crossVerticalInsights: chain.crossVerticalInsights,
      },
      explanation,
      confidence: chain.totalConfidence,
      riskLevel,
      durationMs: Date.now() - start,
      completedAt: new Date().toISOString(),
    }
  } catch (err) {
    throw new NilError(
      'reasoning_failed',
      `Reasoning execution failed: ${err instanceof Error ? err.message : String(err)}`,
      500,
    )
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapConfidenceToRisk(confidence: number): RiskLevel {
  if (confidence >= 0.8) return 'low'
  if (confidence >= 0.5) return 'medium'
  if (confidence >= 0.3) return 'high'
  return 'critical'
}
