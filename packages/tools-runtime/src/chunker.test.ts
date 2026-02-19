/**
 * Unit tests for the deterministic text chunker.
 * Verifies same input → same output, boundary handling, and edge cases.
 */
import { describe, it, expect } from 'vitest'
import { chunkText } from './knowledgeTool'

describe('chunkText', () => {
  const sampleText = 'abcdefghijklmnopqrstuvwxyz' // 26 chars

  it('produces deterministic output (same input → same chunks)', () => {
    const a = chunkText(sampleText, 10, 3, 100)
    const b = chunkText(sampleText, 10, 3, 100)
    expect(a).toEqual(b)
  })

  it('chunks without overlap correctly', () => {
    const chunks = chunkText(sampleText, 10, 0, 100)
    expect(chunks).toHaveLength(3)
    expect(chunks[0].text).toBe('abcdefghij')
    expect(chunks[1].text).toBe('klmnopqrst')
    expect(chunks[2].text).toBe('uvwxyz')
  })

  it('chunks with overlap correctly', () => {
    const chunks = chunkText(sampleText, 10, 3, 100)
    // step = 10 - 3 = 7
    // chunk 0: 0..10  "abcdefghij"
    // chunk 1: 7..17  "hijklmnopq"
    // chunk 2: 14..24 "opqrstuvwx"
    // chunk 3: 21..26 "vwxyz"
    expect(chunks).toHaveLength(4)
    expect(chunks[0].text).toBe('abcdefghij')
    expect(chunks[1].text).toBe('hijklmnopq')
    expect(chunks[2].text).toBe('opqrstuvwx')
    expect(chunks[3].text).toBe('vwxyz')
  })

  it('respects maxChunks limit', () => {
    const chunks = chunkText(sampleText, 5, 0, 2)
    expect(chunks).toHaveLength(2)
    expect(chunks[0].text).toBe('abcde')
    expect(chunks[1].text).toBe('fghij')
  })

  it('returns sequential chunk IDs', () => {
    const chunks = chunkText(sampleText, 10, 0, 100)
    expect(chunks[0].chunkId).toBe('chunk-000000')
    expect(chunks[1].chunkId).toBe('chunk-000001')
    expect(chunks[2].chunkId).toBe('chunk-000002')
  })

  it('returns sequential chunkIndex', () => {
    const chunks = chunkText(sampleText, 10, 0, 100)
    expect(chunks.map((c) => c.chunkIndex)).toEqual([0, 1, 2])
  })

  it('handles empty text', () => {
    const chunks = chunkText('', 10, 0, 100)
    expect(chunks).toEqual([])
  })

  it('handles text shorter than chunkSize', () => {
    const chunks = chunkText('short', 100, 0, 100)
    expect(chunks).toHaveLength(1)
    expect(chunks[0].text).toBe('short')
  })

  it('handles chunkSize equal to text length', () => {
    const chunks = chunkText('exact', 5, 0, 100)
    expect(chunks).toHaveLength(1)
    expect(chunks[0].text).toBe('exact')
  })

  it('handles single-char chunks', () => {
    const chunks = chunkText('abc', 1, 0, 100)
    expect(chunks).toHaveLength(3)
    expect(chunks.map((c) => c.text)).toEqual(['a', 'b', 'c'])
  })

  it('maintains determinism with large text', () => {
    const bigText = 'x'.repeat(10000)
    const a = chunkText(bigText, 900, 150, 5000)
    const b = chunkText(bigText, 900, 150, 5000)
    expect(a.length).toBeGreaterThan(10)
    expect(a).toEqual(b)
  })
})
