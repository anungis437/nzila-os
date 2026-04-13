/**
 * @nzila/os-core — Hash chain tests
 */
import { describe, it, expect } from 'vitest'
import { computeEntryHash, verifyChain } from '../hash'

describe('computeEntryHash', () => {
  it('returns a 64-char hex string (sha-256)', () => {
    const hash = computeEntryHash({ foo: 'bar' }, null)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic', () => {
    const a = computeEntryHash({ x: 1 }, null)
    const b = computeEntryHash({ x: 1 }, null)
    expect(a).toBe(b)
  })

  it('changes when payload changes', () => {
    const a = computeEntryHash({ x: 1 }, null)
    const b = computeEntryHash({ x: 2 }, null)
    expect(a).not.toBe(b)
  })

  it('changes when previousHash changes', () => {
    const a = computeEntryHash({ x: 1 }, null)
    const b = computeEntryHash({ x: 1 }, 'abc')
    expect(a).not.toBe(b)
  })

  it('genesis entry uses previousHash = null', () => {
    const hash = computeEntryHash('genesis', null)
    expect(hash).toBeTruthy()
  })
})

describe('verifyChain', () => {
  function buildChain(payloads: unknown[]) {
    const entries: { payload: unknown; hash: string; previousHash: string | null }[] = []
    for (const payload of payloads) {
      const prev = entries.length === 0 ? null : entries[entries.length - 1]!.hash
      const hash = computeEntryHash(payload, prev)
      entries.push({ payload, hash, previousHash: prev })
    }
    return entries
  }

  it('validates a correct chain', () => {
    const chain = buildChain(['a', 'b', 'c'])
    const result = verifyChain(chain, (e) => e.payload)
    expect(result).toEqual({ valid: true })
  })

  it('validates an empty chain', () => {
    const result = verifyChain([], (e: never) => e)
    expect(result).toEqual({ valid: true })
  })

  it('validates a single-entry chain', () => {
    const chain = buildChain(['only'])
    const result = verifyChain(chain, (e) => e.payload)
    expect(result).toEqual({ valid: true })
  })

  it('detects tampered hash', () => {
    const chain = buildChain(['a', 'b', 'c'])
    chain[1]!.hash = 'tampered' // corrupt middle entry
    const result = verifyChain(chain, (e) => e.payload)
    expect(result.valid).toBe(false)
    expect(result.brokenAtIndex).toBe(1)
  })

  it('detects tampered previousHash', () => {
    const chain = buildChain(['a', 'b', 'c'])
    chain[2]!.previousHash = 'wrong' // corrupt link
    const result = verifyChain(chain, (e) => e.payload)
    expect(result.valid).toBe(false)
    expect(result.brokenAtIndex).toBe(2)
  })

  it('detects tampered payload', () => {
    const chain = buildChain(['a', 'b', 'c'])
    chain[0]!.payload = 'z' // change payload but keep old hash
    const result = verifyChain(chain, (e) => e.payload)
    expect(result.valid).toBe(false)
    expect(result.brokenAtIndex).toBe(0)
  })
})
