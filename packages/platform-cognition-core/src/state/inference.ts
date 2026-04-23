/**
 * @nzila/platform-cognition-core/state — Bayesian-style state inference
 *
 * Each StateDimension is computed as a clamped weighted sum of normalized
 * drivers. We expose every driver's contribution so the UI can render an
 * "explain why" panel without re-deriving anything.
 *
 * Why not pure logistic like the trajectory scorer? State here is best
 * thought of as a *score* (how-much, not how-likely), so a bounded weighted
 * sum is a more honest representation than a probability. The dimension is
 * still in [0, 1] for downstream comparability.
 *
 * Coefficients are version-pinned (`STATE_MODEL_VERSION`). Like trajectory,
 * Phase-2 will swap in trained weights from ml-core under the same contract.
 *
 * @module @nzila/platform-cognition-core/state/inference
 */
import { nowISO } from '../utils'
import type {
  CognitionSubject,
  StateDimension,
  StateInference,
  StateSignalInput,
} from '../types'
import { normalizeStateSignals, type NormalizedSignals } from './features'

export const STATE_MODEL_VERSION = 'state-bayesian-v1'

interface DriverWeight {
  readonly signal: keyof NormalizedSignals
  readonly weight: number
}

const MODEL: Record<StateDimension, readonly DriverWeight[]> = {
  confusion: [
    { signal: 'repeatActions', weight: 0.45 },
    { signal: 'helpDensity', weight: 0.35 },
    { signal: 'errorDensity', weight: 0.20 },
  ],
  fatigue: [
    { signal: 'longSessions', weight: 0.45 },
    { signal: 'highSessionFreq', weight: 0.30 },
    { signal: 'errorDensity', weight: 0.25 },
  ],
  frustration: [
    { signal: 'errorDensity', weight: 0.45 },
    { signal: 'repeatActions', weight: 0.30 },
    { signal: 'helpDensity', weight: 0.25 },
  ],
  urgency: [
    { signal: 'nearDeadline', weight: 0.70 },
    { signal: 'highSessionFreq', weight: 0.30 },
  ],
  confidence: [
    { signal: 'completionRate', weight: 0.60 },
    { signal: 'errorDensity', weight: -0.40 },
  ],
  disengagement: [
    { signal: 'lowSessionFreq', weight: 0.50 },
    { signal: 'shortSessions', weight: 0.30 },
    { signal: 'completionRate', weight: -0.20 },
  ],
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

export function inferState(
  subject: CognitionSubject,
  input: StateSignalInput,
  inferredAt: string = nowISO(),
): StateInference {
  const signals = normalizeStateSignals(input)

  const dimensions: Record<StateDimension, number> = {
    confusion: 0,
    fatigue: 0,
    frustration: 0,
    urgency: 0,
    confidence: 0,
    disengagement: 0,
  }
  const explanations: StateInference['explanations'][number][] = []

  for (const [dim, drivers] of Object.entries(MODEL) as Array<
    [StateDimension, readonly DriverWeight[]]
  >) {
    let score = 0
    const driverContribs: Array<{ signal: string; contribution: number }> = []
    for (const d of drivers) {
      const value = signals[d.signal]
      const contribution = d.weight * value
      score += contribution
      driverContribs.push({ signal: d.signal, contribution })
    }
    dimensions[dim] = clamp01(score)
    explanations.push({ dimension: dim, drivers: driverContribs })
  }

  return {
    subject,
    dimensions,
    explanations,
    inferredAt,
    modelVersion: STATE_MODEL_VERSION,
  }
}
