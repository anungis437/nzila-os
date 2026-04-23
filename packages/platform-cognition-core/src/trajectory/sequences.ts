/**
 * @nzila/platform-cognition-core/trajectory — Subject sequence helpers
 *
 * Convenience composition: load events for a subject, slice a window, extract
 * features, score one or more kinds. Most apps will call `scoreSubject` rather
 * than the two-step API.
 *
 * @module @nzila/platform-cognition-core/trajectory/sequences
 */
import { loadMemoryEvents } from '../memory/store'
import type {
  CognitionSubject,
  TrajectoryFeatures,
  TrajectoryRiskKind,
  TrajectoryRiskScore,
} from '../types'
import { extractTrajectoryFeatures } from './features'
import { scoreAllRisks, scoreTrajectoryRisk } from './scorer'

export interface SubjectScoreOptions {
  /** Window length in days, ending at `windowEnd`. Default 90. */
  readonly windowDays?: number
  /** Window end (defaults to now). */
  readonly windowEnd?: string
  /** Specific kind to score. Omit for all kinds. */
  readonly kind?: TrajectoryRiskKind
}

export function buildFeaturesForSubject(
  subject: CognitionSubject,
  opts: SubjectScoreOptions = {},
): TrajectoryFeatures {
  const windowEnd = opts.windowEnd ?? new Date().toISOString()
  const windowDays = opts.windowDays ?? 90
  const startMs = new Date(windowEnd).getTime() - windowDays * 86_400_000
  const windowStart = new Date(startMs).toISOString()
  const events = loadMemoryEvents(subject)
  return extractTrajectoryFeatures({ subject, events, windowStart, windowEnd })
}

export function scoreSubject(
  subject: CognitionSubject,
  opts: SubjectScoreOptions = {},
): TrajectoryRiskScore[] {
  const features = buildFeaturesForSubject(subject, opts)
  if (opts.kind) return [scoreTrajectoryRisk(opts.kind, features, opts.windowEnd)]
  return scoreAllRisks(features, opts.windowEnd)
}
