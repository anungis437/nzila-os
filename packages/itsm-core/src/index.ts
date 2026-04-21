/**
 * @nzila/itsm-core — Public API
 */

// Types & Zod schemas
export type {
  TicketType,
  TicketStatus,
  Priority,
  ChangeType,
  ProblemStatus,
  SlaTarget,
  SlaTargets,
  CreateTicketInput,
  CreateTicketEventInput,
  TicketEventType,
  AssetType,
  CreateAssetInput,
  ItsmRole,
  AutomationCondition,
  AutomationAction,
  AutomationRule,
  // Client accounts
  NzilaProduct,
  OnboardingStage,
  ClientHealth,
  CreateOpsClientInput,
  // Command Center
  AlertSeverity,
  AlertType,
  RevenueEventType,
  ProductScoreCategory,
  PortfolioProduct,
  FounderPriorityType,
  RenewalTaskStatus,
} from './types'
export {
  TICKET_TYPES,
  TICKET_STATUSES,
  PRIORITIES,
  CHANGE_TYPES,
  PROBLEM_STATUSES,
  ASSET_TYPES,
  ITSM_ROLES,
  ticketEventTypeValues,
  slaTargetSchema,
  slaTargetsSchema,
  createTicketInputSchema,
  createTicketEventInputSchema,
  createAssetInputSchema,
  // Client accounts
  NZILA_PRODUCTS,
  ONBOARDING_STAGES,
  CLIENT_HEALTH_VALUES,
  ONBOARDING_STAGE_LABELS,
  CLIENT_HEALTH_LABELS,
  ONBOARDING_PIPELINE,
  createOpsClientSchema,
  // Command Center
  ALERT_TYPES,
  ALERT_TYPE_LABELS,
  REVENUE_EVENT_TYPES,
  REVENUE_EVENT_LABELS,
  PRODUCT_SCORE_LABELS,
  PRODUCT_SCORE_COLORS,
  FOUNDER_PRIORITY_TYPE_LABELS,
  RENEWAL_TASK_STATUSES,
} from './types'

// Ticket FSM definition
export { ticketMachine } from './ticket-fsm'
export type { TicketEntity } from './ticket-fsm'

// SLA engine
export {
  DEFAULT_SLA_TARGETS,
  computeSlaDueDates,
  isSlaBreached,
  minutesUntilBreach,
  computeSlaAttainment,
  computeMttr,
} from './sla'

// Ticket number generator
export { generateTicketNumber, ticketNumberPrefix } from './ticket-number'

// Asset risk scorer
export { computeAssetRiskScore } from './asset-risk'
export type { AssetRiskFactors } from './asset-risk'

// Automation rule evaluator
export {
  evaluateAutomationRules,
  VIP_P1_ESCALATION_TEMPLATE,
  NO_RESPONSE_ESCALATION_TEMPLATE,
  RECURRING_INCIDENT_PROBLEM_TEMPLATE,
} from './automation'
export type { EvaluationResult } from './automation'

// NIL intelligence use cases
export type { ItsmPromptContract } from './nil-prompts'
export {
  ITSM_TICKET_TRIAGE,
  ITSM_SLA_BREACH_PREDICTION,
  ITSM_DUPLICATE_DETECTION,
  ITSM_KB_SUGGEST,
  ITSM_RESPONSE_DRAFT,
  ITSM_USE_CASES,
  ITSM_USE_CASE_KEYS,
} from './nil-prompts'
