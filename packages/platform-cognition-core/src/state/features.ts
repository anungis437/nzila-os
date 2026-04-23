/**
 * @nzila/platform-cognition-core/state — Feature normalisation for state inference
 *
 * Each StateSignalInput field is mapped onto an interpretable [0, 1] driver.
 * The mapping functions are saturating (no negative drivers) so the inference
 * step can sum-then-bound them without sign-tracking complexity.
 *
 * @module @nzila/platform-cognition-core/state/features
 */
import type { StateSignalInput } from '../types'

export interface NormalizedSignals {
  readonly repeatActions: number
  readonly lowSessionFreq: number
  readonly highSessionFreq: number
  readonly shortSessions: number
  readonly longSessions: number
  readonly helpDensity: number
  readonly errorDensity: number
  readonly nearDeadline: number
  readonly completionRate: number
}

export function normalizeStateSignals(input: StateSignalInput): NormalizedSignals {
  return {
    repeatActions: clamp01((input.repeatActionCount ?? 0) / 5),
    lowSessionFreq: clamp01(1 - (input.sessionsPerDay ?? 1) / 2),
    highSessionFreq: clamp01(((input.sessionsPerDay ?? 0) - 4) / 4),
    shortSessions: clamp01(1 - (input.meanSessionMinutes ?? 10) / 10),
    longSessions: clamp01(((input.meanSessionMinutes ?? 0) - 60) / 60),
    helpDensity: clamp01((input.helpEventCount ?? 0) / 5),
    errorDensity: clamp01((input.errorEventCount ?? 0) / 5),
    nearDeadline: input.hoursToDeadline === undefined
      ? 0
      : clamp01(1 - input.hoursToDeadline / 48),
    completionRate: clamp01((input.completionCount ?? 0) / 7),
  }
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}
