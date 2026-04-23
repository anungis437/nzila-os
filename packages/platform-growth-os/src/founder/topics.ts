/**
 * Founder narrative — themes registry + due-cadence selector.
 */
import { founderTopicSchema } from '../schemas'
import { listRecords, readRecord, writeRecord } from '../store'
import type { FounderTopic, GrowthScope } from '../types'
import { daysBetween, makeId, nowISO, scopeKey } from '../utils'

const ENTITY = 'founder-topic'

export interface CreateFounderTopicInput {
  scope: GrowthScope
  ownerId: string
  theme: string
  audiences: FounderTopic['audiences']
  talkingPoints: string[]
  sources?: string[]
  cadenceDays: number
  id?: string
}

export function upsertFounderTopic(input: CreateFounderTopicInput): FounderTopic {
  const now = nowISO()
  const id = input.id ?? makeId('topic')
  const existing = readRecord(ENTITY, id, founderTopicSchema)
  const record: FounderTopic = {
    id,
    scope: input.scope,
    ownerId: input.ownerId,
    theme: input.theme,
    audiences: input.audiences,
    talkingPoints: input.talkingPoints,
    sources: input.sources ?? [],
    cadenceDays: input.cadenceDays,
    lastSurfacedAt: existing?.lastSurfacedAt,
    status: existing?.status ?? 'active',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  return writeRecord(ENTITY, id, record, founderTopicSchema)
}

export function getFounderTopic(id: string): FounderTopic | null {
  return readRecord(ENTITY, id, founderTopicSchema)
}

export function listFounderTopics(scope?: GrowthScope, ownerId?: string): FounderTopic[] {
  return listRecords(ENTITY, founderTopicSchema).filter((t) => {
    if (scope && scopeKey(t.scope) !== scopeKey(scope)) return false
    if (ownerId && t.ownerId !== ownerId) return false
    return true
  })
}

export function markTopicSurfaced(id: string, at?: string): FounderTopic {
  const cur = readRecord(ENTITY, id, founderTopicSchema)
  if (!cur) throw new Error(`Founder topic not found: ${id}`)
  const updated: FounderTopic = { ...cur, lastSurfacedAt: at ?? nowISO(), updatedAt: nowISO() }
  return writeRecord(ENTITY, id, updated, founderTopicSchema)
}

export function setTopicStatus(id: string, status: FounderTopic['status']): FounderTopic {
  const cur = readRecord(ENTITY, id, founderTopicSchema)
  if (!cur) throw new Error(`Founder topic not found: ${id}`)
  const updated: FounderTopic = { ...cur, status, updatedAt: nowISO() }
  return writeRecord(ENTITY, id, updated, founderTopicSchema)
}

/**
 * Topics whose cadence is due (or overdue). Sorted by overdue-days descending.
 * Audience filter is optional.
 */
export function dueFounderTopics(
  scope: GrowthScope,
  ownerId: string,
  opts?: { audience?: FounderTopic['audiences'][number]; now?: string },
): Array<FounderTopic & { overdueDays: number }> {
  const now = opts?.now ?? nowISO()
  const all = listFounderTopics(scope, ownerId).filter((t) => {
    if (t.status !== 'active') return false
    if (opts?.audience && !t.audiences.includes(opts.audience)) return false
    return true
  })
  const out: Array<FounderTopic & { overdueDays: number }> = []
  for (const t of all) {
    const ageDays = t.lastSurfacedAt ? daysBetween(t.lastSurfacedAt, now) : Number.POSITIVE_INFINITY
    if (ageDays >= t.cadenceDays) {
      const overdueDays = Number.isFinite(ageDays) ? ageDays - t.cadenceDays : t.cadenceDays
      out.push({ ...t, overdueDays })
    }
  }
  return out.sort((a, b) => b.overdueDays - a.overdueDays)
}
