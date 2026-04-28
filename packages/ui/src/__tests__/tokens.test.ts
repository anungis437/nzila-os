import { describe, it, expect } from 'vitest'
import { tokens, productAccent, chartPalette, space, radius } from '../tokens'

describe('design tokens', () => {
  it('exposes a single 4-px-base spacing scale', () => {
    expect(space[4]).toBe('16px')
    expect(space[8]).toBe('32px')
  })

  it('caps radius at 4 named sizes plus full', () => {
    expect(Object.keys(radius)).toEqual(['sm', 'md', 'lg', 'xl', 'full'])
  })

  it('chart palette has 8 color-blind-safe slots', () => {
    expect(chartPalette).toHaveLength(8)
    chartPalette.forEach(c => expect(c).toMatch(/^#[0-9a-f]{6}$/i))
  })

  it('every product accent has both an accent and accent-soft hex', () => {
    Object.entries(productAccent).forEach(([key, val]) => {
      expect(val.accent, key).toMatch(/^#[0-9a-f]{6}$/i)
      expect(val.accentSoft, key).toMatch(/^#[0-9a-f]{6}$/i)
    })
  })

  it('top-level tokens object aggregates the named scales', () => {
    expect(tokens.space).toBe(space)
    expect(tokens.radius).toBe(radius)
    expect(tokens.chartPalette).toBe(chartPalette)
    expect(tokens.productAccent).toBe(productAccent)
  })
})
