/**
 * @nzila/ue-assistant — barrel exports
 *
 * Union Eyes AI Assistant: a governed, role-aware, auditable AI
 * interface for members, stewards, and admins.
 */

// Types
export type {
  UEAssistantRole,
  RoleMode,
  IntentType,
  ToolName,
  ResponseType,
  EscalationTarget,
  KnowledgeSourceType,
  UserState,
  UserContext,
  KnowledgeCitation,
  ToolInvocation,
  EscalationRecord,
  AssistantResponse,
  AuditLogEntry,
  RoleCapability,
  AssistantRequest,
  ToolResult,
} from './types'

export {
  UEAssistantRoles,
  RoleModes,
  IntentTypes,
  ToolNames,
  ResponseTypes,
  EscalationTargets,
  KnowledgeSourceTypes,
  userContextSchema,
  assistantRequestSchema,
  auditLogEntrySchema,
} from './types'

// Roles (Phase 1)
export {
  getRoleCapability,
  isIntentAllowed,
  isToolAllowed,
  getRoleMode,
  getRoleRestrictions,
  hasPermission,
  getAllRoleCapabilities,
} from './roles'

// Intents (Phase 2)
export {
  classifyIntent,
  classifyIntentForRole,
  getIntentConfidence,
} from './intents'

// Context (Phase 3)
export {
  resolveContext,
  validateOrgScope,
  enforceIsolation,
  isModuleActive,
  hasEntitlement,
  filterCaseAccess,
  buildContext,
} from './context'

// Knowledge (Phase 4)
export type { KnowledgeEntry, KnowledgeStore } from './knowledge'
export {
  InMemoryKnowledgeStore,
  getSourceTypesForIntent,
  retrieveKnowledge,
} from './knowledge'

// Tools (Phase 5)
export { executeTool, getToolLog, clearToolLog } from './tools'

// Response Policy (Phase 6)
export {
  determineResponseType,
  requiresCitations,
  includesSteps,
  isAnalytical,
} from './response-policy'

// Domain Rules (Phase 7)
export type { DomainAction, DomainBehavior } from './domain-rules'
export {
  getDomainBehavior,
  getActionsForRole,
  getRequiredDisclaimers,
  getPreChecks,
  isSafetyUrgent,
  requiresLegalEscalation,
} from './domain-rules'

// Steward Intelligence (Phase 8)
export type {
  CaseSummary,
  TimelineEntry,
  ClauseMapping,
  MatchedClause,
  GrievanceDraft,
  EscalationRecommendation,
} from './steward-intelligence'
export {
  summarizeCase,
  mapToClauses,
  draftGrievance,
  detectMissingInfo,
  recommendEscalation,
} from './steward-intelligence'

// Escalation (Phase 9)
export type { EscalationCheck, EscalationParams } from './escalation'
export {
  evaluateEscalation,
  shouldEscalate,
  getEscalationLog,
  clearEscalationLog,
} from './escalation'

// Localization (Phase 10)
export type { SupportedLanguage } from './localization'
export {
  SupportedLanguages,
  isLanguageSupported,
  resolveLanguage,
  getLocalizedMessage,
  markAsFallbackTranslation,
  getSupportedLanguages,
} from './localization'

// Audit (Phase 11)
export {
  recordAuditEntry,
  getAuditLog,
  getAuditLogByOrg,
  getAuditLogByUser,
  verifyAuditChain,
  getChainHash,
  clearAuditLog,
  getAuditLogSize,
} from './audit'

// Guardrails (Phase 13)
export type { GuardrailResult } from './guardrails'
export { runGuardrails, computeConfidence } from './guardrails'

// Assistant Orchestrator
export type { AssistantOptions } from './assistant'
export { processRequest } from './assistant'
