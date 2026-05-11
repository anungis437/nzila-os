/**
 * @nzila/platform-decision-engine — Barrel export
 *
 * Governance signal generation substrate — produces bounded operational
 * signals for human operator review. All outputs are advisory and require
 * explicit confirmation before any operational consequence.
 *
 * @module @nzila/platform-decision-engine
 */

// Types
export type {
  DecisionCategory,
  DecisionSeverity,
  DecisionStatus,
  DecisionType,
  DecisionSource,
  EvidenceRefType,
  FeedbackAction,
  AuditEventType,
  EvidenceRef,
  DecisionGeneratedBy,
  PolicyContext,
  EnvironmentContext,
  DecisionOutcome,
  DecisionRecord,
  DecisionFeedback,
  DecisionAuditEntry,
  DecisionEngineInput,
  DecisionExportPack,
  DecisionSummary,
} from './types'

export {
  ALL_CATEGORIES,
  ALL_SEVERITIES,
  ALL_STATUSES,
  ENGINE_VERSION,
} from './types'

// Schemas
export {
  decisionCategorySchema,
  decisionSeveritySchema,
  decisionStatusSchema,
  decisionTypeSchema,
  decisionSourceSchema,
  evidenceRefTypeSchema,
  feedbackActionSchema,
  auditEventTypeSchema,
  evidenceRefSchema,
  decisionGeneratedBySchema,
  policyContextSchema,
  environmentContextSchema,
  decisionOutcomeSchema,
  decisionRecordSchema,
  decisionFeedbackSchema,
  decisionAuditEntrySchema,
  decisionSummarySchema,
  decisionExportPackSchema,
} from './schemas'

// Utils
export { generateDecisionId, resetDecisionCounter, nowISO, computeHash } from './utils'

// Status
export { isValidTransition, nextValidStatuses } from './status'

// Store
export {
  saveDecisionRecord,
  loadDecisionRecord,
  loadAllDecisions,
  listOpenDecisions,
  listDecisionsByOrg,
  updateDecisionStatus,
  appendDecisionReview,
  saveDecisionFeedback,
  loadDecisionFeedback,
} from './store'

// Engine
export { generateDecisions, summariseDecisions } from './engine'

// Rules
export { DEFAULT_RULES } from './rules'
export type { DecisionRule } from './rules'

// Evidence
export {
  evidenceFromAnomalies,
  evidenceFromInsights,
  evidenceFromSignals,
  evidenceFromChanges,
  buildEvidenceRefs,
} from './evidence'

// Policy
export {
  evaluateDecisionPolicyContext,
  filterExecutableDecisions,
  classifyDecisions,
} from './policy'

// Ranking
export { computePriorityScore, rankDecisions, topDecisions } from './ranking'

// Audit
export { createAuditEntry, saveAuditEntry, emitAuditEvent, loadAuditTrail } from './audit'

// Feedback
export { recordDecisionFeedback } from './feedback'

// Export pack
export { createDecisionExportPack } from './export'

// NL decision support
export type { DecisionQueryIntent } from './nl'
export { classifyDecisionIntent, executeDecisionQuery } from './nl'
