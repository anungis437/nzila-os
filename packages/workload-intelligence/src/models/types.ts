import { z } from 'zod'

// ─── Work Item Types ─────────────────────────────────────────────

export const WorkItemTypes = {
  GRIEVANCE: 'grievance',
  CONSULTATION: 'consultation',
  MEMBER_CALL: 'member_call',
  COMMITTEE: 'committee',
  BARGAINING: 'bargaining',
  ARBITRATION: 'arbitration',
  SETTLEMENT: 'settlement',
  ADMIN: 'admin',
} as const

export type WorkItemType = (typeof WorkItemTypes)[keyof typeof WorkItemTypes]

// ─── Intake Submission (Member-Created) ──────────────────────────

export const IntakeStatuses = {
  NEW: 'new',
  UNDER_REVIEW: 'under_review',
  AWAITING_MEMBER_INFO: 'awaiting_member_info',
  CONVERTED: 'converted',
  CLOSED_NO_CASE: 'closed_no_case',
} as const

export type IntakeStatus = (typeof IntakeStatuses)[keyof typeof IntakeStatuses]

export interface IntakeSubmission {
  readonly id: string
  readonly orgId: string
  readonly submittedByMemberId: string
  readonly title: string
  readonly description: string
  readonly submittedAt: string
  readonly attachments: readonly string[]
  readonly urgencyIndicators: readonly UrgencySignal[]
  readonly status: IntakeStatus
  readonly linkedWorkItemId?: string
  readonly metadata: Record<string, unknown>
}

// ─── Official Work Item (Rep/LRO-Created) ────────────────────────

export const OfficialWorkItemStatuses = {
  ACTIVE: 'active',
  WAITING: 'waiting',
  CLOSED: 'closed',
} as const

export type OfficialWorkItemStatus =
  (typeof OfficialWorkItemStatuses)[keyof typeof OfficialWorkItemStatuses]

export interface OfficialWorkItem {
  readonly id: string
  readonly orgId: string
  readonly createdByRepId: string
  readonly sourceIntakeId?: string
  readonly type: WorkItemType
  readonly title: string
  readonly description?: string
  readonly createdAt: string
  readonly dueAt?: string
  readonly stakeholders: readonly string[]
  readonly status: OfficialWorkItemStatus
  readonly urgencySignals: readonly UrgencySignal[]
  readonly riskSignals: readonly RiskSignal[]
  readonly strategicSignals: readonly StrategicSignal[]
  readonly metadata: Record<string, unknown>
}

// ─── Queue Buckets ───────────────────────────────────────────────

export const QueueBucketTypes = {
  INTAKE_REVIEW: 'intake_review',
  ACTIVE_CASES: 'active_cases',
  SCHEDULED_EVENTS: 'scheduled_events',
  STRATEGIC_WORK: 'strategic_work',
  ADMIN: 'admin',
} as const

export type QueueBucket = (typeof QueueBucketTypes)[keyof typeof QueueBucketTypes]

// ─── Urgency Signals ─────────────────────────────────────────────

export const UrgencySignalTypes = {
  DEADLINE: 'deadline',
  ESCALATION: 'escalation',
  MEMBER_PRESSURE: 'member_pressure',
} as const

export type UrgencySignalType = (typeof UrgencySignalTypes)[keyof typeof UrgencySignalTypes]

export interface UrgencySignal {
  readonly type: UrgencySignalType
  readonly weight: number
}

// ─── Risk Signals ────────────────────────────────────────────────

export const RiskSignalTypes = {
  LEGAL: 'legal',
  PRECEDENT: 'precedent',
  PATTERN_DETECTED: 'pattern_detected',
} as const

export type RiskSignalType = (typeof RiskSignalTypes)[keyof typeof RiskSignalTypes]

export const RiskSeverities = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const

export type RiskSeverity = (typeof RiskSeverities)[keyof typeof RiskSeverities]

export interface RiskSignal {
  readonly type: RiskSignalType
  readonly severity: RiskSeverity
}

// ─── Strategic Signals ───────────────────────────────────────────

export const StrategicSignalTypes = {
  BARGAINING_PHASE: 'bargaining_phase',
  ORGANIZATIONAL_PRIORITY: 'organizational_priority',
} as const

export type StrategicSignalType = (typeof StrategicSignalTypes)[keyof typeof StrategicSignalTypes]

export interface StrategicSignal {
  readonly type: StrategicSignalType
  readonly impact: number
}

// ─── Work Item ───────────────────────────────────────────────────

export interface WorkItem {
  readonly id: string
  readonly orgId: string
  readonly type: WorkItemType
  readonly title: string
  readonly description?: string
  readonly createdAt: string
  readonly dueAt?: string
  readonly stakeholders: readonly string[]
  readonly urgencySignals: readonly UrgencySignal[]
  readonly riskSignals: readonly RiskSignal[]
  readonly strategicSignals: readonly StrategicSignal[]
  readonly metadata: Record<string, unknown>
}

// ─── Priority Levels ─────────────────────────────────────────────

export const PriorityLevels = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const

export type PriorityLevel = (typeof PriorityLevels)[keyof typeof PriorityLevels]

// ─── Prioritized Work Item (Output Contract) ────────────────────

export interface PrioritizedWorkItem {
  readonly id: string
  readonly priorityScore: number
  readonly priorityLevel: PriorityLevel
  readonly explanation: string
  readonly confidence: number
  readonly contributingFactors: readonly string[]
  readonly auditId: string
}

// ─── Prioritization Result ───────────────────────────────────────

export interface PrioritizationResult {
  readonly orgId: string
  readonly items: readonly PrioritizedWorkItem[]
  readonly generatedAt: string
  readonly totalProcessed: number
  readonly averageConfidence: number
}

// ─── Signal Scores (internal) ────────────────────────────────────

export interface SignalScores {
  readonly urgency: number
  readonly risk: number
  readonly strategic: number
  readonly saturation: number
}

// ─── Scoring Weights ─────────────────────────────────────────────

export interface ScoringWeights {
  readonly urgency: number
  readonly risk: number
  readonly strategic: number
  readonly saturation: number
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  urgency: 0.30,
  risk: 0.35,
  strategic: 0.20,
  saturation: 0.15,
}

// ─── Metrics ─────────────────────────────────────────────────────

export interface PrioritizationMetrics {
  readonly decisionsGenerated: number
  readonly averageProcessingMs: number
  readonly overrideRate: number
  readonly averageConfidence: number
}

// ─── Zod Schemas ─────────────────────────────────────────────────

export const urgencySignalSchema = z.object({
  type: z.enum(['deadline', 'escalation', 'member_pressure']),
  weight: z.number().min(0).max(1),
})

export const riskSignalSchema = z.object({
  type: z.enum(['legal', 'precedent', 'pattern_detected']),
  severity: z.enum(['low', 'medium', 'high']),
})

export const strategicSignalSchema = z.object({
  type: z.enum(['bargaining_phase', 'organizational_priority']),
  impact: z.number().min(0).max(1),
})

export const workItemSchema = z.object({
  id: z.string().min(1),
  orgId: z.string().min(1),
  type: z.enum([
    'grievance', 'consultation', 'member_call', 'committee',
    'bargaining', 'arbitration', 'settlement', 'admin',
  ]),
  title: z.string().min(1),
  description: z.string().optional(),
  createdAt: z.string().datetime(),
  dueAt: z.string().datetime().optional(),
  stakeholders: z.array(z.string()),
  urgencySignals: z.array(urgencySignalSchema),
  riskSignals: z.array(riskSignalSchema),
  strategicSignals: z.array(strategicSignalSchema),
  metadata: z.record(z.unknown()),
})

// ─── Intake Submission Schema ────────────────────────────────────

export const intakeSubmissionSchema = z.object({
  id: z.string().min(1),
  orgId: z.string().min(1),
  submittedByMemberId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  submittedAt: z.string().datetime(),
  attachments: z.array(z.string()),
  urgencyIndicators: z.array(urgencySignalSchema),
  status: z.enum(['new', 'under_review', 'awaiting_member_info', 'converted', 'closed_no_case']),
  linkedWorkItemId: z.string().optional(),
  metadata: z.record(z.unknown()),
})

// ─── Official Work Item Schema ───────────────────────────────────

export const officialWorkItemSchema = z.object({
  id: z.string().min(1),
  orgId: z.string().min(1),
  createdByRepId: z.string().min(1),
  sourceIntakeId: z.string().optional(),
  type: z.enum([
    'grievance', 'consultation', 'member_call', 'committee',
    'bargaining', 'arbitration', 'settlement', 'admin',
  ]),
  title: z.string().min(1),
  description: z.string().optional(),
  createdAt: z.string().datetime(),
  dueAt: z.string().datetime().optional(),
  stakeholders: z.array(z.string()),
  status: z.enum(['active', 'waiting', 'closed']),
  urgencySignals: z.array(urgencySignalSchema),
  riskSignals: z.array(riskSignalSchema),
  strategicSignals: z.array(strategicSignalSchema),
  metadata: z.record(z.unknown()),
})
