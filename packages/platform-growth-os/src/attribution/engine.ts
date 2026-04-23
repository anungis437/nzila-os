/**
 * Multi-touch attribution computation.
 *
 * Models implemented:
 *   - first_touch:  100% to the first attribution event before close
 *   - last_touch:   100% to the last attribution event before close
 *   - linear:       evenly distributed across all touches
 *   - time_decay:   geometric decay (half-life 14 days) toward close
 *   - position:     40/40/20 (first/last/middle)
 *
 * Source resolution priority for grouping:
 *   campaignRunId → 'campaign'
 *   partnerId     → 'partner'
 *   channel       → 'channel'
 *   else          → 'channel:organic_visit'
 */
import { attributionEventSchema } from '../schemas'
import { listRecords, writeRecord } from '../store'
import type {
  AttributionContribution,
  AttributionEvent,
  AttributionModel,
  AttributionResult,
  GrowthScope,
} from '../types'
import { daysBetween, makeId, nowISO, scopeKey } from '../utils'

const ENTITY = 'attribution-event'

export function recordAttributionEvent(input: Omit<AttributionEvent, 'id' | 'recordedAt'> & {
  id?: string
}): AttributionEvent {
  const record: AttributionEvent = {
    id: input.id ?? makeId('att'),
    scope: input.scope,
    subjectKind: input.subjectKind,
    subjectId: input.subjectId,
    kind: input.kind,
    channel: input.channel,
    campaignRunId: input.campaignRunId,
    partnerId: input.partnerId,
    revenueCad: input.revenueCad,
    occurredAt: input.occurredAt,
    recordedAt: nowISO(),
  }
  return writeRecord(ENTITY, record.id, record, attributionEventSchema)
}

export function listAttributionEvents(scope?: GrowthScope, subjectId?: string): AttributionEvent[] {
  return listRecords(ENTITY, attributionEventSchema)
    .filter((e) => {
      if (scope && scopeKey(e.scope) !== scopeKey(scope)) return false
      if (subjectId && e.subjectId !== subjectId) return false
      return true
    })
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
}

/** Compute the source key + kind for a touch. */
function sourceOf(e: AttributionEvent): { source: string; sourceKind: AttributionContribution['sourceKind'] } {
  if (e.campaignRunId) return { source: e.campaignRunId, sourceKind: 'campaign' }
  if (e.partnerId) return { source: e.partnerId, sourceKind: 'partner' }
  return { source: e.channel ?? 'organic_visit', sourceKind: 'channel' }
}

const TERMINAL_KINDS = new Set<AttributionEvent['kind']>(['deal_closed_won'])

export interface ComputeAttributionInput {
  scope: GrowthScope
  subjectId: string
  model?: AttributionModel
}

/**
 * Compute attribution for a single subject.
 *
 * Behaviour:
 *   - revenue is the sum of `revenueCad` on terminal `deal_closed_won` events
 *     (typically a single event with the closed amount).
 *   - non-terminal touches before the FIRST close are credited; touches
 *     occurring after the close are ignored.
 *   - if no close exists, returns totalRevenueCad=0 with empty contributions.
 *   - if revenue exists but no non-terminal touches, the close itself is
 *     credited 100% to its own source.
 */
export function computeAttribution(input: ComputeAttributionInput): AttributionResult {
  const model: AttributionModel = input.model ?? 'linear'
  const events = listAttributionEvents(input.scope, input.subjectId)
  const closes = events.filter((e) => TERMINAL_KINDS.has(e.kind))

  if (closes.length === 0) {
    return {
      scope: input.scope,
      subjectId: input.subjectId,
      model,
      totalRevenueCad: 0,
      contributions: [],
      computedAt: nowISO(),
    }
  }

  const firstClose = closes[0]
  const closeAt = firstClose.occurredAt
  const totalRevenue = closes.reduce((s, e) => s + (e.revenueCad ?? 0), 0)

  const touches = events.filter(
    (e) => e.occurredAt <= closeAt && !TERMINAL_KINDS.has(e.kind),
  )

  // Eligible attribution candidates. If none, fall back to the close source.
  const candidates: AttributionEvent[] =
    touches.length > 0 ? touches : [firstClose]

  const weights = computeTouchWeights(candidates, closeAt, model)

  // Group by source.
  const grouped = new Map<string, { sourceKind: AttributionContribution['sourceKind']; weight: number }>()
  for (let i = 0; i < candidates.length; i++) {
    const src = sourceOf(candidates[i])
    const key = `${src.sourceKind}:${src.source}`
    const cur = grouped.get(key)
    if (cur) cur.weight += weights[i]
    else grouped.set(key, { sourceKind: src.sourceKind, weight: weights[i] })
  }

  const contributions: AttributionContribution[] = []
  for (const [key, v] of grouped.entries()) {
    if (v.weight === 0) continue
    const [, source] = splitFirst(key, ':')
    contributions.push({
      source,
      sourceKind: v.sourceKind,
      weight: v.weight,
      revenueCad: totalRevenue * v.weight,
    })
  }
  contributions.sort((a, b) => b.revenueCad - a.revenueCad)

  return {
    scope: input.scope,
    subjectId: input.subjectId,
    model,
    totalRevenueCad: totalRevenue,
    contributions,
    computedAt: nowISO(),
  }
}

function computeTouchWeights(
  touches: readonly AttributionEvent[],
  closeAt: string,
  model: AttributionModel,
): number[] {
  const n = touches.length
  if (n === 0) return []
  if (n === 1) return [1]

  switch (model) {
    case 'first_touch': {
      const w = Array(n).fill(0)
      w[0] = 1
      return w
    }
    case 'last_touch': {
      const w = Array(n).fill(0)
      w[n - 1] = 1
      return w
    }
    case 'linear':
      return Array(n).fill(1 / n)
    case 'time_decay': {
      // Geometric decay with half-life 14d toward close.
      const halfLife = 14
      const raw = touches.map((t) => {
        const age = Math.max(0, daysBetween(t.occurredAt, closeAt))
        return Math.pow(0.5, age / halfLife)
      })
      const sum = raw.reduce((s, v) => s + v, 0)
      return sum === 0 ? Array(n).fill(1 / n) : raw.map((v) => v / sum)
    }
    case 'position': {
      // 40/40/20 with middle split evenly.
      if (n === 2) return [0.5, 0.5]
      const w = Array(n).fill(0)
      w[0] = 0.4
      w[n - 1] = 0.4
      const middle = 0.2 / (n - 2)
      for (let i = 1; i < n - 1; i++) w[i] = middle
      return w
    }
    default:
      return Array(n).fill(1 / n)
  }
}

function splitFirst(s: string, sep: string): [string, string] {
  const i = s.indexOf(sep)
  return i === -1 ? [s, ''] : [s.slice(0, i), s.slice(i + 1)]
}
