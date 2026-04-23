/**
 * @nzila/platform-cognition-core/memory — Decay functions
 *
 * Recency-weighted decay used by the recall ranker and the trajectory window
 * extractor. Two curves are exposed:
 *
 *   • exponentialDecay(ageDays, halfLifeDays)
 *       Half-life model. After H days, weight = 0.5. Closed-form, monotonic,
 *       matches Ebbinghaus-style forgetting commonly used for recommender recency.
 *
 *   • linearDecay(ageDays, horizonDays)
 *       Floor-clamped linear. Useful when a hard cutoff is desired (e.g. SLA
 *       windows: an event 14 days old should still count, 30 days should not).
 *
 * Both return a value in [0, 1]. Both treat negative ages (event "in the
 * future" relative to `now`) as fully fresh, which keeps clock-skew safe.
 *
 * @module @nzila/platform-cognition-core/memory/decay
 */

export function exponentialDecay(ageDays: number, halfLifeDays: number): number {
  if (halfLifeDays <= 0) return ageDays <= 0 ? 1 : 0
  if (ageDays <= 0) return 1
  return Math.pow(0.5, ageDays / halfLifeDays)
}

export function linearDecay(ageDays: number, horizonDays: number): number {
  if (horizonDays <= 0) return ageDays <= 0 ? 1 : 0
  if (ageDays <= 0) return 1
  if (ageDays >= horizonDays) return 0
  return 1 - ageDays / horizonDays
}
