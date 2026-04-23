/**
 * @nzila/platform-cognition-core/memory — Preference accumulation
 *
 * Builds a per-tag preference profile by aggregating signed contributions
 * across a subject's preference- and decision-kind events.
 *
 *   • An explicit `payload.valence` of 'positive'/'negative'/'neutral' wins
 *     when present (used by structured user actions like 'liked' / 'dismissed').
 *   • Otherwise, decision events with `payload.outcome === 'accepted' | 'rejected'`
 *     contribute +/- respectively. This lets implicit feedback shape preferences.
 *
 * Per-tag scores are bounded to [-1, 1] using a saturating sigmoid; sample
 * size is reported separately so consumers can decide trust thresholds.
 *
 * @module @nzila/platform-cognition-core/memory/preferences
 */
import { nowISO, sigmoid } from '../utils'
import { loadMemoryEvents } from './store'
import type { CognitionSubject, MemoryEvent, PreferenceProfile, PreferenceValence } from '../types'

function valenceOf(ev: MemoryEvent): PreferenceValence {
  const v = (ev.payload as { valence?: unknown }).valence
  if (v === 'positive' || v === 'negative' || v === 'neutral') return v
  if (ev.kind === 'decision') {
    const o = (ev.payload as { outcome?: unknown }).outcome
    if (o === 'accepted') return 'positive'
    if (o === 'rejected') return 'negative'
  }
  return 'neutral'
}

function valenceContribution(v: PreferenceValence): number {
  if (v === 'positive') return 1
  if (v === 'negative') return -1
  return 0
}

export function computePreferenceProfile(subject: CognitionSubject): PreferenceProfile {
  const events = loadMemoryEvents(subject).filter(
    (e) => e.kind === 'preference' || e.kind === 'decision',
  )

  // Raw weighted sums per tag.
  const sums = new Map<string, number>()
  for (const ev of events) {
    const sign = valenceContribution(valenceOf(ev))
    if (sign === 0) continue
    const weight = sign * ev.salience
    for (const tag of ev.tags) {
      sums.set(tag, (sums.get(tag) ?? 0) + weight)
    }
  }

  // Sigmoid squashes unbounded sums into [-1, 1]; gradient at 0 ≈ 0.5
  // means a single +1 event already produces a visible but not saturating
  // preference, while many events asymptote toward ±1.
  const scores: Record<string, number> = {}
  for (const [tag, sum] of sums) {
    scores[tag] = 2 * sigmoid(sum) - 1
  }

  return {
    subject,
    scores,
    sampleSize: events.length,
    computedAt: nowISO(),
  }
}
