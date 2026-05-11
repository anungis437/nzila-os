/**
 * Deterministic trust score.
 *
 * Mirrors apps/trustcore/lib/compliance/engine.ts CATEGORY_CAPS + thresholds
 * so package consumers get the same scoring behaviour as the in-app engine.
 */

export const CATEGORY_CAPS = {
  governance: 30,
  data: 25,
  pia: 20,
  incidents: 35,
  dsr: 25,
  vendors: 20,
} as const

export type ScoreCategory = keyof typeof CATEGORY_CAPS

export type TrustStatus = 'compliant' | 'at-risk' | 'non-compliant'

export interface CategoryDeduction {
  category: ScoreCategory
  /** Raw deduction proposed by a rule before capping. */
  raw: number
}

export interface TrustScoreInput {
  /** Per-rule deductions; will be summed per-category and capped. */
  deductions: CategoryDeduction[]
  /** Any blocking risks force at-most "at-risk" status. */
  hasBlockingRisks?: boolean
}

export interface TrustScoreResult {
  score: number
  status: TrustStatus
  perCategory: Record<ScoreCategory, number>
}

/**
 * Compute the deterministic trust score.
 *
 *   score = max(0, 100 − Σ min(rawByCategory, CATEGORY_CAPS[category]))
 *
 * Status thresholds:
 *   compliant     → score ≥ 85 AND no blocking risks
 *   at-risk       → score 60..84, OR (blocking risks AND score ≥ 60)
 *   non-compliant → score < 60
 */
export function computeTrustScore(input: TrustScoreInput): TrustScoreResult {
  const perCategory: Record<ScoreCategory, number> = {
    governance: 0,
    data: 0,
    pia: 0,
    incidents: 0,
    dsr: 0,
    vendors: 0,
  }

  for (const d of input.deductions) {
    perCategory[d.category] += Math.max(0, d.raw)
  }

  let total = 0
  for (const key of Object.keys(perCategory) as ScoreCategory[]) {
    const capped = Math.min(perCategory[key], CATEGORY_CAPS[key])
    perCategory[key] = capped
    total += capped
  }

  const score = Math.max(0, 100 - total)

  let status: TrustStatus
  if (score < 60) {
    status = 'non-compliant'
  } else if (score >= 85 && !input.hasBlockingRisks) {
    status = 'compliant'
  } else {
    status = 'at-risk'
  }

  return { score, status, perCategory }
}
