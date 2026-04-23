/**
 * @nzila/ue-cognition — Zod schemas (runtime validators).
 *
 * Shapes intentionally mirror the TypeScript types in `./types.ts` 1:1. The
 * schemas are how the file-backed store guarantees integrity across reads
 * and writes; they also become the source of truth when we wire HTTP
 * responses (so the API never returns an out-of-shape body).
 */
import { z } from 'zod'
import {
  RISK_TIER_THRESHOLDS,
  type CaseRiskFactors,
  type CaseRiskSnapshot,
  type MemberEngagementSnapshot,
  type PrecedentMatch,
  type StewardWorkloadSnapshot,
  type UECognitionAudit,
  type UECognitionKpiSnapshot,
  type WorkloadFairness,
} from './types'

void RISK_TIER_THRESHOLDS

const cognitionSubjectSchema = z.object({
  tenantId: z.string().min(1),
  orgId: z.string().min(1),
  userId: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
})

const trajectoryFeaturesSchema = z.object({
  subject: cognitionSubjectSchema,
  windowStart: z.string(),
  windowEnd: z.string(),
  eventCount: z.number().nonnegative(),
  distinctTypes: z.number().nonnegative(),
  meanGapDays: z.number(),
  frequencySlope: z.number(),
  recencyDays: z.number(),
  negativeSignal: z.number(),
  positiveSignal: z.number(),
  escalationEventCount: z.number().nonnegative(),
})

const trajectoryRiskScoreSchema = z.object({
  subject: cognitionSubjectSchema,
  kind: z.enum(['churn', 'escalation', 'aging', 'disengagement', 'progression']),
  probability: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  contributions: z.array(
    z.object({
      feature: z.string(),
      value: z.number(),
      weight: z.number(),
      contribution: z.number(),
    }),
  ),
  features: trajectoryFeaturesSchema,
  modelVersion: z.string(),
  scoredAt: z.string(),
})

const riskTierSchema = z.enum(['low', 'medium', 'high', 'critical'])

const caseRiskFactorsSchema: z.ZodType<CaseRiskFactors> = z.object({
  ageDays: z.number(),
  slaDeadlineHours: z.number().nullable(),
  stepStage: z.string().nullable(),
  inactivityDays: z.number(),
  negativeEventCount: z.number().nonnegative(),
  escalationEventCount: z.number().nonnegative(),
  stewardWorkloadRatio: z.number().nullable(),
  documentCompleteness: z.number().min(0).max(1),
})

export const caseRiskSnapshotSchema: z.ZodType<CaseRiskSnapshot> = z.object({
  id: z.string(),
  caseId: z.string(),
  caseKind: z.enum(['grievance', 'claim']),
  subject: cognitionSubjectSchema,
  riskScore: z.number().min(0).max(100),
  riskProbability: z.number().min(0).max(1),
  riskTier: riskTierSchema,
  confidence: z.number().min(0).max(1),
  topFactors: z.array(
    z.object({
      factor: z.string(),
      contribution: z.number(),
      explanation: z.string(),
    }),
  ),
  recommendedAction: z.enum([
    'hold_steady',
    'request_status_update',
    'reassign_to_specialist',
    'escalate_to_chief_steward',
    'prepare_arbitration',
    'request_documentation',
  ]),
  rationale: z.string(),
  factors: caseRiskFactorsSchema,
  trajectory: trajectoryRiskScoreSchema,
  modelVersion: z.string(),
  snapshotAt: z.string(),
})

export const stewardWorkloadSnapshotSchema: z.ZodType<StewardWorkloadSnapshot> = z.object({
  id: z.string(),
  stewardId: z.string(),
  subject: cognitionSubjectSchema,
  currentCaseload: z.number().nonnegative(),
  maxCaseload: z.number().positive(),
  utilizationRatio: z.number().nonnegative(),
  atRiskCaseCount: z.number().nonnegative(),
  avgResponseDays: z.number().nullable(),
  status: z.enum(['idle', 'balanced', 'busy', 'overloaded', 'unknown']),
  slaRiskScore: z.number().min(0).max(1),
  burnoutSignal: z.number().min(0).max(1),
  recommendedReassignments: z.array(
    z.object({ caseId: z.string(), reason: z.string() }),
  ),
  snapshotAt: z.string(),
})

export const workloadFairnessSchema: z.ZodType<WorkloadFairness> = z.object({
  subject: cognitionSubjectSchema,
  stewardCount: z.number().nonnegative(),
  fairnessScore: z.number().min(0).max(1),
  meanUtilization: z.number(),
  maxUtilization: z.number(),
  minUtilization: z.number(),
  snapshotAt: z.string(),
})

export const memberEngagementSnapshotSchema: z.ZodType<MemberEngagementSnapshot> = z.object({
  id: z.string(),
  memberId: z.string(),
  subject: cognitionSubjectSchema,
  engagementScore: z.number().min(0).max(100),
  disengagementProbability: z.number().min(0).max(1),
  tier: z.enum(['engaged', 'at_risk', 'disengaged', 'lost']),
  daysSinceLastActivity: z.number().nonnegative(),
  recentSignals: z.object({
    logins30d: z.number().nonnegative(),
    messagesRead30d: z.number().nonnegative(),
    messagesIgnored30d: z.number().nonnegative(),
    eventsAttended30d: z.number().nonnegative(),
    eventsNoShow30d: z.number().nonnegative(),
    unresolvedCaseCount: z.number().nonnegative(),
  }),
  recommendedChannel: z.enum(['email', 'sms', 'phone', 'in_person', 'portal_message']),
  recommendedTimingHours: z.number().nonnegative(),
  modelVersion: z.string(),
  snapshotAt: z.string(),
})

export const precedentMatchSchema: z.ZodType<PrecedentMatch> = z.object({
  id: z.string(),
  forCaseId: z.string(),
  subject: cognitionSubjectSchema,
  matches: z.array(
    z.object({
      caseId: z.string(),
      score: z.number().min(0).max(1),
      tagOverlap: z.number().nonnegative(),
      typeMatch: z.boolean(),
      successful: z.boolean(),
      summary: z.string(),
      resolutionOutcome: z.string().optional(),
      daysToResolve: z.number().optional(),
      settlementAmount: z.number().optional(),
    }),
  ),
  typicalDaysToResolve: z.number().nullable(),
  typicalSettlementAmount: z.number().nullable(),
  successRate: z.number().min(0).max(1),
  retrievedAt: z.string(),
})

export const ueCognitionKpiSnapshotSchema: z.ZodType<UECognitionKpiSnapshot> = z.object({
  id: z.string(),
  subject: cognitionSubjectSchema,
  windowDays: z.number().positive(),
  windowStart: z.string(),
  windowEnd: z.string(),
  avgCycleTimeDays: z.number().nullable(),
  baselineCycleTimeDays: z.number().nullable(),
  cycleTimeReductionPct: z.number().nullable(),
  casesSavedFromSlaBreach: z.number().nullable(),
  casesReassignedBeforeOverload: z.number().nullable(),
  backlogRiskCurrent: z.number().nullable(),
  backlogRiskBaseline: z.number().nullable(),
  backlogRiskReductionPct: z.number().nullable(),
  utilizationFairnessCurrent: z.number().nullable(),
  utilizationFairnessBaseline: z.number().nullable(),
  utilizationFairnessImprovementPct: z.number().nullable(),
  precedentRetrievalsCount: z.number().nonnegative(),
  estimatedHoursSavedPerRetrieval: z.number().nonnegative(),
  precedentHoursSaved: z.number().nonnegative(),
  disengagedMembersStart: z.number().nullable(),
  disengagedMembersEnd: z.number().nullable(),
  engagementRecoveryPct: z.number().nullable(),
  highRiskCasesSurfacedEarly: z.number().nonnegative(),
  estimatedAdminHoursSaved: z.number().nonnegative(),
  loadedHourlyRateCad: z.number().nonnegative(),
  estimatedRoiCad: z.number(),
  assumptions: z.array(
    z.object({
      key: z.string(),
      value: z.number(),
      note: z.string(),
    }),
  ),
  modelVersion: z.string(),
  computedAt: z.string(),
})

export const ueCognitionAuditSchema: z.ZodType<UECognitionAudit> = z.object({
  id: z.string(),
  subject: cognitionSubjectSchema,
  resource: z.enum(['case_risk', 'workload', 'engagement', 'precedent', 'kpi']),
  action: z.enum(['compute', 'view', 'override', 'recommend', 'redact']),
  actorId: z.string().nullable(),
  resourceId: z.string(),
  details: z.record(z.unknown()),
  occurredAt: z.string(),
})
