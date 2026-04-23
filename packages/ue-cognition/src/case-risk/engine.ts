/**
 * @nzila/ue-cognition/case-risk — Module 1: Grievance trajectory intelligence.
 *
 * Composes:
 *   • @nzila/platform-cognition-core/trajectory (escalation + aging scorers)
 *   • @nzila/platform-cognition-core/memory     (event recall for the case)
 *   • @nzila/platform-decision-engine adapter   (riskScoreToSignal)
 *
 * Inputs come from Union Eyes case rows (grievance OR claim). The caller is
 * responsible for assembling the `CaseRiskInput` from the DB — this module
 * does NOT import drizzle so it can be called from server actions, jobs,
 * tests, or scripts identically.
 */
import {
  COGNITION_ENGINE_VERSION,
  riskScoresToSignals,
  trajectory as cognitionTrajectory,
  type CognitionSubject,
  type MemoryEvent,
  type TrajectoryRiskScore,
} from '@nzila/platform-cognition-core'
import {
  caseRiskSnapshotSchema,
} from '../schemas'
import {
  type CaseNextAction,
  type CaseRiskFactors,
  type CaseRiskSnapshot,
  tierFromProbability,
  UE_COGNITION_VERSION,
} from '../types'
import {
  clamp01,
  daysBetween,
  listRecords,
  makeId,
  nowISO,
  writeRecord,
} from '../utils'

const ENTITY = 'case-risk-snapshots'

export const CASE_RISK_MODEL_VERSION = `ue-case-risk-v1+core-${COGNITION_ENGINE_VERSION}`

export interface CaseRiskInput {
  readonly caseId: string
  readonly caseKind: 'grievance' | 'claim'
  readonly subject: CognitionSubject
  readonly filedDate: string                      // ISO
  readonly status: string
  readonly stepStage: string | null
  readonly responseDeadline: string | null        // ISO; null if no SLA
  readonly assignedStewardWorkloadRatio: number | null  // currentCaseload / max
  readonly attachmentsCount: number
  readonly requiredDocumentCount: number          // 0 means we cannot judge completeness
  readonly events: readonly MemoryEvent[]         // memory events for THIS case
  readonly now?: string
}

function pickEscalationOrAging(scores: readonly TrajectoryRiskScore[]): TrajectoryRiskScore {
  // Use the higher-probability of escalation/aging as the headline trajectory
  // for a case. Escalation captures negative momentum; aging captures stall.
  const interesting = scores.filter((s) => s.kind === 'escalation' || s.kind === 'aging')
  if (interesting.length === 0) return scores[0]
  return interesting.reduce((max, s) => (s.probability > max.probability ? s : max), interesting[0])
}

function computeFactors(input: CaseRiskInput, headline: TrajectoryRiskScore): CaseRiskFactors {
  const now = input.now ?? nowISO()
  const ageDays = daysBetween(input.filedDate, now)
  const lastEventAt = input.events.length > 0
    ? input.events[input.events.length - 1].occurredAt
    : input.filedDate
  const inactivityDays = daysBetween(lastEventAt, now)
  const slaDeadlineHours = input.responseDeadline
    ? (Date.parse(input.responseDeadline) - Date.parse(now)) / 3_600_000
    : null
  const documentCompleteness = input.requiredDocumentCount > 0
    ? clamp01(input.attachmentsCount / input.requiredDocumentCount)
    : 1
  return {
    ageDays,
    slaDeadlineHours,
    stepStage: input.stepStage,
    inactivityDays,
    negativeEventCount: Math.round(headline.features.negativeSignal),
    escalationEventCount: headline.features.escalationEventCount,
    stewardWorkloadRatio: input.assignedStewardWorkloadRatio,
    documentCompleteness,
  }
}

function pickAction(
  factors: CaseRiskFactors,
  riskProbability: number,
  headlineKind: TrajectoryRiskScore['kind'],
): { action: CaseNextAction; rationale: string } {
  if (riskProbability >= 0.85 && headlineKind === 'escalation') {
    return {
      action: 'prepare_arbitration',
      rationale: 'Escalation probability is critical and momentum is negative.',
    }
  }
  if (factors.slaDeadlineHours !== null && factors.slaDeadlineHours <= 24 && riskProbability >= 0.5) {
    return {
      action: 'escalate_to_chief_steward',
      rationale: 'SLA deadline is within 24h with elevated risk.',
    }
  }
  if (factors.documentCompleteness < 0.5 && factors.ageDays >= 5) {
    return {
      action: 'request_documentation',
      rationale: 'Case is older than 5 days with less than half the required documentation captured.',
    }
  }
  if (
    factors.stewardWorkloadRatio !== null &&
    factors.stewardWorkloadRatio >= 0.95 &&
    riskProbability >= 0.4
  ) {
    return {
      action: 'reassign_to_specialist',
      rationale: 'Assigned steward is at or over capacity and case risk is elevated.',
    }
  }
  if (factors.inactivityDays >= 7 && riskProbability >= 0.35) {
    return {
      action: 'request_status_update',
      rationale: 'No case activity in 7+ days while risk is rising.',
    }
  }
  return {
    action: 'hold_steady',
    rationale: 'Risk is contained; no intervention recommended.',
  }
}

function topFactors(
  trajectoryScore: TrajectoryRiskScore,
): CaseRiskSnapshot['topFactors'] {
  // Pick top 3 by absolute contribution
  const sorted = [...trajectoryScore.contributions]
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 3)
  return sorted.map((c) => ({
    factor: c.feature,
    contribution: c.contribution,
    explanation: explainFeature(c.feature, c.value),
  }))
}

function explainFeature(feature: string, value: number): string {
  switch (feature) {
    case 'recency_norm':
      return `Last activity normalised to a 30-day window: ${(value * 30).toFixed(0)}d ago`
    case 'freq_decline':
      return `Event frequency is declining (slope magnitude ${value.toFixed(2)} events/day²)`
    case 'event_density':
      return `Event density across window: ${(value * 30).toFixed(0)} events`
    case 'negative_load':
      return `Cumulative negative-valence salience: ${(value * 5).toFixed(2)}`
    case 'positive_load':
      return `Cumulative positive-valence salience: ${(value * 5).toFixed(2)}`
    case 'escalation_count':
      return `Escalation-tagged events in window: ${(value * 5).toFixed(0)}`
    case 'mean_gap_norm':
      return `Mean gap between events normalised to 30d: ${(value * 30).toFixed(1)}d`
    case 'type_diversity':
      return `Distinct event types: ${(value * 8).toFixed(0)}`
    default:
      return `${feature}=${value.toFixed(2)}`
  }
}

export function computeCaseRisk(input: CaseRiskInput): CaseRiskSnapshot {
  const now = input.now ?? nowISO()
  const windowStart = input.filedDate
  const windowEnd = now

  const features = cognitionTrajectory.extractTrajectoryFeatures({
    subject: input.subject,
    events: input.events,
    windowStart,
    windowEnd,
  })

  const allScores = cognitionTrajectory.scoreAllRisks(features, now)
  const headline = pickEscalationOrAging(allScores)
  const factors = computeFactors(input, headline)
  const { action, rationale } = pickAction(factors, headline.probability, headline.kind)

  const snapshot: CaseRiskSnapshot = {
    id: makeId('crs'),
    caseId: input.caseId,
    caseKind: input.caseKind,
    subject: input.subject,
    riskScore: Math.round(headline.probability * 100),
    riskProbability: headline.probability,
    riskTier: tierFromProbability(headline.probability),
    confidence: headline.confidence,
    topFactors: topFactors(headline),
    recommendedAction: action,
    rationale,
    factors,
    trajectory: headline,
    modelVersion: `${CASE_RISK_MODEL_VERSION} (ue-${UE_COGNITION_VERSION})`,
    snapshotAt: now,
  }
  return writeRecord(ENTITY, snapshot.id, snapshot, caseRiskSnapshotSchema) as CaseRiskSnapshot
}

export function listCaseRiskSnapshots(): CaseRiskSnapshot[] {
  return listRecords(ENTITY, caseRiskSnapshotSchema) as CaseRiskSnapshot[]
}

export function latestCaseRiskByCase(caseId: string): CaseRiskSnapshot | null {
  const all = listCaseRiskSnapshots().filter((s) => s.caseId === caseId)
  if (all.length === 0) return null
  return all.sort((a, b) => b.snapshotAt.localeCompare(a.snapshotAt))[0]
}

/**
 * Convert one or more case risk snapshots into decision-engine OperationalSignal[]
 * via the cognition-core adapter. Caller can then feed these into
 * generateDecisions to produce reviewable decision records.
 */
export function caseRisksToSignals(snapshots: readonly CaseRiskSnapshot[]) {
  return riskScoresToSignals(snapshots.map((s) => s.trajectory))
}
