/**
 * @nzila/itsm-core — Types
 *
 * Canonical ITSM types aligned with the DB schema.
 * All runtime validation uses Zod; domain logic is pure TypeScript.
 */
import { z } from 'zod'

// ── Discriminated enums (mirror DB pgEnums) ───────────────────────────────────

export const TICKET_TYPES = [
  'incident',
  'service_request',
  'access_request',
  'change_request',
  'problem',
  'procurement',
  'vendor_escalation',
  'security_event',
  'project_task',
] as const
export type TicketType = (typeof TICKET_TYPES)[number]

export const TICKET_STATUSES = [
  'new',
  'triage',
  'assigned',
  'in_progress',
  'waiting_user',
  'waiting_vendor',
  'resolved',
  'closed',
  'reopened',
] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const PRIORITIES = [
  'p1_critical',
  'p2_high',
  'p3_medium',
  'p4_low',
] as const
export type Priority = (typeof PRIORITIES)[number]

export const CHANGE_TYPES = ['standard', 'normal', 'emergency'] as const
export type ChangeType = (typeof CHANGE_TYPES)[number]

export const PROBLEM_STATUSES = [
  'open',
  'under_investigation',
  'known_error',
  'remediation_in_progress',
  'resolved',
  'closed',
] as const
export type ProblemStatus = (typeof PROBLEM_STATUSES)[number]

// ── SLA target shape ──────────────────────────────────────────────────────────

export const slaTargetSchema = z.object({
  /** Minutes to first response */
  responseMinutes: z.number().int().positive(),
  /** Minutes to resolution */
  resolutionMinutes: z.number().int().positive(),
})
export type SlaTarget = z.infer<typeof slaTargetSchema>

export const slaTargetsSchema = z.object({
  p1_critical: slaTargetSchema,
  p2_high: slaTargetSchema,
  p3_medium: slaTargetSchema,
  p4_low: slaTargetSchema,
})
export type SlaTargets = z.infer<typeof slaTargetsSchema>

// ── Ticket intake ─────────────────────────────────────────────────────────────

export const createTicketInputSchema = z.object({
  orgId: z.string().uuid(),
  type: z.enum(TICKET_TYPES),
  priority: z.enum(PRIORITIES).default('p3_medium'),
  title: z.string().min(3).max(256),
  description: z.string().optional(),
  reportedById: z.string().min(1),
  channel: z.string().default('portal'),
  queueId: z.string().uuid().optional(),
  slaId: z.string().uuid().optional(),
  contractId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
})
export type CreateTicketInput = z.infer<typeof createTicketInputSchema>

// ── Ticket event ──────────────────────────────────────────────────────────────

export const ticketEventTypeValues = [
  'status_changed',
  'note_added',
  'assignment_changed',
  'priority_changed',
  'sla_breached',
  'approval_requested',
  'approval_decided',
  'attachment_added',
  'escalated',
  'linked_asset',
  'linked_problem',
  'ai_suggestion_generated',
  'automation_triggered',
  'reopened',
] as const
export type TicketEventType = (typeof ticketEventTypeValues)[number]

export const createTicketEventInputSchema = z.object({
  orgId: z.string().uuid(),
  ticketId: z.string().uuid(),
  eventType: z.enum(ticketEventTypeValues),
  actorId: z.string().min(1),
  fromValue: z.string().optional(),
  toValue: z.string().optional(),
  body: z.string().optional(),
  internal: z.boolean().default(false),
  payload: z.record(z.unknown()).default({}),
})
export type CreateTicketEventInput = z.infer<typeof createTicketEventInputSchema>

// ── Asset ─────────────────────────────────────────────────────────────────────

export const ASSET_TYPES = [
  'laptop',
  'desktop',
  'phone',
  'printer',
  'network_device',
  'server',
  'saas_license',
  'cloud_resource',
  'facilities',
  'other',
] as const
export type AssetType = (typeof ASSET_TYPES)[number]

export const createAssetInputSchema = z.object({
  orgId: z.string().uuid(),
  type: z.enum(ASSET_TYPES),
  name: z.string().min(1).max(128),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  ownerId: z.string().optional(),
  warrantyExpiry: z.string().optional(),
  purchaseDate: z.string().optional(),
  purchaseCost: z.string().optional(),
  location: z.string().optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
})
export type CreateAssetInput = z.infer<typeof createAssetInputSchema>

// ── ITSM roles (for FSM guards & RBAC) ───────────────────────────────────────

export const ITSM_ROLES = [
  'itsm_agent',
  'itsm_manager',
  'itsm_change_approver',
  'itsm_client_viewer',
  'org_admin',
] as const
export type ItsmRole = (typeof ITSM_ROLES)[number]

// ── Automation rule ───────────────────────────────────────────────────────────

export interface AutomationCondition {
  readonly field: string
  readonly operator: 'eq' | 'neq' | 'gte' | 'lte' | 'in' | 'older_than_minutes'
  readonly value: unknown
}

export interface AutomationAction {
  readonly type:
    | 'change_status'
    | 'change_priority'
    | 'assign_queue'
    | 'send_notification'
    | 'escalate'
    | 'create_problem'
    | 'create_ticket'
    | 'webhook'
  readonly payload: Record<string, unknown>
}

export interface AutomationRule {
  readonly id: string
  readonly orgId: string
  readonly name: string
  readonly enabled: boolean
  /** 'all' = AND, 'any' = OR */
  readonly conditionLogic: 'all' | 'any'
  readonly conditions: readonly AutomationCondition[]
  readonly actions: readonly AutomationAction[]
  /** Debounce: don't re-fire within N minutes */
  readonly cooldownMinutes?: number
}

// ── Client Accounts (Service Operations Layer) ────────────────────────────────

export const NZILA_PRODUCTS = [
  'union_eyes',
  'faircase',
  'flow',
  'zonga',
  'agrimo',
  'platform',
  'other',
] as const
export type NzilaProduct = (typeof NZILA_PRODUCTS)[number]

export const ONBOARDING_STAGES = [
  'prospect',
  'contract_signed',
  'tenant_created',
  'kickoff_booked',
  'training_complete',
  'live',
  'at_risk',
  'churned',
] as const
export type OnboardingStage = (typeof ONBOARDING_STAGES)[number]

export const CLIENT_HEALTH_VALUES = ['healthy', 'needs_attention', 'at_risk', 'churned'] as const
export type ClientHealth = (typeof CLIENT_HEALTH_VALUES)[number]

export const createOpsClientSchema = z.object({
  orgId: z.string().uuid(),
  companyName: z.string().min(1).max(128),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  product: z.enum(NZILA_PRODUCTS),
  onboardingStage: z.enum(ONBOARDING_STAGES).default('prospect'),
  health: z.enum(CLIENT_HEALTH_VALUES).default('healthy'),
  accountOwnerId: z.string().optional(),
  goLiveDate: z.string().optional(),
  renewalDate: z.string().optional(),
  contractValue: z.string().optional(),
  notes: z.string().optional(),
})
export type CreateOpsClientInput = z.infer<typeof createOpsClientSchema>

/** Display labels for onboarding stages (used in UI) */
export const ONBOARDING_STAGE_LABELS: Record<OnboardingStage, string> = {
  prospect: 'Prospect',
  contract_signed: 'Contract Signed',
  tenant_created: 'Tenant Created',
  kickoff_booked: 'Kickoff Booked',
  training_complete: 'Training Complete',
  live: 'Live',
  at_risk: 'At Risk',
  churned: 'Churned',
}

export const CLIENT_HEALTH_LABELS: Record<ClientHealth, string> = {
  healthy: 'Healthy',
  needs_attention: 'Needs Attention',
  at_risk: 'At Risk',
  churned: 'Churned',
}

/** Ordered pipeline — stages that indicate active onboarding progression */
export const ONBOARDING_PIPELINE: OnboardingStage[] = [
  'prospect',
  'contract_signed',
  'tenant_created',
  'kickoff_booked',
  'training_complete',
  'live',
]

// ── Command Center Types ──────────────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'high' | 'medium'

export const ALERT_TYPES = [
  'renewal_risk',
  'product_spike',
  'onboarding_stall',
  'overload',
  'churn_signal',
  'invoice_overdue',
] as const
export type AlertType = (typeof ALERT_TYPES)[number]

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  renewal_risk: 'Renewal Risk',
  product_spike: 'Product Spike',
  onboarding_stall: 'Onboarding Stall',
  overload: 'Team Overload',
  churn_signal: 'Churn Signal',
  invoice_overdue: 'Invoice Overdue',
}

export const REVENUE_EVENT_TYPES = [
  'contract_signed',
  'renewal',
  'expansion',
  'churn',
  'payment_received',
  'invoice_overdue',
] as const
export type RevenueEventType = (typeof REVENUE_EVENT_TYPES)[number]

export const REVENUE_EVENT_LABELS: Record<RevenueEventType, string> = {
  contract_signed: 'Contract Signed',
  renewal: 'Renewal',
  expansion: 'Expansion',
  churn: 'Churn',
  payment_received: 'Payment Received',
  invoice_overdue: 'Invoice Overdue',
}

export type ProductScoreCategory = 'double_down' | 'maintain' | 'incubate' | 'pause'

export const PRODUCT_SCORE_LABELS: Record<ProductScoreCategory, string> = {
  double_down: 'Double Down',
  maintain: 'Maintain',
  incubate: 'Incubate',
  pause: 'Pause',
}

export const PRODUCT_SCORE_COLORS: Record<ProductScoreCategory, string> = {
  double_down: 'emerald',
  maintain: 'blue',
  incubate: 'amber',
  pause: 'slate',
}

export interface PortfolioProduct {
  readonly key: NzilaProduct
  readonly label: string
  readonly revenueScore: number       // 0–100
  readonly closeabilityScore: number  // 0–100
  readonly supportBurden: number      // 0–100 (lower = better)
  readonly founderEnergy: number      // 0–100 (higher = more required)
  readonly strategicFit: number       // 0–100
  readonly marketPull: number         // 0–100
  readonly buildMaturity: number      // 0–100
  readonly recommendation: ProductScoreCategory
  readonly recommendationNote?: string
}

export type FounderPriorityType = 'renewal' | 'incident' | 'proposal' | 'risk' | 'ops'

export const FOUNDER_PRIORITY_TYPE_LABELS: Record<FounderPriorityType, string> = {
  renewal: 'Renewal',
  incident: 'Incident',
  proposal: 'Proposal',
  risk: 'Risk',
  ops: 'Ops',
}

export const RENEWAL_TASK_STATUSES = ['open', 'completed', 'snoozed'] as const
export type RenewalTaskStatus = (typeof RENEWAL_TASK_STATUSES)[number]
