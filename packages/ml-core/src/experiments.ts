/**
 * @nzila/ml-core — Experiment Framework
 */

import { randomUUID } from 'node:crypto'

export interface ExperimentVariant {
  id: string
  name: string
  trafficWeight: number
}

export interface ExperimentDefinition {
  id: string
  name: string
  metricKey: string
  variants: ExperimentVariant[]
  createdAt: string
}

export interface VariantObservation {
  variantId: string
  metricValue: number
}

export interface VariantSummary {
  variantId: string
  sampleSize: number
  mean: number
  stdDev: number
}

export interface ExperimentEvaluation {
  experimentId: string
  metricKey: string
  winnerVariantId?: string
  confidence: number
  summaries: VariantSummary[]
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function stdDev(values: readonly number[]): number {
  if (values.length < 2) return 0
  const avg = mean(values)
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

export function createExperiment(params: {
  name: string
  metricKey: string
  variants: Array<{ name: string; trafficWeight: number }>
}): ExperimentDefinition {
  const totalWeight = params.variants.reduce((sum, variant) => sum + variant.trafficWeight, 0)
  if (totalWeight <= 0) throw new Error('Experiment variants must have positive total weight')

  return {
    id: randomUUID(),
    name: params.name,
    metricKey: params.metricKey,
    variants: params.variants.map((variant) => ({
      id: randomUUID(),
      name: variant.name,
      trafficWeight: variant.trafficWeight / totalWeight,
    })),
    createdAt: new Date().toISOString(),
  }
}

export function assignExperimentVariant(
  experiment: ExperimentDefinition,
  stableKey: string,
): ExperimentVariant {
  // Deterministic bucket assignment using key hash.
  let hash = 0
  for (let i = 0; i < stableKey.length; i++) {
    hash = (hash * 31 + stableKey.charCodeAt(i)) >>> 0
  }
  const bucket = (hash % 10_000) / 10_000

  let cumulative = 0
  for (const variant of experiment.variants) {
    cumulative += variant.trafficWeight
    if (bucket <= cumulative) return variant
  }

  return experiment.variants[experiment.variants.length - 1]
}

/**
 * Evaluate variants and choose winner by highest mean metric.
 * Confidence is estimated from effect size and sample support.
 */
export function evaluateExperiment(params: {
  experiment: ExperimentDefinition
  observations: VariantObservation[]
}): ExperimentEvaluation {
  const byVariant = new Map<string, number[]>()

  for (const variant of params.experiment.variants) {
    byVariant.set(variant.id, [])
  }

  for (const observation of params.observations) {
    const list = byVariant.get(observation.variantId)
    if (list) list.push(observation.metricValue)
  }

  const summaries: VariantSummary[] = params.experiment.variants.map((variant) => {
    const values = byVariant.get(variant.id) ?? []
    return {
      variantId: variant.id,
      sampleSize: values.length,
      mean: mean(values),
      stdDev: stdDev(values),
    }
  })

  const ranked = [...summaries].sort((a, b) => b.mean - a.mean)
  const winner = ranked[0]
  const runnerUp = ranked[1]

  let confidence = 0
  if (winner && runnerUp) {
    const delta = winner.mean - runnerUp.mean
    const pooledStd = (winner.stdDev + runnerUp.stdDev) / 2
    const effectSize = pooledStd === 0 ? 0 : delta / pooledStd
    const support = Math.min(1, (winner.sampleSize + runnerUp.sampleSize) / 200)
    confidence = Math.max(0, Math.min(0.99, Math.abs(effectSize) * 0.5 + support * 0.5))
  }

  return {
    experimentId: params.experiment.id,
    metricKey: params.experiment.metricKey,
    winnerVariantId: winner?.variantId,
    confidence,
    summaries,
  }
}
