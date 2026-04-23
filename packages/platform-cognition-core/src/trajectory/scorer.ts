/**
 * @nzila/platform-cognition-core/trajectory — Risk scorer
 *
 * Phase-1 scorer. Each TrajectoryRiskKind is a logistic regression with
 * version-pinned, hand-calibrated coefficients. The choice is deliberate:
 *
 *   1. Interpretable. Every score ships with per-feature contributions.
 *   2. Honest. We do NOT have labeled training data yet, so a "trained"
 *      model would be a fiction. A calibrated heuristic is the truthful
 *      Phase-1 baseline.
 *   3. Replaceable. The scorer is keyed by `modelVersion`. When ml-core
 *      promotes a trained model with the same feature contract, the kind's
 *      MODEL entry is updated and the version bumps — call sites do not
 *      change.
 *
 * The features used here are the same fields TrajectoryFeatures already
 * exposes; the scorer intentionally does NOT compute new derived features
 * inline so feature drift can be detected with simple equality checks.
 *
 * @module @nzila/platform-cognition-core/trajectory/scorer
 */
import { clamp01, nowISO, sigmoid } from '../utils'
import type {
  TrajectoryFeatures,
  TrajectoryRiskKind,
  TrajectoryRiskScore,
} from '../types'

interface FeatureExtractor {
  readonly feature: string
  readonly extract: (f: TrajectoryFeatures) => number
}

interface LogisticModel {
  readonly version: string
  readonly intercept: number
  readonly weights: ReadonlyArray<{ readonly feature: string; readonly weight: number }>
}

/**
 * Bounded extractors. Bounding (z-score-ish caps) prevents a single extreme
 * event from saturating the logit and keeps contributions readable.
 */
const EXTRACTORS: Record<string, FeatureExtractor> = {
  recency_norm: {
    feature: 'recency_norm',
    extract: (f) => Math.min(1, f.recencyDays / 30),
  },
  freq_decline: {
    feature: 'freq_decline',
    extract: (f) => Math.max(0, -f.frequencySlope), // 0 if increasing, positive if declining
  },
  freq_increase: {
    feature: 'freq_increase',
    extract: (f) => Math.max(0, f.frequencySlope),
  },
  negative_load: {
    feature: 'negative_load',
    extract: (f) => Math.min(5, f.negativeSignal) / 5,
  },
  positive_load: {
    feature: 'positive_load',
    extract: (f) => Math.min(5, f.positiveSignal) / 5,
  },
  escalation_count: {
    feature: 'escalation_count',
    extract: (f) => Math.min(5, f.escalationEventCount) / 5,
  },
  event_density: {
    feature: 'event_density',
    extract: (f) => Math.min(1, f.eventCount / 30),
  },
  type_diversity: {
    feature: 'type_diversity',
    extract: (f) => Math.min(1, f.distinctTypes / 8),
  },
  mean_gap_norm: {
    feature: 'mean_gap_norm',
    extract: (f) => (Number.isFinite(f.meanGapDays) ? Math.min(1, f.meanGapDays / 30) : 1),
  },
}

/**
 * Phase-1 calibrated coefficients. Chosen to encode well-understood directional
 * priors:
 *
 *   • Churn: high recency + low event density + frequency decline → high
 *   • Escalation: escalation count + negative load → high
 *   • Aging: recency + mean gap → high
 *   • Disengagement: frequency decline + recency → high
 *   • Progression: positive load + frequency increase + type diversity → high
 *
 * Intercepts are calibrated so that "median" features yield ~0.3 probability.
 */
const MODELS: Record<TrajectoryRiskKind, LogisticModel> = {
  churn: {
    version: 'churn-logistic-v1',
    intercept: -1.4,
    weights: [
      { feature: 'recency_norm', weight: 2.2 },
      { feature: 'freq_decline', weight: 1.8 },
      { feature: 'event_density', weight: -1.5 },
      { feature: 'positive_load', weight: -1.0 },
    ],
  },
  escalation: {
    version: 'escalation-logistic-v1',
    intercept: -1.6,
    weights: [
      { feature: 'escalation_count', weight: 3.0 },
      { feature: 'negative_load', weight: 2.0 },
      { feature: 'recency_norm', weight: 0.8 },
      { feature: 'positive_load', weight: -0.6 },
    ],
  },
  aging: {
    version: 'aging-logistic-v1',
    intercept: -1.2,
    weights: [
      { feature: 'recency_norm', weight: 2.5 },
      { feature: 'mean_gap_norm', weight: 1.5 },
      { feature: 'event_density', weight: -1.2 },
    ],
  },
  disengagement: {
    version: 'disengagement-logistic-v1',
    intercept: -1.3,
    weights: [
      { feature: 'freq_decline', weight: 2.0 },
      { feature: 'recency_norm', weight: 1.6 },
      { feature: 'type_diversity', weight: -0.8 },
      { feature: 'positive_load', weight: -0.8 },
    ],
  },
  progression: {
    version: 'progression-logistic-v1',
    intercept: -1.5,
    weights: [
      { feature: 'positive_load', weight: 2.4 },
      { feature: 'freq_increase', weight: 1.6 },
      { feature: 'type_diversity', weight: 1.2 },
      { feature: 'negative_load', weight: -1.2 },
    ],
  },
}

/**
 * Confidence is a function of data sufficiency: < 3 events → very low
 * confidence; ≥ 15 events → 1.0; linear in between.
 */
function dataConfidence(features: TrajectoryFeatures): number {
  if (features.eventCount < 3) return Math.max(0.1, features.eventCount / 10)
  if (features.eventCount >= 15) return 1
  return 0.3 + ((features.eventCount - 3) / 12) * 0.7
}

export function scoreTrajectoryRisk(
  kind: TrajectoryRiskKind,
  features: TrajectoryFeatures,
  scoredAt: string = nowISO(),
): TrajectoryRiskScore {
  const model = MODELS[kind]
  let logit = model.intercept
  const contributions: TrajectoryRiskScore['contributions'][number][] = []

  for (const w of model.weights) {
    const extractor = EXTRACTORS[w.feature]
    if (!extractor) {
      // Build-time safety: every weight must have a registered extractor.
      throw new Error(`cognition-core: unregistered feature '${w.feature}' in model '${model.version}'`)
    }
    const value = extractor.extract(features)
    const contribution = w.weight * value
    logit += contribution
    contributions.push({ feature: w.feature, value, weight: w.weight, contribution })
  }

  return {
    subject: features.subject,
    kind,
    probability: clamp01(sigmoid(logit)),
    confidence: clamp01(dataConfidence(features)),
    contributions,
    features,
    modelVersion: model.version,
    scoredAt,
  }
}

/** Score every kind for a feature record. Useful for dashboards. */
export function scoreAllRisks(features: TrajectoryFeatures, scoredAt?: string): TrajectoryRiskScore[] {
  const kinds: TrajectoryRiskKind[] = ['churn', 'escalation', 'aging', 'disengagement', 'progression']
  return kinds.map((k) => scoreTrajectoryRisk(k, features, scoredAt))
}

/** Exposed for tests + governance: read the active model registry snapshot. */
export function listTrajectoryModels(): ReadonlyArray<{
  readonly kind: TrajectoryRiskKind
  readonly version: string
}> {
  return Object.entries(MODELS).map(([kind, model]) => ({
    kind: kind as TrajectoryRiskKind,
    version: model.version,
  }))
}
