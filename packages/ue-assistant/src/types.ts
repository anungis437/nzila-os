/**
 * @nzila/ue-assistant — Core Type Definitions
 *
 * Every type used across the UE AI Assistant system. Covers roles,
 * intents, context, tools, responses, escalation, and audit.
 */
import { z } from 'zod'

// ── UE Roles ────────────────────────────────────────────────────────────────

export const UEAssistantRoles = {
  MEMBER: 'member',
  STEWARD: 'steward',
  LOCAL_ADMIN: 'local_admin',
  PARENT_ADMIN: 'parent_admin',
} as const

export type UEAssistantRole =
  (typeof UEAssistantRoles)[keyof typeof UEAssistantRoles]

// ── Role Modes ──────────────────────────────────────────────────────────────

export const RoleModes = {
  GUIDED: 'guided',
  ANALYTICAL: 'analytical',
  OPERATIONAL: 'operational',
  GOVERNANCE: 'governance',
} as const

export type RoleMode = (typeof RoleModes)[keyof typeof RoleModes]

// ── Intent Types ────────────────────────────────────────────────────────────

export const IntentTypes = {
  GRIEVANCE: 'grievance',
  RIGHTS: 'rights',
  CONTRACT: 'contract',
  SAFETY: 'safety',
  BENEFITS: 'benefits',
  VOTING: 'voting',
  EDUCATION: 'education',
  NAVIGATION: 'navigation',
  CASE_ANALYSIS: 'case_analysis',
  DRAFTING: 'drafting',
  OVERSIGHT: 'oversight',
  UNKNOWN: 'unknown',
} as const

export type IntentType = (typeof IntentTypes)[keyof typeof IntentTypes]

// ── Tool Names ──────────────────────────────────────────────────────────────

export const ToolNames = {
  OPEN_GRIEVANCE_FORM: 'openGrievanceForm',
  GET_CASE_STATUS: 'getCaseStatus',
  NAVIGATE_TO_PAGE: 'navigateToPage',
  ANALYZE_CASE: 'analyzeCase',
  SUMMARIZE_CASE: 'summarizeCase',
  MAP_TO_CONTRACT_CLAUSES: 'mapToContractClauses',
  DRAFT_GRIEVANCE: 'draftGrievance',
  SUGGEST_NEXT_STEPS: 'suggestNextSteps',
  REPORT_SAFETY_ISSUE: 'reportSafetyIssue',
  EXPLAIN_AGREEMENT_SECTION: 'explainAgreementSection',
  CASE_DASHBOARD_INSIGHTS: 'caseDashboardInsights',
  WORKLOAD_ANALYSIS: 'workloadAnalysis',
  AGGREGATE_INSIGHTS: 'aggregateInsights',
  TREND_ANALYSIS: 'trendAnalysis',
} as const

export type ToolName = (typeof ToolNames)[keyof typeof ToolNames]

// ── Response Types ──────────────────────────────────────────────────────────

export const ResponseTypes = {
  DIRECT_ANSWER: 'direct_answer',
  GUIDED_STEPS: 'guided_steps',
  CITED_EXPLANATION: 'cited_explanation',
  ANALYTICAL_OUTPUT: 'analytical_output',
  CLARIFICATION_REQUIRED: 'clarification_required',
  ESCALATION_REQUIRED: 'escalation_required',
} as const

export type ResponseType =
  (typeof ResponseTypes)[keyof typeof ResponseTypes]

// ── Escalation Targets ──────────────────────────────────────────────────────

export const EscalationTargets = {
  STEWARD: 'steward',
  ADMIN: 'admin',
  SAFETY_OFFICER: 'safety_officer',
} as const

export type EscalationTarget =
  (typeof EscalationTargets)[keyof typeof EscalationTargets]

// ── Knowledge Source Types ──────────────────────────────────────────────────

export const KnowledgeSourceTypes = {
  COLLECTIVE_AGREEMENT: 'collective_agreement',
  GRIEVANCE_PROCEDURE: 'grievance_procedure',
  SAFETY_POLICY: 'safety_policy',
  BENEFITS_DOCUMENTATION: 'benefits_documentation',
  UE_ROUTE: 'ue_route',
  UE_WORKFLOW: 'ue_workflow',
  MODULE_CONFIG: 'module_config',
  CASE_DATA: 'case_data',
} as const

export type KnowledgeSourceType =
  (typeof KnowledgeSourceTypes)[keyof typeof KnowledgeSourceTypes]

// ── User State ──────────────────────────────────────────────────────────────

export interface UserState {
  readonly openCases: readonly string[]
  readonly submissions: readonly string[]
  readonly participation: readonly string[]
}

// ── User Context ────────────────────────────────────────────────────────────

export interface UserContext {
  readonly orgId: string
  readonly localId: string
  readonly userRole: UEAssistantRole
  readonly language: string
  readonly employer?: string
  readonly entitlements: readonly string[]
  readonly activeModules: readonly string[]
  readonly userState: UserState
}

// ── Knowledge Citation ──────────────────────────────────────────────────────

export interface KnowledgeCitation {
  readonly sourceType: KnowledgeSourceType
  readonly sourceId: string
  readonly title: string
  readonly excerpt: string
  readonly relevanceScore: number
}

// ── Tool Invocation ─────────────────────────────────────────────────────────

export interface ToolInvocation {
  readonly tool: ToolName
  readonly params: Record<string, unknown>
  readonly result: ToolResult
  readonly timestamp: string
}

// ── Escalation Record ───────────────────────────────────────────────────────

export interface EscalationRecord {
  readonly target: EscalationTarget
  readonly reason: string
  readonly severity: 'low' | 'medium' | 'high' | 'critical'
  readonly context: Record<string, unknown>
}

// ── Assistant Response ──────────────────────────────────────────────────────

export interface AssistantResponse {
  readonly requestId: string
  readonly responseType: ResponseType
  readonly content: string
  readonly citations: readonly KnowledgeCitation[]
  readonly toolsInvoked: readonly ToolInvocation[]
  readonly escalation: EscalationRecord | null
  readonly confidence: number
  readonly language: string
  readonly timestamp: string
}

// ── Audit Log Entry ─────────────────────────────────────────────────────────

export interface AuditLogEntry {
  readonly id: string
  readonly userId: string
  readonly orgId: string
  readonly role: UEAssistantRole
  readonly intent: IntentType
  readonly query: string
  readonly responseType: ResponseType
  readonly mode: RoleMode
  readonly sourcesUsed: readonly string[]
  readonly toolsInvoked: readonly ToolName[]
  readonly dataAccessed: readonly string[]
  readonly escalationTriggered: boolean
  readonly confidence: number
  readonly timestamp: string
}

// ── Role Capability Definition ──────────────────────────────────────────────

export interface RoleCapability {
  readonly role: UEAssistantRole
  readonly mode: RoleMode
  readonly allowedIntents: readonly IntentType[]
  readonly allowedTools: readonly ToolName[]
  readonly restrictions: readonly string[]
  readonly permissions: readonly string[]
}

// ── Assistant Request ───────────────────────────────────────────────────────

export interface AssistantRequest {
  readonly query: string
  readonly context: UserContext
  readonly conversationId?: string
}

// ── Tool Execution Result ───────────────────────────────────────────────────

export interface ToolResult {
  readonly success: boolean
  readonly data: Record<string, unknown>
  readonly error?: string
}

// ── Zod Schemas ─────────────────────────────────────────────────────────────

export const userContextSchema = z.object({
  orgId: z.string().min(1),
  localId: z.string().min(1),
  userRole: z.enum(
    Object.values(UEAssistantRoles) as [string, ...string[]],
  ),
  language: z.string().min(2),
  employer: z.string().optional(),
  entitlements: z.array(z.string()),
  activeModules: z.array(z.string()),
  userState: z.object({
    openCases: z.array(z.string()),
    submissions: z.array(z.string()),
    participation: z.array(z.string()),
  }),
})

export const assistantRequestSchema = z.object({
  query: z.string().min(1),
  context: userContextSchema,
  conversationId: z.string().optional(),
})

export const auditLogEntrySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().min(1),
  orgId: z.string().min(1),
  role: z.enum(Object.values(UEAssistantRoles) as [string, ...string[]]),
  intent: z.enum(Object.values(IntentTypes) as [string, ...string[]]),
  query: z.string(),
  responseType: z.enum(
    Object.values(ResponseTypes) as [string, ...string[]],
  ),
  mode: z.enum(Object.values(RoleModes) as [string, ...string[]]),
  sourcesUsed: z.array(z.string()),
  toolsInvoked: z.array(
    z.enum(Object.values(ToolNames) as [string, ...string[]]),
  ),
  dataAccessed: z.array(z.string()),
  escalationTriggered: z.boolean(),
  confidence: z.number().min(0).max(1),
  timestamp: z.string().datetime(),
})
