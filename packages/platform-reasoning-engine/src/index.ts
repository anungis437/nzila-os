/**
 * @nzila/platform-reasoning-engine
 *
 * Governance-safe bounded reasoning substrate with citations, explainability,
 * and audit-safe strategies: deductive, causal, abductive, risk-based.
 *
 * All conclusions are interpretive and bounded by the context envelope.
 * No autonomous actions are produced — human operators evaluate all conclusions.
 */

// Types & schemas
export {
  ReasoningTypes,
  ReasoningStatuses,
  ReasoningRequestSchema,
} from './types'
export type {
  ReasoningType,
  ReasoningStatus,
  Citation,
  ReasoningStep,
  ReasoningConclusion,
  ReasoningChain,
  CrossVerticalInsight,
  ReasoningStrategy,
  ReasoningStore,
  ReasoningRequest,
} from './types'

// Operations
export {
  executeReasoningChain,
  getReasoningChain,
  getReasoningHistory,
} from './operations'
export type { ExecuteReasoningOptions } from './operations'

// Built-in strategies
export {
  createDeductiveStrategy,
  createCausalStrategy,
  createAbductiveStrategy,
  createRiskBasedStrategy,
  selectStrategy,
} from './strategies'

// In-memory store
export { createInMemoryReasoningStore } from './memory-store'

// Drizzle schema
export { reasoningChains } from './schema'
