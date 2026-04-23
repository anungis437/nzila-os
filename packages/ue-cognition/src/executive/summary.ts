/**
 * @nzila/ue-cognition/executive — Executive Health Summary (Module 5b).
 *
 * One-screen aggregator for COO / president dashboards. Pulls the latest
 * snapshots across all five engines and shapes them into:
 *   • health KPIs
 *   • backlog distribution by tier
 *   • steward heat-map
 *   • disengaged-members count
 *   • prioritised intervention list (no auto-actions)
 */
import type { CognitionSubject } from '@nzila/platform-cognition-core'
import {
  latestCaseRiskByCase,
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
import { latestKpiSnapshot } from '../kpis/engine'
import type {
  CaseRiskSnapshot,
  RiskTier,
  StewardWorkloadSnapshot,
  UECognitionKpiSnapshot,
  WorkloadFairness,
} from '../types'
import { nowISO } from '../utils'

export interface ExecutiveSummary {
  readonly subject: CognitionSubject
  readonly generatedAt: string
  readonly headlineKpis: UECognitionKpiSnapshot | null
  readonly backlog: {
    readonly total: number
    readonly byTier: Record<RiskTier, number>
    readonly topAtRisk: ReadonlyArray<{
      readonly caseId: string
      readonly caseKind: 'grievance' | 'claim'
      readonly tier: RiskTier
      readonly riskScore: number
      readonly recommendedAction: CaseRiskSnapshot['recommendedAction']
      readonly rationale: string
    }>
  }
  readonly stewards: {
    readonly fairness: WorkloadFairness | null
    readonly overloaded: ReadonlyArray<{
      readonly stewardId: string
      readonly utilizationRatio: number
      readonly atRiskCaseCount: number
    }>
    readonly idle: ReadonlyArray<{ readonly stewardId: string; readonly utilizationRatio: number }>
  }
  readonly engagement: {
    readonly disengagedMemberCount: number
    readonly atRiskMemberCount: number
  }
  readonly recommendedInterventions: ReadonlyArray<{
    readonly priority: 'critical' | 'high' | 'medium'
    readonly target: 'case' | 'steward' | 'member'
    readonly summary: string
    readonly resourceId: string
  }>
}

function tieredBacklog(snapshots: readonly CaseRiskSnapshot[]): Record<RiskTier, number> {
  const acc: Record<RiskTier, number> = { low: 0, medium: 0, high: 0, critical: 0 }
  for (const s of snapshots) acc[s.riskTier] += 1
  return acc
}

function latestRiskPerCase(orgId: string): CaseRiskSnapshot[] {
  const byCase = new Map<string, CaseRiskSnapshot>()
  for (const s of listCaseRiskSnapshots()) {
    if (s.subject.orgId !== orgId) continue
    const cur = byCase.get(s.caseId)
    if (!cur || s.snapshotAt > cur.snapshotAt) byCase.set(s.caseId, s)
  }
  return [...byCase.values()]
}

function atRiskMemberCount(orgId: string): number {
  const byMember = new Map<string, ReturnType<typeof listEngagementSnapshots>[number]>()
  for (const s of listEngagementSnapshots()) {
    if (s.subject.orgId !== orgId) continue
    const cur = byMember.get(s.memberId)
    if (!cur || s.snapshotAt > cur.snapshotAt) byMember.set(s.memberId, s)
  }
  let n = 0
  for (const s of byMember.values()) {
    if (s.tier === 'at_risk') n += 1
  }
  return n
}

function buildInterventions(
  cases: readonly CaseRiskSnapshot[],
  stewards: readonly StewardWorkloadSnapshot[],
  disengaged: number,
): ExecutiveSummary['recommendedInterventions'] {
  const out: Array<{
    priority: 'critical' | 'high' | 'medium'
    target: 'case' | 'steward' | 'member'
    summary: string
    resourceId: string
  }> = []

  for (const c of cases) {
    if (c.riskTier === 'critical') {
      out.push({
        priority: 'critical',
        target: 'case',
        summary: `Case ${c.caseId} (${c.caseKind}) — ${c.recommendedAction}: ${c.rationale}`,
        resourceId: c.caseId,
      })
    }
  }
  for (const s of stewards) {
    if (s.status === 'overloaded') {
      out.push({
        priority: 'high',
        target: 'steward',
        summary: `Steward ${s.stewardId} is overloaded (util=${(s.utilizationRatio * 100).toFixed(0)}%, at-risk=${s.atRiskCaseCount}).`,
        resourceId: s.stewardId,
      })
    }
  }
  if (disengaged > 0) {
    out.push({
      priority: 'medium',
      target: 'member',
      summary: `${disengaged} member(s) classified disengaged or lost — review outreach queue.`,
      resourceId: 'org',
    })
  }
  return out
}

export function buildExecutiveSummary(subject: CognitionSubject): ExecutiveSummary {
  const cases = latestRiskPerCase(subject.orgId)
  const stewards = latestWorkloadByOrg(subject.orgId)
  const fairness = stewards.length > 0 ? computeWorkloadFairness(subject, stewards) : null
  const overloaded = stewards
    .filter((s) => s.status === 'overloaded' || s.status === 'busy')
    .map((s) => ({
      stewardId: s.stewardId,
      utilizationRatio: s.utilizationRatio,
      atRiskCaseCount: s.atRiskCaseCount,
    }))
  const idle = stewards
    .filter((s) => s.status === 'idle')
    .map((s) => ({ stewardId: s.stewardId, utilizationRatio: s.utilizationRatio }))

  const topAtRisk = [...cases]
    .filter((c) => c.riskTier === 'high' || c.riskTier === 'critical')
    .sort((a, b) => b.riskProbability - a.riskProbability)
    .slice(0, 10)
    .map((c) => ({
      caseId: c.caseId,
      caseKind: c.caseKind,
      tier: c.riskTier,
      riskScore: c.riskScore,
      recommendedAction: c.recommendedAction,
      rationale: c.rationale,
    }))

  const disengaged = disengagedMembersCount(subject.orgId)

  return {
    subject,
    generatedAt: nowISO(),
    headlineKpis: latestKpiSnapshot(subject.orgId),
    backlog: {
      total: cases.length,
      byTier: tieredBacklog(cases),
      topAtRisk,
    },
    stewards: {
      fairness,
      overloaded,
      idle,
    },
    engagement: {
      disengagedMemberCount: disengaged,
      atRiskMemberCount: atRiskMemberCount(subject.orgId),
    },
    recommendedInterventions: buildInterventions(cases, stewards, disengaged),
  }
}

// Pull-in to satisfy `latestCaseRiskByCase` import linters when caller only
// wants the executive aggregator.
void latestCaseRiskByCase
