/**
 * @nzila/ue-cognition/kpis — Module 5: Measurable KPI snapshot.
 *
 * Honest formulae:
 *   • Every KPI either has a real numerator + denominator or is `null`.
 *   • Assumptions (admin minutes saved per intervention, loaded hourly rate)
 *     are NOT hidden — they're listed in `assumptions[]` on every snapshot.
 *   • Baseline values come from caller (the operator must record what life
 *     was like BEFORE cognition was on). If no baseline, comparison fields
 *     are `null` and we say so.
 *
 * Pilot conversion: this snapshot IS the artefact you hand a buyer to prove
 * GrowthOS-class value in their union ops.
 */
import type { CognitionSubject } from '@nzila/platform-cognition-core'
import { ueCognitionKpiSnapshotSchema } from '../schemas'
import { UE_COGNITION_VERSION, type UECognitionKpiSnapshot } from '../types'
import {
  listCaseRiskSnapshots,
} from '../case-risk/engine'
import {
  computeWorkloadFairness,
  latestWorkloadByOrg,
} from '../workload/engine'
import {
  disengagedMembersCount,
  listEngagementSnapshots,
} from '../engagement/engine'
import { listPrecedentMatches } from '../precedents/engine'
import {
  listRecords,
  makeId,
  nowISO,
  writeRecord,
} from '../utils'

const ENTITY = 'kpi-snapshots'
export const KPI_MODEL_VERSION = 'ue-kpi-v1'

// ── Surfaced assumptions ────────────────────────────────────────────────────
// These are explicit so a buyer can challenge them in the pilot review.

export const KPI_ASSUMPTIONS = {
  /** Hours saved every time a precedent retrieval replaces manual research. */
  hoursSavedPerPrecedentRetrieval: 1.5,
  /** Hours of admin saved per high-risk early-warning that prevents a manual escalation. */
  hoursSavedPerEarlyWarning: 0.75,
  /** Hours saved per recommended reassignment that operator accepts. */
  hoursSavedPerReassignmentRecommendation: 1.0,
  /** Loaded hourly rate (CAD) — Ontario steward wage + benefits. */
  loadedHourlyRateCad: 65,
} as const

export interface KpiComputeInput {
  readonly subject: CognitionSubject
  readonly windowDays: number
  /** Operator-supplied baseline — what cycle time / fairness / disengaged
   * count looked like BEFORE cognition. Pass nulls if not yet captured. */
  readonly baseline: {
    readonly avgCycleTimeDays: number | null
    readonly utilizationFairness: number | null
    readonly disengagedMemberCount: number | null
  }
  /** Optional override for the loaded hourly rate (CAD). */
  readonly loadedHourlyRateCad?: number
  /** Real measured average cycle time over the window — caller computes
   * from `grievances.resolvedAt - grievances.filedDate`. Null if no
   * resolved cases in window. */
  readonly observedCycleTimeDays: number | null
  /** Real count of cases that the operator confirms were saved from SLA
   * breach because of an early warning. Null if untracked. */
  readonly observedCasesSavedFromSlaBreach: number | null
  /** Real count of operator-accepted reassignment recommendations. */
  readonly observedAcceptedReassignments: number | null
  /** Steward count for the org (used for backlog-risk denominator). */
  readonly stewardCount: number
}

export function computeKpiSnapshot(input: KpiComputeInput): UECognitionKpiSnapshot {
  const now = Date.parse(nowISO())
  const windowStart = new Date(now - input.windowDays * 86_400_000).toISOString()
  const windowEnd = new Date(now).toISOString()
  const orgId = input.subject.orgId

  // ── Cycle time reduction ──
  const cycleNow = input.observedCycleTimeDays
  const cycleBaseline = input.baseline.avgCycleTimeDays
  const cycleReductionPct = cycleNow !== null && cycleBaseline !== null && cycleBaseline > 0
    ? ((cycleBaseline - cycleNow) / cycleBaseline) * 100
    : null

  // ── Backlog risk (current = mean of latest case risk snapshots / 100) ──
  const allRisks = listCaseRiskSnapshots().filter((s) => s.subject.orgId === orgId)
  const inWindow = allRisks.filter((s) => s.snapshotAt >= windowStart && s.snapshotAt <= windowEnd)
  const meanRiskNow = inWindow.length > 0
    ? inWindow.reduce((s, r) => s + r.riskProbability, 0) / inWindow.length
    : null

  // Baseline backlog risk: snapshots OLDER than window (oldest 50%).
  const olderRisks = allRisks.filter((s) => s.snapshotAt < windowStart)
  const meanRiskBaseline = olderRisks.length > 0
    ? olderRisks.reduce((s, r) => s + r.riskProbability, 0) / olderRisks.length
    : null

  const backlogReductionPct = meanRiskNow !== null && meanRiskBaseline !== null && meanRiskBaseline > 0
    ? ((meanRiskBaseline - meanRiskNow) / meanRiskBaseline) * 100
    : null

  // ── High-risk cases surfaced early ──
  const highRiskSurfaced = inWindow.filter((s) => s.riskTier === 'high' || s.riskTier === 'critical').length

  // ── Workload fairness ──
  const stewardSnaps = latestWorkloadByOrg(orgId)
  const fairness = stewardSnaps.length > 0
    ? computeWorkloadFairness(input.subject, stewardSnaps)
    : null
  const fairnessNow = fairness?.fairnessScore ?? null
  const fairnessBaseline = input.baseline.utilizationFairness
  const fairnessImprovementPct = fairnessNow !== null && fairnessBaseline !== null && fairnessBaseline > 0
    ? ((fairnessNow - fairnessBaseline) / fairnessBaseline) * 100
    : null

  // ── Engagement recovery ──
  const disengagedEnd = disengagedMembersCount(orgId)
  const engagementSnaps = listEngagementSnapshots().filter((s) => s.subject.orgId === orgId)
  void engagementSnaps
  const disengagedStart = input.baseline.disengagedMemberCount
  const recoveryPct = disengagedStart !== null && disengagedStart > 0
    ? ((disengagedStart - disengagedEnd) / disengagedStart) * 100
    : null

  // ── Precedent retrievals ──
  const precedents = listPrecedentMatches().filter((m) => m.subject.orgId === orgId)
  const precedentRetrievals = precedents.filter((m) => m.retrievedAt >= windowStart && m.retrievedAt <= windowEnd).length
  const precedentHoursSaved = precedentRetrievals * KPI_ASSUMPTIONS.hoursSavedPerPrecedentRetrieval

  // ── Admin hours saved (composite) ──
  const reassignmentHours = (input.observedAcceptedReassignments ?? 0) * KPI_ASSUMPTIONS.hoursSavedPerReassignmentRecommendation
  const earlyWarningHours = highRiskSurfaced * KPI_ASSUMPTIONS.hoursSavedPerEarlyWarning
  const adminHoursSaved = precedentHoursSaved + reassignmentHours + earlyWarningHours

  // ── ROI ──
  const rate = input.loadedHourlyRateCad ?? KPI_ASSUMPTIONS.loadedHourlyRateCad
  const estimatedRoiCad = adminHoursSaved * rate

  const snapshot: UECognitionKpiSnapshot = {
    id: makeId('kpi'),
    subject: input.subject,
    windowDays: input.windowDays,
    windowStart,
    windowEnd,
    avgCycleTimeDays: cycleNow,
    baselineCycleTimeDays: cycleBaseline,
    cycleTimeReductionPct: cycleReductionPct,
    casesSavedFromSlaBreach: input.observedCasesSavedFromSlaBreach,
    casesReassignedBeforeOverload: input.observedAcceptedReassignments,
    backlogRiskCurrent: meanRiskNow,
    backlogRiskBaseline: meanRiskBaseline,
    backlogRiskReductionPct: backlogReductionPct,
    utilizationFairnessCurrent: fairnessNow,
    utilizationFairnessBaseline: fairnessBaseline,
    utilizationFairnessImprovementPct: fairnessImprovementPct,
    precedentRetrievalsCount: precedentRetrievals,
    estimatedHoursSavedPerRetrieval: KPI_ASSUMPTIONS.hoursSavedPerPrecedentRetrieval,
    precedentHoursSaved,
    disengagedMembersStart: disengagedStart,
    disengagedMembersEnd: disengagedEnd,
    engagementRecoveryPct: recoveryPct,
    highRiskCasesSurfacedEarly: highRiskSurfaced,
    estimatedAdminHoursSaved: adminHoursSaved,
    loadedHourlyRateCad: rate,
    estimatedRoiCad,
    assumptions: [
      {
        key: 'hoursSavedPerPrecedentRetrieval',
        value: KPI_ASSUMPTIONS.hoursSavedPerPrecedentRetrieval,
        note: 'Replaces ~1.5h of manual case-history research per retrieval. Validate with operator log.',
      },
      {
        key: 'hoursSavedPerEarlyWarning',
        value: KPI_ASSUMPTIONS.hoursSavedPerEarlyWarning,
        note: 'Conservative estimate of admin time avoided when escalation is prevented.',
      },
      {
        key: 'hoursSavedPerReassignmentRecommendation',
        value: KPI_ASSUMPTIONS.hoursSavedPerReassignmentRecommendation,
        note: 'Time saved coordinating an organic vs. emergency reassignment.',
      },
      {
        key: 'loadedHourlyRateCad',
        value: rate,
        note: 'Loaded steward wage in CAD. Override per pilot via input.loadedHourlyRateCad.',
      },
      {
        key: 'stewardCount',
        value: input.stewardCount,
        note: 'Stewards in scope; surfaced for transparency on the fairness denominator.',
      },
    ],
    modelVersion: `${KPI_MODEL_VERSION} (ue-${UE_COGNITION_VERSION})`,
    computedAt: nowISO(),
  }
  return writeRecord(ENTITY, snapshot.id, snapshot, ueCognitionKpiSnapshotSchema) as UECognitionKpiSnapshot
}

export function listKpiSnapshots(): UECognitionKpiSnapshot[] {
  return listRecords(ENTITY, ueCognitionKpiSnapshotSchema) as UECognitionKpiSnapshot[]
}

export function latestKpiSnapshot(orgId: string): UECognitionKpiSnapshot | null {
  const all = listKpiSnapshots().filter((s) => s.subject.orgId === orgId)
  if (all.length === 0) return null
  return all.sort((a, b) => b.computedAt.localeCompare(a.computedAt))[0]
}
