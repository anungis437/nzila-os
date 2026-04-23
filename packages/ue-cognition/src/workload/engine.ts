/**
 * @nzila/ue-cognition/workload — Module 2: Steward workload balancer.
 *
 * Composes case-risk snapshots + the steward roster (caller-supplied) to
 * compute per-steward workload + an org-level fairness score. Recommends
 * reassignment candidates from the most-loaded steward's high-risk cases.
 */
import type { CognitionSubject } from '@nzila/platform-cognition-core'
import {
  stewardWorkloadSnapshotSchema,
  workloadFairnessSchema,
} from '../schemas'
import type {
  StewardLoadStatus,
  StewardWorkloadSnapshot,
  WorkloadFairness,
} from '../types'
import { latestCaseRiskByCase } from '../case-risk/engine'
import {
  clamp01,
  listRecords,
  makeId,
  mean,
  nowISO,
  stdev,
  writeRecord,
} from '../utils'

const ENTITY = 'workload-snapshots'

export interface StewardWorkloadInput {
  readonly stewardId: string
  readonly subject: CognitionSubject
  readonly currentCaseload: number
  readonly maxCaseload: number
  readonly assignedCaseIds: readonly string[]
  readonly avgResponseDays: number | null
  /** Prior snapshot's utilization (for burnout signal). */
  readonly priorUtilization?: number
}

function statusFor(utilization: number, maxCaseload: number): StewardLoadStatus {
  if (maxCaseload <= 0) return 'unknown'
  if (utilization >= 1.05) return 'overloaded'
  if (utilization >= 0.85) return 'busy'
  if (utilization >= 0.4) return 'balanced'
  return 'idle'
}

export function computeStewardWorkload(input: StewardWorkloadInput): StewardWorkloadSnapshot {
  const utilizationRatio = input.maxCaseload > 0
    ? input.currentCaseload / input.maxCaseload
    : 0

  // Count cases where the latest risk snapshot is high or critical.
  let atRisk = 0
  const reassignments: Array<{ caseId: string; reason: string }> = []
  for (const caseId of input.assignedCaseIds) {
    const risk = latestCaseRiskByCase(caseId)
    if (!risk) continue
    if (risk.riskTier === 'high' || risk.riskTier === 'critical') {
      atRisk += 1
      // Suggest reassignment only when steward is overloaded.
      if (utilizationRatio >= 1) {
        reassignments.push({
          caseId,
          reason: `Steward over capacity (util=${(utilizationRatio * 100).toFixed(0)}%); case is ${risk.riskTier} risk.`,
        })
      }
    }
  }

  // Composite SLA risk: 60% utilization, 30% at-risk share, 10% slow response.
  const atRiskShare = input.assignedCaseIds.length > 0 ? atRisk / input.assignedCaseIds.length : 0
  const responsePenalty = input.avgResponseDays !== null
    ? clamp01((input.avgResponseDays - 3) / 7)  // >3d responses start to count, full at 10d
    : 0
  const slaRiskScore = clamp01(
    0.6 * Math.min(1, utilizationRatio) +
    0.3 * atRiskShare +
    0.1 * responsePenalty,
  )

  // Burnout signal: sustained high utilization across snapshots.
  const burnoutSignal = input.priorUtilization !== undefined && input.priorUtilization >= 0.85 && utilizationRatio >= 0.85
    ? clamp01((utilizationRatio + input.priorUtilization) / 2)
    : 0

  const snapshot: StewardWorkloadSnapshot = {
    id: makeId('wls'),
    stewardId: input.stewardId,
    subject: input.subject,
    currentCaseload: input.currentCaseload,
    maxCaseload: input.maxCaseload,
    utilizationRatio,
    atRiskCaseCount: atRisk,
    avgResponseDays: input.avgResponseDays,
    status: statusFor(utilizationRatio, input.maxCaseload),
    slaRiskScore,
    burnoutSignal,
    recommendedReassignments: reassignments,
    snapshotAt: nowISO(),
  }
  return writeRecord(ENTITY, snapshot.id, snapshot, stewardWorkloadSnapshotSchema) as StewardWorkloadSnapshot
}

export function listWorkloadSnapshots(): StewardWorkloadSnapshot[] {
  return listRecords(ENTITY, stewardWorkloadSnapshotSchema) as StewardWorkloadSnapshot[]
}

export function latestWorkloadByOrg(orgId: string): StewardWorkloadSnapshot[] {
  const byId = new Map<string, StewardWorkloadSnapshot>()
  for (const s of listWorkloadSnapshots()) {
    if (s.subject.orgId !== orgId) continue
    const cur = byId.get(s.stewardId)
    if (!cur || s.snapshotAt > cur.snapshotAt) byId.set(s.stewardId, s)
  }
  return [...byId.values()]
}

export function computeWorkloadFairness(
  subject: CognitionSubject,
  snapshots: readonly StewardWorkloadSnapshot[],
): WorkloadFairness {
  const utils = snapshots.map((s) => s.utilizationRatio)
  const m = mean(utils)
  // 1 - coefficient-of-variation; clamped to [0,1].
  const cv = m > 0 ? stdev(utils) / m : 0
  const fairnessScore = clamp01(1 - cv)
  const fairness: WorkloadFairness = {
    subject,
    stewardCount: snapshots.length,
    fairnessScore,
    meanUtilization: m,
    maxUtilization: utils.length === 0 ? 0 : Math.max(...utils),
    minUtilization: utils.length === 0 ? 0 : Math.min(...utils),
    snapshotAt: nowISO(),
  }
  return workloadFairnessSchema.parse(fairness) as WorkloadFairness
}
