/**
 * @nzila/platform-cognition-core/integration — Decision-engine adapter
 *
 * The composition moat. Trajectory risk scores produced by this package are
 * mapped to OperationalSignal records that the existing
 * @nzila/platform-decision-engine pipeline already consumes — no rule changes
 * required there.
 *
 * Mapping rules:
 *   • A score with probability ≥ minProbability emits a signal.
 *   • spike vs trend_change is chosen by spikeThreshold.
 *   • baselineValue = 1 - probability (so deviationPercent reads naturally
 *     as "how far above baseline this risk is").
 *   • metric name encodes both kind and subject for downstream aggregation.
 *   • confidence on the signal = the score's confidence (data sufficiency),
 *     so low-data scores can be filtered by existing decision rules.
 *
 * @module @nzila/platform-cognition-core/integration/decision-engine-adapter
 */
import * as crypto from 'node:crypto'
import type { OperationalSignal, SignalType } from '@nzila/platform-intelligence/types'
import type {
  CognitionAdapterOptions,
  TrajectoryRiskScore,
} from '../types'
import { subjectKey } from '../utils'

const DEFAULTS = {
  minProbability: 0.6,
  spikeThreshold: 0.8,
} as const

function classifySignalType(probability: number, spikeThreshold: number): SignalType {
  return probability >= spikeThreshold ? 'spike' : 'trend_change'
}

function metricName(score: TrajectoryRiskScore): string {
  return `cognition.${score.kind}_risk.${score.features.subject.entityType ?? 'subject'}`
}

function appName(score: TrajectoryRiskScore): string {
  // Many decision rules filter by `app`; we use orgId-scoped tag rather than
  // a fake app name so the signal cannot be misattributed to a real app.
  return `cognition::${score.features.subject.orgId}`
}

function signalIdFor(score: TrajectoryRiskScore): string {
  // Deterministic UUIDv5-style: hash subject + kind + scoredAt for stability.
  const seed = `${subjectKey(score.features.subject)}|${score.kind}|${score.scoredAt}`
  const h = crypto.createHash('sha256').update(seed).digest('hex')
  // Format as a UUID v4-ish 8-4-4-4-12 from the hash for the operationalSignalSchema.uuid() check.
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`
}

/**
 * Convert one risk score into an OperationalSignal, or null when below
 * threshold.
 */
export function riskScoreToSignal(
  score: TrajectoryRiskScore,
  options: CognitionAdapterOptions = {},
): OperationalSignal | null {
  const minP = options.minProbability ?? DEFAULTS.minProbability
  const spikeT = options.spikeThreshold ?? DEFAULTS.spikeThreshold
  if (score.probability < minP) return null

  const baseline = 1 - score.probability
  const deviationPercent = baseline === 0 ? 100 : ((score.probability - baseline) / baseline) * 100

  return {
    id: signalIdFor(score),
    timestamp: score.scoredAt,
    signalType: classifySignalType(score.probability, spikeT),
    app: appName(score),
    metric: metricName(score),
    currentValue: score.probability,
    baselineValue: baseline,
    deviationPercent,
    confidence: score.confidence,
  }
}

/**
 * Bulk convert. Returns only the signals that crossed the threshold —
 * order is preserved so downstream UIs can rely on input ordering.
 */
export function riskScoresToSignals(
  scores: readonly TrajectoryRiskScore[],
  options: CognitionAdapterOptions = {},
): OperationalSignal[] {
  const out: OperationalSignal[] = []
  for (const s of scores) {
    const sig = riskScoreToSignal(s, options)
    if (sig) out.push(sig)
  }
  return out
}
