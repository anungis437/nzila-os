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
  NilErrorCode,
} from './types.js'

export {
  NIL_APPS,
  NilError,
  intelligenceRequestSchema,
  intelligenceContextSchema,
} from './types.js'

// ── Context ─────────────────────────────────────────────────────────────────

export { buildContext, mergeContexts } from './context.js'

// ── Explainability ──────────────────────────────────────────────────────────

export {
  traceFromReasoningChain,
  traceFromDecisionRecord,
  emptyTrace,
} from './explainability.js'

// ── Decision ────────────────────────────────────────────────────────────────

export { executeDecision } from './decision.js'

// ── Reasoning ───────────────────────────────────────────────────────────────

export { executeReasoning } from './reasoning.js'
export type { ReasoningDeps } from './reasoning.js'

// ── Registry ────────────────────────────────────────────────────────────────

export {
  registerCapability,
  getCapability,
  resolveCapability,
  listCapabilities,
  unregisterCapability,
  clearRegistry,
} from './registry.js'
