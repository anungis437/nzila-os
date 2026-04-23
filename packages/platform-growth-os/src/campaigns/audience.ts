/**
 * Audience segments — declarative predicate evaluation over arbitrary records.
 *
 * Predicates are ANDed. `has_tag` requires a `tags: string[]` field on the
 * subject. `matches` is a case-insensitive substring match.
 */
import { audienceSegmentSchema } from '../schemas'
import { listRecords, readRecord, writeRecord } from '../store'
import type { AudiencePredicate, AudienceSegment, GrowthScope } from '../types'
import { makeId, nowISO, scopeKey } from '../utils'

const ENTITY = 'audience-segment'

export function upsertAudienceSegment(input: {
  scope: GrowthScope
  label: string
  description?: string
  predicates: AudiencePredicate[]
  id?: string
}): AudienceSegment {
  const now = nowISO()
  const id = input.id ?? makeId('aud')
  const existing = readRecord(ENTITY, id, audienceSegmentSchema)
  const record: AudienceSegment = {
    id,
    scope: input.scope,
    label: input.label,
    description: input.description ?? '',
    predicates: input.predicates,
    estimatedSize: existing?.estimatedSize,
    estimatedAt: existing?.estimatedAt,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  return writeRecord(ENTITY, id, record, audienceSegmentSchema)
}

export function getAudienceSegment(id: string): AudienceSegment | null {
  return readRecord(ENTITY, id, audienceSegmentSchema)
}

export function listAudienceSegments(scope?: GrowthScope): AudienceSegment[] {
  const all = listRecords(ENTITY, audienceSegmentSchema)
  if (!scope) return all
  const key = scopeKey(scope)
  return all.filter((s) => scopeKey(s.scope) === key)
}

/**
 * Evaluate a single predicate against a candidate record. Pure; no IO.
 */
export function evaluatePredicate(
  predicate: AudiencePredicate,
  record: Record<string, unknown>,
): boolean {
  const value = readField(record, predicate.field)
  switch (predicate.op) {
    case 'eq':
      return value === predicate.value
    case 'in':
      return Array.isArray(predicate.value) && predicate.value.includes(String(value))
    case 'gte':
      return typeof value === 'number' &&
        typeof predicate.value === 'number' &&
        value >= predicate.value
    case 'lte':
      return typeof value === 'number' &&
        typeof predicate.value === 'number' &&
        value <= predicate.value
    case 'has_tag':
      return Array.isArray(value) && value.includes(predicate.value as string)
    case 'matches':
      return (
        typeof value === 'string' &&
        typeof predicate.value === 'string' &&
        value.toLowerCase().includes(predicate.value.toLowerCase())
      )
    default:
      return false
  }
}

/**
 * Evaluate every predicate against the candidate (ANDed). Returns true if all pass.
 */
export function matchesSegment(
  segment: AudienceSegment,
  record: Record<string, unknown>,
): boolean {
  return segment.predicates.every((p) => evaluatePredicate(p, record))
}

/**
 * Apply a segment to a candidate set and return the matching records.
 */
export function filterBySegment<T extends Record<string, unknown>>(
  segment: AudienceSegment,
  candidates: readonly T[],
): T[] {
  return candidates.filter((c) => matchesSegment(segment, c))
}

/**
 * Re-estimate segment size from a candidate set and persist.
 */
export function updateSegmentEstimate(
  id: string,
  candidates: readonly Record<string, unknown>[],
): AudienceSegment | null {
  const seg = getAudienceSegment(id)
  if (!seg) return null
  const matched = filterBySegment(seg, candidates).length
  const updated: AudienceSegment = {
    ...seg,
    estimatedSize: matched,
    estimatedAt: nowISO(),
    updatedAt: nowISO(),
  }
  return writeRecord(ENTITY, id, updated, audienceSegmentSchema)
}

function readField(record: Record<string, unknown>, field: string): unknown {
  // dotted-path support, e.g. "metadata.industry"
  const parts = field.split('.')
  let cur: unknown = record
  for (const p of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}
