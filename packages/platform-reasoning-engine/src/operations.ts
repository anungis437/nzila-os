/**
 * @nzila/platform-reasoning-engine — Operations
 *
 * Execute reasoning chains: context assembly → strategy execution →
 * citation gathering → conclusion → audit persistence.
 */
import type {
  ReasoningChain,
  ReasoningRequest,
  ReasoningStore,
  ReasoningStrategy,
  Citation,
} from './types'
import { ReasoningStatuses } from './types'
import type { ContextEnvelope } from '@nzila/platform-context-orchestrator'
import type { OntologyEntityType } from '@nzila/platform-ontology'

// ── ID Generation ───────────────────────────────────────────────────────────

let idCounter = 0
function generateId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  idCounter++
  return `00000000-0000-0000-0000-${String(idCounter).padStart(12, '0')}`
}

// ── Execute Reasoning Chain ─────────────────────────────────────────────────

export interface ExecuteReasoningOptions {
  store: ReasoningStore
  strategy: ReasoningStrategy
  context: ContextEnvelope
  request: ReasoningRequest
}

/**
 * Execute a reasoning chain:
 * 1. Run the strategy against the context envelope
 * 2. Collect all citations
 * 3. Persist the chain
 */
export async function executeReasoningChain(
  options: ExecuteReasoningOptions,
): Promise<ReasoningChain> {
  const { store, strategy, context, request } = options
  const now = new Date().toISOString()

  try {
    const result = await strategy.reason(context, request.question)

    // Deduplicate citations
    const allCitations = deduplicateCitations([
      ...result.citations,
      ...result.steps.flatMap((s) => s.citations),
    ])

    // Calculate total confidence as weighted average of step confidences
    const totalConfidence =
      result.steps.length > 0
        ? result.steps.reduce((sum, s) => sum + s.confidence, 0) /
          result.steps.length
        : result.conclusion.confidence

    const chain: ReasoningChain = {
      id: generateId(),
      orgId: request.orgId,
      reasoningType: request.reasoningType as ReasoningChain['reasoningType'],
      status: ReasoningStatuses.COMPLETED,
      entityType: request.entityType as OntologyEntityType,
      resourceId: request.resourceId,
      question: request.question,
      steps: result.steps,
      conclusion: result.conclusion,
      allCitations,
      totalConfidence,
      crossVerticalInsights: [],
      createdAt: now,
      completedAt: new Date().toISOString(),
      requestedBy: request.requestedBy,
    }

    await store.persistChain(chain)
    return chain
  } catch (_error) {
    const chain: ReasoningChain = {
      id: generateId(),
      orgId: request.orgId,
      reasoningType: request.reasoningType as ReasoningChain['reasoningType'],
      status: ReasoningStatuses.FAILED,
      entityType: request.entityType as OntologyEntityType,
      resourceId: request.resourceId,
      question: request.question,
      steps: [],
      conclusion: null,
      allCitations: [],
      totalConfidence: 0,
      crossVerticalInsights: [],
      createdAt: now,
      completedAt: new Date().toISOString(),
      requestedBy: request.requestedBy,
    }

    await store.persistChain(chain)
    return chain
  }
}

// ── Citation Helpers ────────────────────────────────────────────────────────

function deduplicateCitations(citations: readonly Citation[]): Citation[] {
  const seen = new Set<string>()
  const result: Citation[] = []
  for (const c of citations) {
    const key = `${c.sourceType}:${c.sourceId}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push(c)
    }
  }
  return result
}

// ── History Lookups ─────────────────────────────────────────────────────────

export async function getReasoningChain(
  store: ReasoningStore,
  chainId: string,
): Promise<ReasoningChain | undefined> {
  return store.getChain(chainId)
}

export async function getReasoningHistory(
  store: ReasoningStore,
  entityType: OntologyEntityType,
  resourceId: string,
): Promise<readonly ReasoningChain[]> {
  return store.getChainsByEntity(entityType, resourceId)
}
