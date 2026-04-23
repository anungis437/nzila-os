/**
 * @nzila/ue-cognition — Type definitions
 *
 * Union Eyes-specific cognition types that COMPOSE @nzila/platform-cognition-core.
 * The cognition primitives (CognitionSubject, MemoryEvent, TrajectoryRiskScore,
 * etc.) come from platform-cognition-core. This package adds:
 *
 *   • UE domain shapes (CaseRiskSnapshot, StewardWorkloadSnapshot, ...)
 *   • UE-specific memory event taxonomy (UE_MEMORY_TYPES)
 *   • Measurable KPI snapshot type for pilot / commercial reporting
 *
 * @module @nzila/ue-cognition/types
 */
import type {
  CognitionSubject,
  TrajectoryRiskScore,
} from '@nzila/platform-cognition-core'

export const UE_COGNITION_VERSION = '0.1.0'

// ── UE memory event taxonomy ────────────────────────────────────────────────

/**
 * Stable `MemoryEvent.type` values written by Union Eyes adapters. These are
 * the contract between UE app code (which calls recordCaseEvent) and the
 * trajectory/precedent engines (which read them). DO NOT add free-form
 * strings; extend this union.
 */
export type UEMemoryEventType =
  // Grievance lifecycle
  | 'grievance_filed'
  | 'grievance_acknowledged'
  | 'grievance_assigned'
  | 'grievance_step_advanced'
  | 'grievance_response_received'
  | 'grievance_meeting_held'
  | 'grievance_settled'
  | 'grievance_withdrawn'
  | 'grievance_escalated'
  | 'grievance_arbitration_filed'
  // SLA / deadline
  | 'sla_deadline_set'
  | 'sla_deadline_missed'
  | 'sla_deadline_met'
  // Steward
  | 'steward_assigned_case'
  | 'steward_completed_case'
  | 'steward_reassigned'
  // Member
  | 'member_login'
  | 'member_message_sent'
  | 'member_message_read'
  | 'member_message_ignored'
  | 'member_event_attended'
  | 'member_event_no_show'
  | 'member_outreach_attempted'
  // Communication
  | 'communication_sent'
  | 'communication_response_received'
  | 'communication_no_response'

export const UE_MEMORY_TYPES_NEGATIVE: ReadonlySet<string> = new Set([
  'sla_deadline_missed',
  'grievance_escalated',
  'grievance_arbitration_filed',
  'member_message_ignored',
  'member_event_no_show',
  'communication_no_response',
])

export const UE_MEMORY_TYPES_POSITIVE: ReadonlySet<string> = new Set([
  'grievance_settled',
  'sla_deadline_met',
  'member_message_read',
  'member_event_attended',
  'communication_response_received',
])

// ── Risk tiers (enums for storage + UI) ─────────────────────────────────────

export type RiskTier = 'low' | 'medium' | 'high' | 'critical'

export const RISK_TIER_THRESHOLDS = {
  low: 0,
  medium: 0.35,
  high: 0.6,
  critical: 0.85,
} as const

export function tierFromProbability(p: number): RiskTier {
  if (p >= RISK_TIER_THRESHOLDS.critical) return 'critical'
  if (p >= RISK_TIER_THRESHOLDS.high) return 'high'
  if (p >= RISK_TIER_THRESHOLDS.medium) return 'medium'
  return 'low'
}

// ── Module 1 — Case risk snapshot ───────────────────────────────────────────

/**
 * Recommended action vocabulary for case risk. Stable contract for UI badges
 * and decision-engine signals.
 */
export type CaseNextAction =
  | 'hold_steady'              // low risk, no action
  | 'request_status_update'    // gentle nudge to assigned steward
  | 'reassign_to_specialist'   // workload imbalance or specialization mismatch
  | 'escalate_to_chief_steward'// SLA risk crossed
  | 'prepare_arbitration'      // arbitration likelihood crossed threshold
  | 'request_documentation'    // missing artefacts blocking progress

export interface CaseRiskFactors {
  readonly ageDays: number
  readonly slaDeadlineHours: number | null
  readonly stepStage: string | null
  readonly inactivityDays: number
  readonly negativeEventCount: number
  readonly escalationEventCount: number
  readonly stewardWorkloadRatio: number | null
  readonly documentCompleteness: number  // 0..1
}

export interface CaseRiskSnapshot {
  readonly id: string
  readonly caseId: string                // grievance.id or claim.id
  readonly caseKind: 'grievance' | 'claim'
  readonly subject: CognitionSubject
  readonly riskScore: number             // 0..100 (commercial-friendly)
  readonly riskProbability: number       // 0..1 (model-native)
  readonly riskTier: RiskTier
  readonly confidence: number
  readonly topFactors: ReadonlyArray<{
    readonly factor: string
    readonly contribution: number
    readonly explanation: string
  }>
  readonly recommendedAction: CaseNextAction
  readonly rationale: string
  readonly factors: CaseRiskFactors
  readonly trajectory: TrajectoryRiskScore  // raw underlying score for audit
  readonly modelVersion: string
  readonly snapshotAt: string
}

// ── Module 2 — Steward workload snapshot ────────────────────────────────────

export type StewardLoadStatus = 'idle' | 'balanced' | 'busy' | 'overloaded' | 'unknown'

export interface StewardWorkloadSnapshot {
  readonly id: string
  readonly stewardId: string
  readonly subject: CognitionSubject
  readonly currentCaseload: number
  readonly maxCaseload: number
  readonly utilizationRatio: number      // currentCaseload / maxCaseload
  readonly atRiskCaseCount: number       // sum of cases with tier >= 'high'
  readonly avgResponseDays: number | null
  readonly status: StewardLoadStatus
  readonly slaRiskScore: number          // 0..1 — composite of utilization + at-risk + response
  readonly burnoutSignal: number         // 0..1 — sustained high utilization across snapshots
  readonly recommendedReassignments: ReadonlyArray<{
    readonly caseId: string
    readonly reason: string
  }>
  readonly snapshotAt: string
}

export interface WorkloadFairness {
  readonly subject: CognitionSubject
  readonly stewardCount: number
  /** 1 - (stdev / mean) of utilization. 1.0 = perfectly balanced. */
  readonly fairnessScore: number
  readonly meanUtilization: number
  readonly maxUtilization: number
  readonly minUtilization: number
  readonly snapshotAt: string
}

// ── Module 3 — Member engagement snapshot ───────────────────────────────────

export type EngagementTier = 'engaged' | 'at_risk' | 'disengaged' | 'lost'
export type OutreachChannel = 'email' | 'sms' | 'phone' | 'in_person' | 'portal_message'

export interface MemberEngagementSnapshot {
  readonly id: string
  readonly memberId: string
  readonly subject: CognitionSubject
  readonly engagementScore: number        // 0..100, higher = more engaged
  readonly disengagementProbability: number
  readonly tier: EngagementTier
  readonly daysSinceLastActivity: number
  readonly recentSignals: {
    readonly logins30d: number
    readonly messagesRead30d: number
    readonly messagesIgnored30d: number
    readonly eventsAttended30d: number
    readonly eventsNoShow30d: number
    readonly unresolvedCaseCount: number
  }
  readonly recommendedChannel: OutreachChannel
  readonly recommendedTimingHours: number  // hours from now
  readonly modelVersion: string
  readonly snapshotAt: string
}

// ── Module 4 — Precedent matches ────────────────────────────────────────────

export interface PrecedentCaseDescriptor {
  readonly caseId: string
  readonly caseKind: 'grievance' | 'claim'
  readonly type: string
  readonly tags: readonly string[]
  readonly summary: string
  readonly resolutionOutcome?: string
  readonly daysToResolve?: number
  readonly settlementAmount?: number
}

export interface PrecedentMatch {
  readonly id: string
  readonly forCaseId: string
  readonly subject: CognitionSubject
  readonly matches: ReadonlyArray<{
    readonly caseId: string
    readonly score: number              // 0..1
    readonly tagOverlap: number
    readonly typeMatch: boolean
    readonly successful: boolean
    readonly summary: string
    readonly resolutionOutcome?: string
    readonly daysToResolve?: number
    readonly settlementAmount?: number
  }>
  readonly typicalDaysToResolve: number | null
  readonly typicalSettlementAmount: number | null
  readonly successRate: number          // 0..1
  readonly retrievedAt: string
}

// ── Module 5 — KPI snapshot (commercial outputs) ────────────────────────────

/**
 * The 10 KPIs the user explicitly asked for. Every field is either a real
 * computed number with a defined denominator/window, or `null` when source
 * data is insufficient. We never invent values.
 */
export interface UECognitionKpiSnapshot {
  readonly id: string
  readonly subject: CognitionSubject
  readonly windowDays: number             // computation window
  readonly windowStart: string
  readonly windowEnd: string

  // 1. Avg grievance cycle time reduced %
  readonly avgCycleTimeDays: number | null
  readonly baselineCycleTimeDays: number | null
  readonly cycleTimeReductionPct: number | null

  // 2. Cases saved from SLA breach (estimate based on early-warning + resolution)
  readonly casesSavedFromSlaBreach: number | null

  // 3. Cases reassigned before overload
  readonly casesReassignedBeforeOverload: number | null

  // 4. Backlog risk reduced %
  readonly backlogRiskCurrent: number | null
  readonly backlogRiskBaseline: number | null
  readonly backlogRiskReductionPct: number | null

  // 5. Steward utilization balance improved %
  readonly utilizationFairnessCurrent: number | null
  readonly utilizationFairnessBaseline: number | null
  readonly utilizationFairnessImprovementPct: number | null

  // 6. Similar-case retrieval time saved (hours)
  readonly precedentRetrievalsCount: number
  readonly estimatedHoursSavedPerRetrieval: number   // assumption, surfaced
  readonly precedentHoursSaved: number

  // 7. Member engagement recovery %
  readonly disengagedMembersStart: number | null
  readonly disengagedMembersEnd: number | null
  readonly engagementRecoveryPct: number | null

  // 8. High-risk cases surfaced early count
  readonly highRiskCasesSurfacedEarly: number

  // 9. Manual admin hours saved / month (estimate)
  readonly estimatedAdminHoursSaved: number

  // 10. Estimated ROI (CAD)
  readonly loadedHourlyRateCad: number              // assumption, surfaced
  readonly estimatedRoiCad: number

  // Honesty meta
  readonly assumptions: ReadonlyArray<{
    readonly key: string
    readonly value: number
    readonly note: string
  }>
  readonly modelVersion: string
  readonly computedAt: string
}

// ── Audit entry ─────────────────────────────────────────────────────────────

export interface UECognitionAudit {
  readonly id: string
  readonly subject: CognitionSubject
  readonly resource: 'case_risk' | 'workload' | 'engagement' | 'precedent' | 'kpi'
  readonly action: 'compute' | 'view' | 'override' | 'recommend' | 'redact'
  readonly actorId: string | null
  readonly resourceId: string
  readonly details: Readonly<Record<string, unknown>>
  readonly occurredAt: string
}
