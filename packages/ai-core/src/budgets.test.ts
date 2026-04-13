import { describe, it, expect } from 'vitest'
import { estimateCo2Grams } from './budgets'

describe('estimateCo2Grams', () => {
  it('estimates for gpt-4o', () => {
    const result = estimateCo2Grams(1000, 'gpt-4o')
    expect(result).toBe(2.0)
  })

  it('estimates for gpt-4', () => {
    const result = estimateCo2Grams(1000, 'gpt-4')
    expect(result).toBe(3.5)
  })

  it('estimates for gpt-3.5-turbo', () => {
    const result = estimateCo2Grams(1000, 'gpt-3.5-turbo')
    expect(result).toBe(1.0)
  })

  it('estimates for text-embedding-ada-002', () => {
    const result = estimateCo2Grams(1000, 'text-embedding-ada-002')
    expect(result).toBe(0.2)
  })

  it('uses default rate for unknown models', () => {
    const result = estimateCo2Grams(1000, 'unknown-model-xyz')
    expect(result).toBe(2.0)
  })

  it('scales proportionally with token count', () => {
    const half = estimateCo2Grams(500, 'gpt-4o')
    const full = estimateCo2Grams(1000, 'gpt-4o')
    expect(full).toBe(half * 2)
  })

  it('handles namespaced model paths like azure/gpt-4o', () => {
    const result = estimateCo2Grams(1000, 'azure/gpt-4o')
    expect(result).toBe(2.0)
  })

  it('returns a number rounded to 4 decimal places', () => {
    const result = estimateCo2Grams(777, 'gpt-4o')
    const str = result.toString()
    const decimals = str.includes('.') ? str.split('.')[1].length : 0
    expect(decimals).toBeLessThanOrEqual(4)
  })

  it('returns 0 for zero tokens', () => {
    expect(estimateCo2Grams(0, 'gpt-4o')).toBe(0)
  })
})
