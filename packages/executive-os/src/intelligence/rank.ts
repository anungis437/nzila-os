/**
 * Executive Ranking Engine
 *
 * Canonical scoring utility for ExecutiveOS recommendations and risks.
 * Pure, deterministic, and explainable — every input contributes a weighted
 * sub-score that is surfaced in the `explanation` field.
 *
 * Design goals:
 *   - Rank by value × urgency × confidence, adjusted for effort / reversibility
 *   - Bias toward reversible, high-confidence, high-leverage items first
 *   - Always emit an explanation so users can contest the ranking
 *   - Ties broken by confidence (we prefer certain actions to speculative ones)
 *
 * Not goals:
 *   - ML-based ranking. This is a transparent rule engine. Feedback from
 *     `executive_recommendation_outcomes` tunes the WEIGHTS over time, not
 *     the shape of the function.
 */

export type RankBucket = 'now' | 'today' | 'this_week' | 'this_month' | 'backlog'

export interface RankInputs {
  /** Dollar value (positive for opportunities, savings, or downside averted). */
  estimatedValueCad: number
  /** 0..1 — 1 means "decision must be made today". */
  urgency: number
  /** 0..1 — confidence in the underlying signal. */
  confidence: number
  /** 0..1 — effort cost. Higher = more effort. */
  effort: number
  /** 0..1 — reversibility. 1 = fully reversible, 0 = one-way door. */
  reversibility: number
  /** 0..1 — does this require the founder specifically? 1 = yes, 0 = fully delegatable. */
  founderUniqueness: number
  /** 0..1 — downside severity if ignored. */
  downsideIfIgnored: number
  /** 0..1 — strategic leverage: does solving this unlock other things? */
  strategicLeverage?: number
}

export interface RankOutput {
  /** Total score, typically 0..100 but not clamped so outliers show up. */
  score: number
  /** Which rank bucket this belongs to. */
  bucket: RankBucket
  /** Component breakdown (weighted), in descending order by magnitude. */
  explanation: Array<{ factor: string; contribution: number; note?: string }>
}

/**
 * Default weights. Tunable via `rank(inputs, { weights: { ... } })`.
 * Sum of positive weights ≈ sum of negative weights so the neutral case
 * returns score ~ 0.
 */
export const DEFAULT_WEIGHTS = {
  value: 0.30,
  urgency: 0.20,
  confidence: 0.15,
  downside: 0.15,
  strategicLeverage: 0.10,
  reversibility: 0.05, // small positive: reversible things are slightly easier to say yes to
  effort: -0.10,
  founderUniqueness: -0.05, // slight penalty: founder time is scarce, prefer delegatable work
} as const

export type RankWeights = typeof DEFAULT_WEIGHTS

export interface RankOptions {
  weights?: Partial<RankWeights>
  /** Log scale for value so a $1M opportunity isn't 1000× a $1k one. */
  valueScale?: (valueCad: number) => number
  /** Thresholds (on score) that bucket the output. */
  bucketThresholds?: { now: number; today: number; thisWeek: number; thisMonth: number }
}

const DEFAULT_BUCKET_THRESHOLDS = { now: 75, today: 55, thisWeek: 35, thisMonth: 15 }

// Log-scaled value so $100 → 0.3, $10k → 0.6, $100k → 0.75, $1M → 0.85, $10M → 0.95
// Saturates at large numbers so one huge item doesn't dominate.
function defaultValueScale(valueCad: number): number {
  const v = Math.max(0, valueCad)
  if (v === 0) return 0
  return Math.min(1, Math.log10(v + 1) / 7)
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0
  return Math.max(0, Math.min(1, x))
}

/**
 * Compute a rank for a recommendation.
 *
 * The score is an explainable linear combination of normalized inputs.
 * Ties are broken by (a) confidence, (b) reversibility, (c) lowest effort.
 */
export function rank(inputs: RankInputs, opts: RankOptions = {}): RankOutput {
  const w = { ...DEFAULT_WEIGHTS, ...(opts.weights ?? {}) }
  const scale = opts.valueScale ?? defaultValueScale
  const thresholds = opts.bucketThresholds ?? DEFAULT_BUCKET_THRESHOLDS

  const valueNorm = scale(inputs.estimatedValueCad)
  const urgencyNorm = clamp01(inputs.urgency)
  const confidenceNorm = clamp01(inputs.confidence)
  const downsideNorm = clamp01(inputs.downsideIfIgnored)
  const leverageNorm = clamp01(inputs.strategicLeverage ?? 0)
  const reversibilityNorm = clamp01(inputs.reversibility)
  const effortNorm = clamp01(inputs.effort)
  const founderNorm = clamp01(inputs.founderUniqueness)

  const parts = [
    { factor: 'value', contribution: valueNorm * w.value * 100 },
    { factor: 'urgency', contribution: urgencyNorm * w.urgency * 100 },
    { factor: 'confidence', contribution: confidenceNorm * w.confidence * 100 },
    { factor: 'downside', contribution: downsideNorm * w.downside * 100 },
    { factor: 'strategicLeverage', contribution: leverageNorm * w.strategicLeverage * 100 },
    { factor: 'reversibility', contribution: reversibilityNorm * w.reversibility * 100 },
    { factor: 'effort', contribution: effortNorm * w.effort * 100 },
    { factor: 'founderUniqueness', contribution: founderNorm * w.founderUniqueness * 100 },
  ]

  const score = parts.reduce((s, p) => s + p.contribution, 0)

  // Sort explanation by magnitude of contribution (positive first, then negative)
  const explanation = [...parts]
    .filter((p) => Math.abs(p.contribution) >= 0.5) // drop near-zero noise
    .sort((a, b) => b.contribution - a.contribution)

  let bucket: RankBucket
  if (score >= thresholds.now) bucket = 'now'
  else if (score >= thresholds.today) bucket = 'today'
  else if (score >= thresholds.thisWeek) bucket = 'this_week'
  else if (score >= thresholds.thisMonth) bucket = 'this_month'
  else bucket = 'backlog'

  return { score: Math.round(score * 10) / 10, bucket, explanation }
}

/**
 * Tie-aware sort: higher score first, break ties by confidence then reversibility.
 */
export function rankCompare<T extends { rank: RankOutput; confidence?: number; reversibility?: number }>(
  a: T,
  b: T,
): number {
  if (b.rank.score !== a.rank.score) return b.rank.score - a.rank.score
  if ((b.confidence ?? 0) !== (a.confidence ?? 0)) return (b.confidence ?? 0) - (a.confidence ?? 0)
  return (b.reversibility ?? 0) - (a.reversibility ?? 0)
}

/**
 * Human-readable one-liner summary of the top contributors.
 */
export function explainTopFactors(rankResult: RankOutput, n = 3): string {
  return rankResult.explanation
    .slice(0, n)
    .map((p) => `${p.factor}=${p.contribution >= 0 ? '+' : ''}${p.contribution.toFixed(1)}`)
    .join(', ')
}
