/**
 * Allocation 2.0 — Phase 6.
 *
 * Adds three pure-function capabilities on top of `computeAllocation`:
 *   1. `diffAllocation(prev, current)` — month-over-month explainability.
 *   2. `simulateCapitalInjection(...)` — show the score impact of adding $X
 *      MRR-equivalent or weighted pipeline to a venture.
 *   3. `simulateFounderTimeReallocation(...)` — show the score impact of
 *      moving N% of founder time off venture A onto venture B.
 *
 * All simulations are *what-if* — they do not mutate any input. They return
 * a new `AllocationScore[]` so the UI can do a clean before/after diff.
 *
 * Confidence bands: every score is bucketed (`low|medium|high`) based on
 * input completeness — if a venture has no dependency score and no pipeline,
 * its composite is reported with `low` confidence so the UI can show a
 * caveat.
 */
import {
  computeAllocation,
  type AllocationEngineInput,
  type AllocationRecommendation,
  type AllocationScore,
} from './allocation-engine'
import type { Confidence, Venture } from './types'

// ── 1) Diff: this month vs last month ──────────────────────────────────────

export interface AllocationDelta {
  ventureSlug: string
  compositeBefore: number | null
  compositeAfter: number
  compositeDelta: number | null
  recommendationBefore: AllocationRecommendation | null
  recommendationAfter: AllocationRecommendation
  /** True if recommendation enum changed (e.g. hold → invest-more). */
  recommendationChanged: boolean
  /** Per-axis movement, present only for axes that meaningfully shifted (≥3 pts). */
  axisMoves: { axis: string; before: number; after: number; delta: number }[]
  /** Plain-English headline summarizing the move. */
  headline: string
}

export function diffAllocation(
  previous: readonly AllocationScore[] | null,
  current: readonly AllocationScore[],
): AllocationDelta[] {
  const prevBySlug = new Map((previous ?? []).map((s) => [s.ventureSlug, s]))
  return current.map((cur) => {
    const prev = prevBySlug.get(cur.ventureSlug) ?? null

    const axisMoves: AllocationDelta['axisMoves'] = []
    if (prev) {
      for (const key of Object.keys(cur.axes) as (keyof AllocationScore['axes'])[]) {
        const before = prev.axes[key]?.score ?? 0
        const after = cur.axes[key].score
        const delta = after - before
        if (Math.abs(delta) >= 3) {
          axisMoves.push({ axis: key, before, after, delta })
        }
      }
    }

    const compositeDelta = prev ? cur.composite - prev.composite : null
    const recommendationChanged =
      prev != null && prev.recommendation !== cur.recommendation
    const headline = buildHeadline(cur, prev, compositeDelta, recommendationChanged)

    return {
      ventureSlug: cur.ventureSlug,
      compositeBefore: prev?.composite ?? null,
      compositeAfter: cur.composite,
      compositeDelta,
      recommendationBefore: prev?.recommendation ?? null,
      recommendationAfter: cur.recommendation,
      recommendationChanged,
      axisMoves: axisMoves.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
      headline,
    }
  })
}

function buildHeadline(
  cur: AllocationScore,
  prev: AllocationScore | null,
  delta: number | null,
  recChanged: boolean,
): string {
  if (!prev) return `New tracking — composite ${cur.composite}/100, recommendation ${cur.recommendation}.`
  if (recChanged)
    return `Recommendation moved from ${prev.recommendation} → ${cur.recommendation} (composite ${prev.composite} → ${cur.composite}).`
  if (delta != null && delta >= 5) return `Strengthening — composite +${delta} to ${cur.composite}/100.`
  if (delta != null && delta <= -5) return `Weakening — composite ${delta} to ${cur.composite}/100.`
  return `Stable — composite ${cur.composite}/100, recommendation ${cur.recommendation}.`
}

// ── 2) Confidence bands ────────────────────────────────────────────────────

export function compositeConfidence(
  score: AllocationScore,
  inputs: { hasDependencyScore: boolean; hasPipeline: boolean; hasOpps: boolean },
): Confidence {
  let signals = 0
  if (inputs.hasDependencyScore) signals += 1
  if (inputs.hasPipeline) signals += 1
  if (inputs.hasOpps) signals += 1
  if (signals === 3 && score.reasons.length >= 2) return 'high'
  if (signals >= 2) return 'medium'
  return 'low'
}

// ── 3) Simulation: capital injection ───────────────────────────────────────

export interface CapitalInjectionInput {
  ventureSlug: string
  /** Additional MRR cents granted to this venture as a what-if. */
  addedMrrCents?: number
  /** Additional weighted pipeline cents granted to this venture as a what-if. */
  addedWeightedPipelineCents?: number
}

export interface SimulationResult {
  before: readonly AllocationScore[]
  after: readonly AllocationScore[]
  delta: AllocationDelta[]
  /** Sum of composite movement across all ventures (proxy for total ROI of the move). */
  netCompositeDelta: number
}

export function simulateCapitalInjection(
  input: AllocationEngineInput,
  scenario: CapitalInjectionInput,
): SimulationResult {
  const before = computeAllocation(input)
  const ventures: Venture[] = input.ventures.map((v) => {
    if (v.slug !== scenario.ventureSlug) return v
    return {
      ...v,
      monthlyRecurringRevenueCents:
        v.monthlyRecurringRevenueCents + (scenario.addedMrrCents ?? 0),
      weightedPipelineCents:
        v.weightedPipelineCents + (scenario.addedWeightedPipelineCents ?? 0),
    }
  })
  const after = computeAllocation({ ...input, ventures })
  const delta = diffAllocation(before, after)
  const netCompositeDelta = delta.reduce((s, d) => s + (d.compositeDelta ?? 0), 0)
  return { before, after, delta, netCompositeDelta }
}

// ── 4) Simulation: founder time reallocation ───────────────────────────────

export interface FounderTimeReallocationInput {
  /** Venture losing founder time (its dependency improves — score drops). */
  fromVentureSlug: string
  /** Venture receiving founder time (its dependency worsens slightly — score rises). */
  toVentureSlug: string
  /** Percentage points of founder dependency to transfer (0..100). */
  pointsTransferred: number
}

export function simulateFounderTimeReallocation(
  input: AllocationEngineInput,
  scenario: FounderTimeReallocationInput,
): SimulationResult {
  const before = computeAllocation(input)
  const points = Math.max(0, Math.min(100, scenario.pointsTransferred))

  const dependencyScores = input.dependencyScores.map((d) => {
    if (d.ventureSlug === scenario.fromVentureSlug) {
      const next = Math.max(0, d.score - points)
      return { ...d, score: next, signal: classify(next) }
    }
    if (d.ventureSlug === scenario.toVentureSlug) {
      const next = Math.min(100, d.score + Math.round(points * 0.6))
      // Receiving venture absorbs only 60% — some founder bandwidth is lost
      // to context switching. Honest about the cost of the transfer.
      return { ...d, score: next, signal: classify(next) }
    }
    return d
  })

  const after = computeAllocation({ ...input, dependencyScores })
  const delta = diffAllocation(before, after)
  const netCompositeDelta = delta.reduce((s, d) => s + (d.compositeDelta ?? 0), 0)
  return { before, after, delta, netCompositeDelta }
}

function classify(score: number): 'green' | 'amber' | 'red' {
  if (score >= 70) return 'red'
  if (score >= 40) return 'amber'
  return 'green'
}
