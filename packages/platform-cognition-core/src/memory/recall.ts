/**
 * @nzila/platform-cognition-core/memory — Recall ranking
 *
 * Ranks loaded MemoryEvents for a query using:
 *
 *     score = salience × decay(ageDays, halfLifeDays) × tagMatch
 *
 * tagMatch = (matched tags / requested tags), defaulting to 1.0 when the
 * caller did not request any tags. The components are returned alongside the
 * score so downstream UIs and audits can show *why* something was recalled.
 *
 * Filters (kinds / types / tags / since / until) are AND-ed and applied before
 * scoring, so the limit slices the top-N of an already-relevant set.
 *
 * @module @nzila/platform-cognition-core/memory/recall
 */
import { daysBetween } from '../utils'
import { exponentialDecay } from './decay'
import { loadMemoryEvents } from './store'
import type { MemoryEvent, MemoryRecallQuery, RecalledMemory } from '../types'

const DEFAULT_LIMIT = 50
const DEFAULT_HALF_LIFE_DAYS = 30

function passesFilters(ev: MemoryEvent, q: MemoryRecallQuery): boolean {
  if (q.kinds && q.kinds.length > 0 && !q.kinds.includes(ev.kind)) return false
  if (q.types && q.types.length > 0 && !q.types.includes(ev.type)) return false
  if (q.since && ev.occurredAt < q.since) return false
  if (q.until && ev.occurredAt > q.until) return false
  return true
}

function tagMatchScore(eventTags: readonly string[], queryTags?: readonly string[]): number {
  if (!queryTags || queryTags.length === 0) return 1
  const set = new Set(eventTags)
  let matched = 0
  for (const t of queryTags) if (set.has(t)) matched++
  return matched / queryTags.length
}

/**
 * Recall the top-N events for a subject. Returns an empty array (not null)
 * when nothing matches; never throws on empty stores.
 */
export function recallMemories(query: MemoryRecallQuery): RecalledMemory[] {
  const events = loadMemoryEvents(query.subject)
  const halfLife = query.halfLifeDays ?? DEFAULT_HALF_LIFE_DAYS
  const limit = query.limit ?? DEFAULT_LIMIT
  const now = query.now ?? new Date().toISOString()

  const scored: RecalledMemory[] = []
  for (const ev of events) {
    if (!passesFilters(ev, query)) continue
    const ageDays = Math.max(0, daysBetween(ev.occurredAt, now))
    const decay = exponentialDecay(ageDays, halfLife)
    const tagMatch = tagMatchScore(ev.tags, query.tags)
    if (tagMatch === 0 && query.tags && query.tags.length > 0) continue
    const score = ev.salience * decay * tagMatch
    scored.push({
      event: ev,
      score,
      components: { salience: ev.salience, decay, tagMatch },
    })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit)
}
