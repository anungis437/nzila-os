import { describe, expect, it } from 'vitest'
import { CHAIN_PREFIX, chainHash, checkAgainstWitness, verifyChain, type ChainableEvent, type StoredChainRow } from '../audit-chain'

const DOC = '00000000-0000-4000-8000-0000000000d1'

const event = (n: number, extra: Partial<ChainableEvent> = {}): ChainableEvent => ({
  documentId: DOC,
  signerId: n === 2 ? 'signer-1' : null,
  eventType: ['document_sent', 'document_signed', 'document_completed'][n - 1] ?? `event_${n}`,
  eventDescription: `event ${n}`,
  actorUserId: 'user-1',
  ipAddress: '203.0.113.7',
  metadata: { recordedAt: `2026-01-0${n}T00:00:00.000Z` },
  ...extra,
})

/** Builds a stored trail the way AuditTrailService.log does. */
function build(count: number): StoredChainRow[] {
  const rows: StoredChainRow[] = []
  let previous: string | null = null
  for (let seq = 1; seq <= count; seq++) {
    const e = event(seq)
    const metadata = { ...e.metadata, chainSeq: seq }
    const hash = chainHash(previous, { ...e, metadata }, seq)
    rows.push({ ...e, metadata, hashChain: hash })
    previous = hash
  }
  return rows
}

describe('signature audit chain', () => {
  it('verifies an untouched trail and reports its head', () => {
    const rows = build(4)
    const result = verifyChain(rows)

    expect(result).toMatchObject({ ok: true, chained: 4, legacyUnchained: 0, head: rows[3].hashChain })
    expect(rows.every((row) => row.hashChain?.startsWith(CHAIN_PREFIX))).toBe(true)
  })

  it('does not depend on the order the rows are read in', () => {
    const rows = build(5)
    expect(verifyChain([...rows].reverse()).ok).toBe(true)
  })

  it.each([
    ['the description of an event', (rows: StoredChainRow[]) => { rows[1].eventDescription = 'someone else signed' }],
    ['the actor of an event', (rows: StoredChainRow[]) => { rows[1].actorUserId = 'user-9' }],
    ['the recorded network address', (rows: StoredChainRow[]) => { rows[1].ipAddress = '198.51.100.9' }],
    ['the geolocation', (rows: StoredChainRow[]) => { rows[1].geolocation = { country: 'XX' } }],
    ['an evidential metadata field', (rows: StoredChainRow[]) => { rows[1].metadata = { ...rows[1].metadata, fileHashCheck: 'verified' } }],
    ['the document an event belongs to', (rows: StoredChainRow[]) => { rows[1].documentId = 'other' }],
  ])('detects a change to %s at that event', (_label, tamper) => {
    const rows = build(4)
    tamper(rows)

    expect(verifyChain(rows)).toMatchObject({ ok: false, brokenAtSeq: 2, reason: 'hash_mismatch' })
  })

  it('detects a removed event as a gap in the sequence', () => {
    const rows = build(4)
    rows.splice(1, 1)

    expect(verifyChain(rows)).toMatchObject({ ok: false, brokenAtSeq: 2, reason: 'sequence_gap' })
  })

  it('detects a repeated sequence number', () => {
    const rows = build(3)
    rows.push({ ...rows[2] })

    expect(verifyChain(rows)).toMatchObject({ ok: false, reason: 'duplicate_sequence' })
  })

  it('detects events whose sequence numbers were swapped', () => {
    const rows = build(3)
    const a = rows[1].metadata as { chainSeq: number }
    const b = rows[2].metadata as { chainSeq: number }
    ;[a.chainSeq, b.chainSeq] = [b.chainSeq, a.chainSeq]

    expect(verifyChain(rows).ok).toBe(false)
  })

  it('detects a forged event inserted with a hash that does not follow the one before it', () => {
    const rows = build(3)
    const forged = { ...event(3, { eventDescription: 'forged' }), metadata: { chainSeq: 4 }, hashChain: `${CHAIN_PREFIX}${'0'.repeat(64)}` }

    expect(verifyChain([...rows, forged])).toMatchObject({ ok: false, brokenAtSeq: 4, reason: 'hash_mismatch' })
  })

  it('does not mistake an altered hash column for an intact event', () => {
    const rows = build(3)
    rows[0].hashChain = null

    expect(verifyChain(rows)).toMatchObject({ ok: false, brokenAtSeq: 1 })
  })

  it('counts the trail from before chaining as unchained rather than verifying or failing it', () => {
    const legacy: StoredChainRow = { ...event(1), metadata: null, hashChain: null }
    const result = verifyChain([legacy, ...build(2)])

    expect(result).toMatchObject({ ok: true, chained: 2, legacyUnchained: 1 })
  })

  it('reports an empty trail as nothing chained, never as verified evidence', () => {
    expect(verifyChain([])).toMatchObject({ ok: true, chained: 0, head: null })
  })

  it('stays the same hash for the same content whatever the key order of nested fields', () => {
    const a = chainHash(null, { ...event(1), geolocation: { country: 'CA', region: 'ON' } }, 1)
    const b = chainHash(null, { ...event(1), geolocation: { region: 'ON', country: 'CA' } }, 1)

    expect(a).toBe(b)
  })
})

describe('chain checked against a witness kept elsewhere', () => {
  const witnessAt = (rows: StoredChainRow[], events: number) => ({ head: rows[events - 1].hashChain as string, events })

  it('matches an untouched trail and counts the events recorded after the witness', () => {
    const rows = build(5)
    expect(checkAgainstWitness(rows, witnessAt(rows, 3))).toEqual({ status: 'matches', eventsAfterWitness: 2 })
  })

  it('shows the deletion of the newest events, which the chain alone cannot', () => {
    const rows = build(5)
    const witness = witnessAt(rows, 5)
    const truncated = rows.slice(0, 3)

    expect(verifyChain(truncated).ok).toBe(true)
    expect(checkAgainstWitness(truncated, witness)).toEqual({ status: 'history_missing', chainedEvents: 3, witnessedEvents: 5 })
  })

  it('shows a rewrite whose later hashes were recomputed to verify', () => {
    const rows = build(4)
    const witness = witnessAt(rows, 4)
    const forged: StoredChainRow[] = []
    let previous: string | null = null
    for (const row of rows) {
      const seq = (row.metadata as { chainSeq: number }).chainSeq
      const edited = seq === 2 ? { ...row, eventDescription: 'someone else signed' } : row
      const hash: string = chainHash(previous, edited, seq)
      forged.push({ ...edited, hashChain: hash })
      previous = hash
    }

    expect(verifyChain(forged).ok).toBe(true)
    expect(checkAgainstWitness(forged, witness)).toEqual({ status: 'head_mismatch', witnessedEvents: 4 })
  })

  it('treats a trail with no event at the witnessed sequence as missing history, including an empty one', () => {
    expect(checkAgainstWitness([], { head: 'sha256:x', events: 1 })).toEqual({ status: 'history_missing', chainedEvents: 0, witnessedEvents: 1 })
  })
})
