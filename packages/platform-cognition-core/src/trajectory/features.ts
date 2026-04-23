/**
 * @nzila/platform-cognition-core/trajectory — Sequence feature extraction
 *
 * Aggregates a chronologically-sorted MemoryEvent stream into a single
 * TrajectoryFeatures record. Features are deliberately interpretable so the
 * scorer's contributions remain explainable end-to-end.
 *
 * Conventions:
 *   • A "negative" event is any event tagged 'negative' or with payload.valence
 *     === 'negative', or kind === 'trust' with payload.outcome === 'breach'.
 *   • An "escalation" event is any event tagged 'escalation' OR whose type
 *     contains 'escalat' (case-insensitive). This matches existing union-eyes
 *     and FairCase event taxonomy.
 *   • Frequency slope uses a tiny ordinary-least-squares regression of
 *     daily-bucketed event counts against day index, giving events/day².
 *
 * @module @nzila/platform-cognition-core/trajectory/features
 */
import type { CognitionSubject, MemoryEvent, TrajectoryFeatures } from '../types'
import { daysBetween } from '../utils'

function isNegative(ev: MemoryEvent): boolean {
  if (ev.tags.includes('negative')) return true
  const p = ev.payload as { valence?: unknown; outcome?: unknown }
  if (p.valence === 'negative') return true
  if (ev.kind === 'trust' && p.outcome === 'breach') return true
  return false
}

function isPositive(ev: MemoryEvent): boolean {
  if (ev.tags.includes('positive')) return true
  const p = ev.payload as { valence?: unknown }
  return p.valence === 'positive'
}

function isEscalation(ev: MemoryEvent): boolean {
  if (ev.tags.includes('escalation')) return true
  return ev.type.toLowerCase().includes('escalat')
}

function frequencySlope(events: readonly MemoryEvent[], windowStartISO: string): number {
  if (events.length < 2) return 0
  // Bucket by integer day index from windowStart.
  const buckets = new Map<number, number>()
  for (const ev of events) {
    const day = Math.floor(daysBetween(windowStartISO, ev.occurredAt))
    buckets.set(day, (buckets.get(day) ?? 0) + 1)
  }
  if (buckets.size < 2) return 0
  // OLS slope of count vs day.
  const xs = [...buckets.keys()]
  const ys = xs.map((x) => buckets.get(x)!)
  const n = xs.length
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY)
    den += (xs[i] - meanX) ** 2
  }
  return den === 0 ? 0 : num / den
}

function meanGapDays(events: readonly MemoryEvent[]): number {
  if (events.length < 2) return Number.POSITIVE_INFINITY
  let total = 0
  for (let i = 1; i < events.length; i++) {
    total += Math.max(0, daysBetween(events[i - 1].occurredAt, events[i].occurredAt))
  }
  return total / (events.length - 1)
}

export interface ExtractFeaturesInput {
  readonly subject: CognitionSubject
  readonly events: readonly MemoryEvent[]
  readonly windowStart: string
  readonly windowEnd: string
}

export function extractTrajectoryFeatures(input: ExtractFeaturesInput): TrajectoryFeatures {
  const { subject, windowStart, windowEnd } = input
  const inWindow = input.events
    .filter((e) => e.occurredAt >= windowStart && e.occurredAt <= windowEnd && !e.redactedAt)
    .slice()
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))

  const distinct = new Set(inWindow.map((e) => e.type))
  const recencyDays = inWindow.length === 0
    ? daysBetween(windowStart, windowEnd)
    : Math.max(0, daysBetween(inWindow[inWindow.length - 1].occurredAt, windowEnd))

  let negativeSignal = 0
  let positiveSignal = 0
  let escalationEventCount = 0
  for (const ev of inWindow) {
    if (isNegative(ev)) negativeSignal += ev.salience
    if (isPositive(ev)) positiveSignal += ev.salience
    if (isEscalation(ev)) escalationEventCount += 1
  }

  return {
    subject,
    windowStart,
    windowEnd,
    eventCount: inWindow.length,
    distinctTypes: distinct.size,
    meanGapDays: meanGapDays(inWindow),
    frequencySlope: frequencySlope(inWindow, windowStart),
    recencyDays,
    negativeSignal,
    positiveSignal,
    escalationEventCount,
  }
}
