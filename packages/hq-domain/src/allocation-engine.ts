/**
 * Capital Allocation Engine (Phase 5).
 *
 * Pure deterministic scoring of each venture across six axes, producing a
 * recommendation enum. The output is the founder's allocation discipline tool:
 *
 *   Invest More | Hold | Restructure | Pause | Exit
 *
 * Inputs are framework-free snapshots already produced elsewhere
 * (`Venture` from `types.ts`, `DependencyScore` from `dependency-engine.ts`).
 *
 * No I/O. Callers persist or render the result.
 */
import type {
  Confidence,
  DependencyScore,
  HealthSignal,
  Opportunity,
  Venture,
  VentureStage,
} from './types'

export type AllocationRecommendation =
  | 'invest-more'
  | 'hold'
  | 'restructure'
  | 'pause'
  | 'exit'

export interface AllocationAxisScore {
  /** 0..100 — higher is better for the venture. */
  score: number
  /** Weight in the composite (sums to 100 across axes). */
  weight: number
  /** Short human-readable rationale, used in the UI tooltip. */
  rationale: string
}

export interface AllocationScore {
  ventureSlug: string
  /** Weighted composite, 0..100. Higher = stronger venture. */
  composite: number
  recommendation: AllocationRecommendation
  signal: HealthSignal
  axes: {
    revenueTraction: AllocationAxisScore
    pipelineStrength: AllocationAxisScore
    marginPotential: AllocationAxisScore
    strategicFit: AllocationAxisScore
    founderLoad: AllocationAxisScore // higher score = LOWER founder dependency
    confidence: AllocationAxisScore
  }
  reasons: string[]
  computedAt: string
}

export interface AllocationEngineInput {
  now: string
  ventures: Venture[]
  opportunities: Opportunity[]
  dependencyScores: DependencyScore[]
  /**
   * Founder-stated strategic priority per venture slug, 0..1.
   * Defaults to 0.5 for any venture without an explicit value.
   * This is the only subjective input — everything else is computed.
   */
  strategicPriority?: Record<string, number>
}

const WEIGHTS = {
  revenueTraction: 25,
  pipelineStrength: 20,
  marginPotential: 10,
  strategicFit: 15,
  founderLoad: 20,
  confidence: 10,
} as const

// Sanity-check at module load that weights sum to 100 (compile-time would be ideal).
const _WEIGHT_SUM = Object.values(WEIGHTS).reduce((a, b) => a + b, 0)
if (_WEIGHT_SUM !== 100) {
  throw new Error(`AllocationEngine: weights must sum to 100, got ${_WEIGHT_SUM}`)
}

const CONFIDENCE_RANK: Record<Confidence, number> = { low: 25, medium: 60, high: 95 }

/**
 * Stage maturity multiplier — pre-revenue stages are scored against a softer
 * revenue bar so that a strong pilot isn't unfairly punished vs a scaled venture.
 */
const STAGE_REVENUE_TARGET_CENTS: Record<VentureStage, number> = {
  incubating: 50_000_00, // $50k MRR is "100" for incubating
  pilot: 200_000_00,
  'go-to-market': 500_000_00,
  scaling: 1_500_000_00,
  mature: 3_000_000_00,
  sunset: 0,
}

function clamp01(n: number): number {
  if (Number.isNaN(n) || n < 0) return 0
  if (n > 1) return 1
  return n
}

function classifySignal(composite: number): HealthSignal {
  if (composite >= 65) return 'green'
  if (composite >= 40) return 'amber'
  return 'red'
}

function recommendFromComposite(
  composite: number,
  founderLoadScore: number,
  stage: VentureStage,
): AllocationRecommendation {
  if (stage === 'sunset') return 'exit'
  if (composite >= 75 && founderLoadScore >= 50) return 'invest-more'
  if (composite >= 55) return 'hold'
  if (composite >= 35) return 'restructure'
  if (composite >= 20) return 'pause'
  return 'exit'
}

function scoreVenture(
  venture: Venture,
  input: AllocationEngineInput,
): AllocationScore {
  const { opportunities, dependencyScores, strategicPriority = {}, now } = input
  const ventureOpps = opportunities.filter((o) => o.ventureSlug === venture.slug)
  const dep = dependencyScores.find((s) => s.ventureSlug === venture.slug)

  // ── Axis 1: revenue traction ──────────────────────────────────────────────
  const revTarget = STAGE_REVENUE_TARGET_CENTS[venture.stage] || 1
  const revRatio = clamp01(venture.monthlyRecurringRevenueCents / revTarget)
  const revenueTraction: AllocationAxisScore = {
    score: Math.round(revRatio * 100),
    weight: WEIGHTS.revenueTraction,
    rationale: `MRR ${dollars(venture.monthlyRecurringRevenueCents)} vs ${venture.stage} bar ${dollars(revTarget)}`,
  }

  // ── Axis 2: pipeline strength ─────────────────────────────────────────────
  // Weighted pipeline relative to MRR — strong forward-looking signal.
  // 12 months of weighted pipeline at current MRR = 100.
  const mrrAnnualized = Math.max(venture.monthlyRecurringRevenueCents * 12, 1)
  const pipeRatio = clamp01(venture.weightedPipelineCents / mrrAnnualized)
  const pipelineStrength: AllocationAxisScore = {
    score: Math.round(pipeRatio * 100),
    weight: WEIGHTS.pipelineStrength,
    rationale: `Weighted pipe ${dollars(venture.weightedPipelineCents)} vs annualized MRR ${dollars(mrrAnnualized)}`,
  }

  // ── Axis 3: margin potential ──────────────────────────────────────────────
  // We don't yet have venture-level COGS, so we use a stage-derived prior.
  // Mature SaaS-like ventures score higher; incubating projects neutral.
  const marginByStage: Record<VentureStage, number> = {
    incubating: 50,
    pilot: 55,
    'go-to-market': 65,
    scaling: 80,
    mature: 85,
    sunset: 0,
  }
  const marginPotential: AllocationAxisScore = {
    score: marginByStage[venture.stage],
    weight: WEIGHTS.marginPotential,
    rationale: `Stage ${venture.stage} → margin proxy ${marginByStage[venture.stage]}/100 (replace when COGS lands)`,
  }

  // ── Axis 4: strategic fit ─────────────────────────────────────────────────
  const fitRaw = strategicPriority[venture.slug] ?? 0.5
  const strategicFit: AllocationAxisScore = {
    score: Math.round(clamp01(fitRaw) * 100),
    weight: WEIGHTS.strategicFit,
    rationale:
      strategicPriority[venture.slug] != null
        ? `Founder-set priority ${Math.round(fitRaw * 100)}/100`
        : 'Default neutral 50/100 — no founder priority recorded',
  }

  // ── Axis 5: founder load (inverse of dependency score) ────────────────────
  // dep.score is 0..100 where higher = MORE dependent. We invert.
  const depScore = dep?.score ?? 50
  const founderLoad: AllocationAxisScore = {
    score: Math.max(0, 100 - depScore),
    weight: WEIGHTS.founderLoad,
    rationale: dep
      ? `Dependency ${depScore}/100 (${dep.signal}) → founder-load score ${100 - depScore}`
      : 'No dependency score available — assumed neutral 50/100',
  }

  // ── Axis 6: confidence ────────────────────────────────────────────────────
  const confidence: AllocationAxisScore = {
    score: CONFIDENCE_RANK[venture.confidence],
    weight: WEIGHTS.confidence,
    rationale: `Owner confidence ${venture.confidence}`,
  }

  const axes = {
    revenueTraction,
    pipelineStrength,
    marginPotential,
    strategicFit,
    founderLoad,
    confidence,
  }

  const composite = Math.round(
    Object.values(axes).reduce((acc, axis) => acc + (axis.score * axis.weight) / 100, 0),
  )

  const recommendation = recommendFromComposite(composite, founderLoad.score, venture.stage)

  // ── Reasons — surfaced in UI to make the recommendation defensible ───────
  const reasons: string[] = []
  if (revenueTraction.score >= 80) reasons.push('Strong revenue traction for stage.')
  else if (revenueTraction.score < 30) reasons.push('Revenue is far below stage bar.')
  if (pipelineStrength.score >= 70) reasons.push('Pipeline materially exceeds current run-rate.')
  else if (pipelineStrength.score < 20 && venture.monthlyRecurringRevenueCents > 0)
    reasons.push('Pipeline thin relative to MRR — growth path unclear.')
  if (founderLoad.score < 35) reasons.push('Founder dependency is dangerously high.')
  if (founderLoad.score >= 70) reasons.push('Operates without founder bottleneck — leverage candidate.')
  if (venture.confidence === 'low') reasons.push('Owner confidence is low.')
  if (ventureOpps.length === 0 && venture.stage !== 'incubating')
    reasons.push('No active opportunities in pipeline.')
  if (venture.blockers.length > 0)
    reasons.push(`Active blockers: ${venture.blockers.slice(0, 3).join('; ')}.`)

  return {
    ventureSlug: venture.slug,
    composite,
    recommendation,
    signal: classifySignal(composite),
    axes,
    reasons,
    computedAt: now,
  }
}

export function computeAllocation(input: AllocationEngineInput): AllocationScore[] {
  return input.ventures
    .map((v) => scoreVenture(v, input))
    .sort((a, b) => b.composite - a.composite)
}

export interface AllocationSummary {
  byRecommendation: Record<AllocationRecommendation, number>
  averageComposite: number
  topVentureSlug: string | null
  bottomVentureSlug: string | null
  redCount: number
  amberCount: number
  greenCount: number
}

export function summarizeAllocation(scores: readonly AllocationScore[]): AllocationSummary {
  const empty: Record<AllocationRecommendation, number> = {
    'invest-more': 0,
    hold: 0,
    restructure: 0,
    pause: 0,
    exit: 0,
  }
  if (scores.length === 0) {
    return {
      byRecommendation: empty,
      averageComposite: 0,
      topVentureSlug: null,
      bottomVentureSlug: null,
      redCount: 0,
      amberCount: 0,
      greenCount: 0,
    }
  }
  const byRecommendation = scores.reduce(
    (acc, s) => {
      acc[s.recommendation] += 1
      return acc
    },
    { ...empty },
  )
  const sorted = [...scores].sort((a, b) => b.composite - a.composite)
  return {
    byRecommendation,
    averageComposite: Math.round(
      scores.reduce((a, s) => a + s.composite, 0) / scores.length,
    ),
    topVentureSlug: sorted[0]?.ventureSlug ?? null,
    bottomVentureSlug: sorted[sorted.length - 1]?.ventureSlug ?? null,
    redCount: scores.filter((s) => s.signal === 'red').length,
    amberCount: scores.filter((s) => s.signal === 'amber').length,
    greenCount: scores.filter((s) => s.signal === 'green').length,
  }
}

function dollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString('en-CA')}`
}
