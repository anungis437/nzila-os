/**
 * How a delivery event from the email provider changes a message_log row.
 *
 * Provider events arrive out of order and are redelivered, so the row is advanced by rules, not by whichever event came last:
 *
 *  - a status only moves to a higher rank (a late `sent` never overwrites `bounced`; a `complained` never reverts);
 *  - a fact timestamp (delivered, opened, ...) is filled when it is missing, whatever the status does, because it is a fact
 *    about the message and not a verdict;
 *  - each campaign statistic counts a message at most once, however many times the event is redelivered, so the count is a
 *    number of messages and a retry can never inflate it.
 */
import { sql, type SQL } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'

export type MessageStatus =
  | 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed' | 'bounced' | 'unsubscribed' | 'complained'

/** Higher outranks lower. A delayed bounce or a complaint legitimately follows a delivery; nothing follows a complaint. */
const STATUS_RANK: Record<MessageStatus, number> = {
  queued: 0, sent: 1, delivered: 2, opened: 3, clicked: 4, failed: 5, bounced: 6, unsubscribed: 7, complained: 8,
}

export const COUNTED_KEYS = ['sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'unsubscribed', 'complained'] as const
export type StatKey = typeof COUNTED_KEYS[number]

const rank = (status: string | null | undefined) => STATUS_RANK[status as MessageStatus] ?? 0

/** The status the row should carry after an event: the higher-ranked of the stored and the incoming. */
export function advanceStatus(current: string | null | undefined, incoming: MessageStatus): MessageStatus {
  return rank(incoming) > rank(current) ? incoming : ((current as MessageStatus | null | undefined) ?? incoming)
}

export interface CountedSource {
  status?: string | null
  sentAt?: Date | null
  deliveredAt?: Date | null
  openedAt?: Date | null
  clickedAt?: Date | null
  bouncedAt?: Date | null
  metadata?: unknown
}

const LIMIT_OF_COUNTED = COUNTED_KEYS.length

/**
 * The statistics this message has already contributed. Rows written before the ledger existed carry it implicitly: a fact
 * timestamp or a terminal status means the message was already counted for that key.
 */
export function alreadyCounted(row: CountedSource): Set<StatKey> {
  const counted = new Set<StatKey>()
  const recorded = (row.metadata as { resendCounted?: unknown } | null | undefined)?.resendCounted
  if (Array.isArray(recorded)) {
    for (const key of recorded) if ((COUNTED_KEYS as readonly string[]).includes(key as string)) counted.add(key as StatKey)
  }
  if (row.sentAt) counted.add('sent')
  if (row.deliveredAt) counted.add('delivered')
  if (row.openedAt) counted.add('opened')
  if (row.clickedAt) counted.add('clicked')
  if (row.bouncedAt) counted.add('bounced')
  if (row.status === 'failed' || row.status === 'unsubscribed' || row.status === 'complained') counted.add(row.status)
  return counted
}

/** The keys this event adds to the statistics: its own key if new, plus `opened` when a click shows an open nobody reported. */
export function keysToCount(statKey: StatKey, counted: ReadonlySet<StatKey>): StatKey[] {
  const keys: StatKey[] = []
  if (!counted.has(statKey)) keys.push(statKey)
  if (statKey === 'clicked' && !counted.has('opened') && !keys.includes('opened')) keys.push('opened')
  return keys
}

/** Metadata after the event: everything already stored survives, and the counted set only grows (bounded by the closed key list). */
export function nextMetadata(
  existing: unknown,
  counted: ReadonlySet<StatKey>,
  added: readonly StatKey[],
  event: { type: string; createdAt?: string; lastErrorMessage?: string | null },
): Record<string, unknown> {
  const base = existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...(existing as Record<string, unknown>) } : {}
  const merged = [...new Set([...counted, ...added])].slice(0, LIMIT_OF_COUNTED)
  return {
    ...base,
    ...(event.lastErrorMessage ? { lastErrorMessage: event.lastErrorMessage } : {}),
    resendEventType: event.type,
    resendEventCreatedAt: event.createdAt,
    resendCounted: merged,
  }
}

/**
 * Atomic increment of campaign statistics. The counters are advanced inside the UPDATE itself, so a concurrent event adds to the
 * value that is stored now instead of overwriting it with one read earlier in the transaction.
 */
export function incrementedStats(column: PgColumn, keys: readonly StatKey[]): SQL {
  const pairs = keys.map((key) => sql`${key}::text, coalesce((${column}->>${key})::bigint, 0) + 1`)
  return sql`coalesce(${column}, '{}'::jsonb) || jsonb_build_object(${sql.join(pairs, sql`, `)})`
}
