import { describe, expect, it } from 'vitest'
import { csvCell } from '../csv-cell'

// DEF-0B6-EMP-REMITTANCE-PACKAGE-SHAPE
describe('csvCell', () => {
  it('leaves an ordinary identifier alone', () => {
    expect(csvCell('E-1001')).toBe('E-1001')
  })

  it.each(['=cmd|calc', '+1+1', '-2+3', '@SUM(A1)', '\tTAB', '\rCR'])('neutralises a leading formula character in %j', (value) => {
    expect(csvCell(value).replace(/^"/, '').startsWith("'")).toBe(true)
  })

  it('quotes a cell holding a comma, a quote or a newline and doubles the quotes', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('a\nb')).toBe('"a\nb"')
  })
})
