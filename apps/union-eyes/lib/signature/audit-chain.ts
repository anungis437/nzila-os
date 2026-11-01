/**
 * Hash chain of the signature audit trail.
 *
 * Each event of a document carries a sequence number and a hash over the previous event's hash and its own content, so changing, removing
 * or reordering an event of a chained trail is detectable by recomputing the chain. The chain is tamper-evident, not tamper-proof: someone
 * who can rewrite every later row can recompute it. The seal written at completion (the chain head, repeated in the platform's own
 * hash-chained audit log) is what makes the end of the trail checkable against a record kept elsewhere.
 *
 * Time is deliberately not hashed from the stored timestamp columns (their zone handling differs between write and read); the moment of
 * the event is recorded as an ISO string inside the metadata, which is part of the hashed content.
 */
import { createHash } from 'node:crypto'

export const CHAIN_PREFIX = 'sha256:'

export interface ChainableEvent {
  documentId: string
  signerId?: string | null
  eventType: string
  eventDescription: string
  actorUserId?: string | null
  actorEmail?: string | null
  actorRole?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  geolocation?: unknown
  metadata?: Record<string, unknown> | null
}

export interface StoredChainRow extends ChainableEvent {
  hashChain: string | null
}

function stable(value: unknown): unknown {
  if (value === undefined) return null
  if (value === null || typeof value !== 'object') return value
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(stable)
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    const inner = (value as Record<string, unknown>)[key]
    if (inner !== undefined) out[key] = stable(inner)
  }
  return out
}

/** The content a link commits to: every evidential field and the sequence number, with the sequence key left out of the metadata. */
export function canonicalEvent(event: ChainableEvent, seq: number): string {
  const { chainSeq: _seq, ...metadata } = (event.metadata ?? {}) as Record<string, unknown>
  return JSON.stringify(
    stable({
      seq,
      documentId: event.documentId,
      signerId: event.signerId ?? null,
      eventType: event.eventType,
      eventDescription: event.eventDescription,
      actorUserId: event.actorUserId ?? null,
      actorEmail: event.actorEmail ?? null,
      actorRole: event.actorRole ?? null,
      ipAddress: event.ipAddress ?? null,
      userAgent: event.userAgent ?? null,
      geolocation: event.geolocation ?? null,
      metadata,
    }),
  )
}

export function chainHash(previous: string | null, event: ChainableEvent, seq: number): string {
  return CHAIN_PREFIX + createHash('sha256').update(`${previous ?? 'genesis'}\n${canonicalEvent(event, seq)}`).digest('hex')
}

export type ChainVerification =
  | { ok: true; chained: number; legacyUnchained: number; head: string | null }
  | { ok: false; chained: number; legacyUnchained: number; brokenAtSeq: number; reason: 'hash_mismatch' | 'sequence_gap' | 'duplicate_sequence'; head: string | null }

const seqOf = (row: StoredChainRow): number | null => {
  const seq = (row.metadata as { chainSeq?: unknown } | null | undefined)?.chainSeq
  return typeof seq === 'number' && Number.isInteger(seq) && seq > 0 ? seq : null
}

/**
 * Recomputes a document's chain. Rows with no sequence number are the trail from before chaining: they are counted, not verified. A
 * repeated or skipped sequence number, or a hash that does not match its content and its predecessor, breaks the chain at that
 * sequence number.
 */
export function verifyChain(rows: StoredChainRow[]): ChainVerification {
  const chainedRows = rows.filter((row) => seqOf(row) !== null).sort((a, b) => (seqOf(a) as number) - (seqOf(b) as number))
  const legacyUnchained = rows.length - chainedRows.length
  let previous: string | null = null
  let expected = 1
  for (const row of chainedRows) {
    const seq = seqOf(row) as number
    if (seq < expected) return { ok: false, chained: chainedRows.length, legacyUnchained, brokenAtSeq: seq, reason: 'duplicate_sequence', head: previous }
    if (seq > expected) return { ok: false, chained: chainedRows.length, legacyUnchained, brokenAtSeq: expected, reason: 'sequence_gap', head: previous }
    if (!row.hashChain || row.hashChain !== chainHash(previous, row, seq)) {
      return { ok: false, chained: chainedRows.length, legacyUnchained, brokenAtSeq: seq, reason: 'hash_mismatch', head: previous }
    }
    previous = row.hashChain
    expected += 1
  }
  return { ok: true, chained: chainedRows.length, legacyUnchained, head: previous }
}
