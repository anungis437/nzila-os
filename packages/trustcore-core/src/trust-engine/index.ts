/**
 * Trust engine composition layer.
 *
 * EXTENDS — never replaces — the existing apps/trustcore engine. Consumers
 * pass in the already-computed ComplianceEvaluation and receive a
 * TrustOpsView that bundles deterministic score, scheduled remediation
 * tasks, and a stable summary suitable for dashboards.
 *
 * Importantly, the in-app engine remains the SOURCE OF TRUTH for the
 * compliance score. This module only re-derives the score from a structured
 * set of deductions when callers want to score WITHOUT the in-app engine
 * (e.g., from raw risk-register rows).
 */

import {
  computeTrustScore,
  type ScoreCategory,
  type TrustScoreResult,
} from '../scoring/computeTrustScore'
import { scheduleFromRisk, type ScheduledTask } from '../tasks/index'
import type {
  RiskRegisterCategory,
  RiskRegisterSeverity,
  RiskRegisterStatus,
} from '../risks/index'
import { isOpenRisk, compareSeverityDesc } from '../risks/index'

export interface RegisterRiskLike {
  id: string
  title: string
  category: RiskRegisterCategory
  severity: RiskRegisterSeverity
  status: RiskRegisterStatus
  /** Numeric deduction the rule contributes, before category capping. */
  deduction?: number
  /** True for risks that block compliance regardless of score. */
  blocking?: boolean
}

export interface TrustOpsView {
  score: TrustScoreResult
  openRisks: RegisterRiskLike[]
  tasks: ScheduledTask[]
}

/** Map register categories → score categories. */
function toScoreCategory(c: RiskRegisterCategory): ScoreCategory | null {
  switch (c) {
    case 'governance': return 'governance'
    case 'data':       return 'data'
    case 'pia':        return 'pia'
    case 'incidents':  return 'incidents'
    case 'dsr':        return 'dsr'
    case 'vendors':    return 'vendors'
    // Cross-cutting categories (security, operational, legal, financial)
    // do not currently map to a single score bucket — count them under
    // governance so they still influence the score.
    default:           return 'governance'
  }
}

/**
 * Build the Trust Ops view from a list of register risks.
 *
 *   - Score = computeTrustScore from per-risk deductions.
 *   - Tasks = one per OPEN risk, ordered by severity desc.
 */
export function buildTrustOpsView(
  risks: RegisterRiskLike[],
  now: Date,
): TrustOpsView {
  const open = risks.filter((r) => isOpenRisk(r.status))
  const ordered = [...open].sort((a, b) => compareSeverityDesc(a.severity, b.severity))

  const deductions = open.flatMap((r) => {
    const cat = toScoreCategory(r.category)
    if (!cat || !r.deduction) return []
    return [{ category: cat, raw: r.deduction }]
  })

  const score = computeTrustScore({
    deductions,
    hasBlockingRisks: open.some((r) => r.blocking === true),
  })

  const tasks = ordered.map((r) =>
    scheduleFromRisk(
      { riskId: r.id, title: r.title, severity: r.severity },
      now,
    ),
  )

  return { score, openRisks: ordered, tasks }
}
