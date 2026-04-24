import { describe, expect, it } from 'vitest'
import { createRng } from '../src/core/rng'

describe('createRng', () => {
  it('produces deterministic sequences for the same seed', () => {
    const a = createRng(42)
    const b = createRng(42)
    const seqA = Array.from({ length: 10 }, () => a.next())
    const seqB = Array.from({ length: 10 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  it('produces different sequences for different seeds', () => {
    const a = createRng(1)
    const b = createRng(2)
    expect(a.next()).not.toEqual(b.next())
  })

  it('generates ints within the requested inclusive range', () => {
    const r = createRng(7)
    for (let i = 0; i < 1000; i++) {
      const v = r.intBetween(5, 9)
      expect(v).toBeGreaterThanOrEqual(5)
      expect(v).toBeLessThanOrEqual(9)
      expect(Number.isInteger(v)).toBe(true)
    }
  })

  it('intBetween rejects invalid ranges', () => {
    const r = createRng(7)
    expect(() => r.intBetween(5, 1)).toThrow(/invalid range/)
  })

  it('pick returns a member of the array', () => {
    const r = createRng(11)
    const items = ['a', 'b', 'c'] as const
    for (let i = 0; i < 50; i++) expect(items).toContain(r.pick(items))
  })

  it('pick on empty array throws', () => {
    expect(() => createRng(1).pick([])).toThrow(/empty array/)
  })

  it('sample returns n distinct elements', () => {
    const r = createRng(3)
    const out = r.sample(['a', 'b', 'c', 'd', 'e'], 3)
    expect(out).toHaveLength(3)
    expect(new Set(out).size).toBe(3)
  })

  it('sample rejects n larger than items length', () => {
    expect(() => createRng(1).sample([1, 2], 5)).toThrow(/larger than/)
  })

  it('id is unique within a run and stable across runs', () => {
    const a = createRng(99)
    const b = createRng(99)
    const idsA = Array.from({ length: 5 }, () => a.id('x'))
    const idsB = Array.from({ length: 5 }, () => b.id('x'))
    expect(idsA).toEqual(idsB)
    expect(new Set(idsA).size).toBe(5)
    expect(idsA[0]).toMatch(/^x-[0-9a-f]+$/)
  })

  it('boolean honors probability bounds', () => {
    const r = createRng(123)
    expect(r.boolean(0)).toBe(false)
    const rTrue = createRng(123)
    expect(rTrue.boolean(1)).toBe(true)
    expect(() => r.boolean(-0.1)).toThrow()
    expect(() => r.boolean(1.1)).toThrow()
  })

  it('rejects invalid seeds', () => {
    expect(() => createRng(-1)).toThrow(/non-negative/)
    expect(() => createRng(1.5)).toThrow(/non-negative/)
    expect(() => createRng(Number.NaN)).toThrow(/non-negative/)
  })
})
