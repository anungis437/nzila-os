/**
 * @nzila/intelligence — Barrel Exports
 *
 * Nzila Intelligence Layer (NIL): the single, governed entry-point for
 * all AI and intelligence capabilities across NzilaOS.
 *
 * Wraps:
 *   - @nzila/ai-sdk
 *   - @nzila/ai-core
 *   - @nzila/ai-control
 *   - @nzila/platform-reasoning-engine
 *   - @nzila/platform-decision-engine
 */

// ── Types ───────────────────────────────────────────────────────────────────

export type {
  NilApp,
  ConfidenceLevel,
  RiskLevel,
  DataClass,
  IntelligenceRequest,
  IntelligenceContext,
  IntelligenceResponse,
  ExplanationTrace,
  ExplanationStep,
  ExplanationCitation,
  IntelligenceCapability,
  CapabilityRouteDecision,
  DomainSignal,
  CrossDomainCorrelation,
  CorrelationStrength,
  NilErrorCode,
} from './types'

export {
  NIL_APPS,
  NilError,
  intelligenceRequestSchema,
  intelligenceContextSchema,
} from './types'

// ── Context ─────────────────────────────────────────────────────────────────

export { buildContext, mergeContexts } from './context'

// ── Explainability ──────────────────────────────────────────────────────────

export {
  traceFromReasoningChain,
  traceFromDecisionRecord,
  emptyTrace,
} from './explainability'

// ── Decision ────────────────────────────────────────────────────────────────

export { executeDecision } from './decision'

// ── Reasoning ───────────────────────────────────────────────────────────────

export { executeReasoning } from './reasoning'
export type { ReasoningDeps } from './reasoning'

// ── Registry ────────────────────────────────────────────────────────────────

export {
  registerCapability,
  getCapability,
  resolveCapability,
  resolveCapabilityAdaptive,
  listCapabilities,
  unregisterCapability,
  clearRegistry,
  recordCapabilityExecution,
  getCapabilityHealth,
  listCapabilityHealth,
} from './registry'

export type {
  CapabilityExecutionTelemetry,
  CapabilityHealth,
} from './registry'

// ── Adaptive Routing ───────────────────────────────────────────────────────

export { routeCapability } from './routing'

// ── Cross-Domain Correlation ───────────────────────────────────────────────

export {
  pearsonCorrelation,
  classifyCorrelationStrength,
  detectCrossDomainCorrelations,
} from './correlation'
