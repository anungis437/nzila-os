import { describe, expect, it } from 'vitest'
import {
  GOVERNED_GAP_FILL_TAGS,
  evaluateLedgerIntegrity,
  ledgerDigest,
  readLedgerExceptions,
} from '../../../../tooling/scripts/lib/union-eyes-migration-ledger.mjs'

const hash = (n: number) => n.toString(16).padStart(64, '0')

function journal(name: string, start: number, count: number) {
  return {
    name,
    entries: Array.from({ length: count }, (_, i) => ({ tag: `${name}-${i}`, hash: hash(start + i) })),
  }
}

const scoped = journal('scoped', 100, 4)
const platform = journal('platform', 200, 3)
const journals = [scoped, platform]

// The real ledger interleaves the two journals.
const ledgerOrder = [
  ...scoped.entries.slice(0, 2),
  ...platform.entries,
  ...scoped.entries.slice(2),
]
const cleanRows = ledgerOrder.map((entry, i) => ({ id: i + 1, hash: entry.hash }))

function evaluate(rows: { id: number; hash: string }[], extra: Record<string, unknown> = {}) {
  return evaluateLedgerIntegrity({ rows, journals, ...extra })
}

function attest(rows: { id: number; hash: string }[]) {
  return { rowCount: rows.length, digest: ledgerDigest(rows) }
}

describe('migration ledger integrity', () => {
  it('accepts a complete interleaved ledger', () => {
    expect(evaluate(cleanRows).violations).toEqual([])
  })

  it('accepts a partial ledger that is a prefix of each journal', () => {
    expect(evaluate(cleanRows.slice(0, 3)).violations).toEqual([])
    expect(evaluate([]).violations).toEqual([])
  })

  it('does not treat an appended migration as drift', () => {
    const grown = [
      journal('scoped', 100, 4),
      { name: 'platform', entries: [...platform.entries, { tag: 'platform-3', hash: hash(203) }] },
    ]
    const attested = attest(cleanRows)
    const result = evaluateLedgerIntegrity({ rows: cleanRows, journals: grown, attested })
    expect(result.violations).toEqual([])
  })

  it.each([
    ['first', 0],
    ['middle', 3],
    ['latest', cleanRows.length - 1],
  ])('rejects an altered %s hash', (_label, index) => {
    const rows = cleanRows.map((row, i) => (i === index ? { ...row, hash: hash(9999) } : row))
    const result = evaluate(rows)
    expect(result.ok).toBe(false)
    expect(result.violations.join('\n')).toContain('in no journal')
  })

  it('rejects an altered latest hash even when it is attested', () => {
    const rows = cleanRows.map((row, i) => (i === cleanRows.length - 1 ? { ...row, hash: hash(9999) } : row))
    const result = evaluate(rows, { attested: attest(cleanRows) })
    expect(result.violations.join('\n')).toContain('no longer match its recorded digest')
  })

  it('rejects a deleted first row', () => {
    const result = evaluate(cleanRows.slice(1))
    expect(result.ok).toBe(false)
    expect(result.violations.join('\n')).toContain('is missing from the ledger')
  })

  it('rejects a deleted middle row', () => {
    const rows = cleanRows.filter((_, i) => i !== 3)
    expect(evaluate(rows).ok).toBe(false)
  })

  it('cannot see a deleted newest row from the ledger alone, but the attestation does', () => {
    const rows = cleanRows.slice(0, -1)
    expect(evaluate(rows).violations).toEqual([])
    const result = evaluate(rows, { attested: attest(cleanRows) })
    expect(result.violations.join('\n')).toContain('last attestation covered')
  })

  it('rejects a duplicated ledger row', () => {
    const rows = [...cleanRows, { id: cleanRows.length + 1, hash: cleanRows[2].hash }]
    expect(evaluate(rows).violations.join('\n')).toContain('a second time')
  })

  it('rejects a duplicate journal entry', () => {
    const doubled = [{ name: 'scoped', entries: [...scoped.entries, scoped.entries[1]] }, platform]
    const result = evaluateLedgerIntegrity({ rows: cleanRows, journals: doubled })
    expect(result.violations.join('\n')).toContain('more than once')
  })

  it('rejects reordered history within a journal', () => {
    const rows = cleanRows.map((row) => ({ ...row }))
    ;[rows[0].hash, rows[1].hash] = [rows[1].hash, rows[0].hash]
    expect(evaluate(rows).violations.join('\n')).toContain('order differs')
  })

  it('rejects rows that were deleted and re-inserted under new ids', () => {
    const rows = [...cleanRows.slice(0, -1), { id: 99, hash: cleanRows[cleanRows.length - 1].hash }]
    const result = evaluate(rows, { attested: attest(cleanRows) })
    expect(result.ok).toBe(false)
  })

  it('accepts a legacy hash only through a reviewed exception', () => {
    const rows = [{ id: 1, hash: hash(7777) }, ...cleanRows.map((row) => ({ ...row, id: row.id + 1 }))]
    expect(evaluate(rows).ok).toBe(false)
    expect(evaluate(rows, { exceptions: [{ hash: hash(7777), reason: 'legacy baseline row reviewed in ticket' }] }).ok).toBe(true)
  })

  it('ignores unknown rows only for the executor-level journal guard', () => {
    const rows = [{ id: 1, hash: hash(7777) }, ...cleanRows.map((row) => ({ ...row, id: row.id + 1 }))]
    expect(evaluateLedgerIntegrity({ rows, journals: [scoped], ignoreUnknown: true }).ok).toBe(true)
  })

  it('rejects a malformed exception file entry', () => {
    const path = new URL('./fixtures-ledger-exceptions.tmp.json', import.meta.url)
    expect(() => readLedgerExceptions(undefined)).not.toThrow()
    expect(readLedgerExceptions(path.pathname + '.absent')).toEqual([])
  })
  describe('governed gap-fill', () => {
    const governedJournals = [
      { name: 'scoped', entries: [0, 1, 2, 3].map((i) => ({ tag: i === 1 ? GOVERNED_GAP_FILL_TAGS[0] : `scoped-${i}`, hash: hash(300 + i) })) },
    ]
    const tagHash = (tag: string) => governedJournals[0].entries.find((entry) => entry.tag === tag)!.hash

    it('accepts the governed migration missing while later entries are recorded', () => {
      const rows = [0, 2, 3].map((i, n) => ({ id: n + 1, hash: hash(300 + i) }))
      expect(evaluateLedgerIntegrity({ rows, journals: governedJournals }).violations).toEqual([])
    })

    it('accepts the governed migration appended after later entries', () => {
      const rows = [0, 2, 3, 1].map((i, n) => ({ id: n + 1, hash: hash(300 + i) }))
      expect(evaluateLedgerIntegrity({ rows, journals: governedJournals }).violations).toEqual([])
      expect(tagHash(GOVERNED_GAP_FILL_TAGS[0])).toBe(hash(301))
    })

    it('still rejects any other migration missing or out of order', () => {
      const missing = [0, 1, 3].map((i, n) => ({ id: n + 1, hash: hash(300 + i) }))
      expect(evaluateLedgerIntegrity({ rows: missing, journals: governedJournals }).ok).toBe(false)
      const reordered = [0, 3, 2].map((i, n) => ({ id: n + 1, hash: hash(300 + i) }))
      expect(evaluateLedgerIntegrity({ rows: reordered, journals: governedJournals }).ok).toBe(false)
    })

    it('does not exempt the governed migration from duplicate or unknown-hash checks', () => {
      const dup = [0, 2, 1, 1].map((i, n) => ({ id: n + 1, hash: hash(300 + i) }))
      expect(evaluateLedgerIntegrity({ rows: dup, journals: governedJournals }).violations.join('\n')).toContain('a second time')
    })
  })})
