import { describe, expect, it } from 'vitest'
import { clauseDifferences, type ComparedClause } from '../comparison-differences'

const clause = (overrides: Partial<ComparedClause> = {}): ComparedClause => ({
  clauseType: 'wages',
  sector: 'public',
  province: 'ON',
  effectiveDate: '2024-04-01',
  expiryDate: '2026-03-31',
  sharingLevel: 'federation',
  ...overrides,
})

describe('clauseDifferences', () => {
  it('lists the distinct values each attribute takes, sorted', () => {
    const result = clauseDifferences([
      clause({ clauseType: 'wages', sector: 'public', province: 'ON', sharingLevel: 'public' }),
      clause({ clauseType: 'benefits', sector: 'education', province: 'QC', sharingLevel: 'federation' }),
      clause({ clauseType: 'wages', sector: 'public', province: 'ON', sharingLevel: 'public' }),
    ])
    expect(result.clauseTypes).toEqual(['benefits', 'wages'])
    expect(result.sectors).toEqual(['education', 'public'])
    expect(result.provinces).toEqual(['ON', 'QC'])
    expect(result.sharingLevels).toEqual(['federation', 'public'])
  })

  it('has one value, not a difference, where the clauses agree', () => {
    const result = clauseDifferences([clause(), clause()])
    expect(result.clauseTypes).toEqual(['wages'])
    expect(result.provinces).toEqual(['ON'])
  })

  it('leaves out an attribute a clause does not have, rather than listing it as a value', () => {
    const result = clauseDifferences([clause({ sector: null, province: null }), clause({ sector: 'public', province: null })])
    expect(result.sectors).toEqual(['public'])
    expect(result.provinces).toEqual([])
  })

  it('spans from the earliest effective date to the latest expiry date', () => {
    const result = clauseDifferences([
      clause({ effectiveDate: '2024-04-01', expiryDate: '2026-03-31' }),
      clause({ effectiveDate: '2022-01-15', expiryDate: '2025-12-31' }),
      clause({ effectiveDate: null, expiryDate: '2027-06-30' }),
    ])
    expect(result.dateRanges).toBe('2022-01-15 – 2027-06-30')
  })

  it('names the one end that is known, and has no range when no clause has a date', () => {
    expect(clauseDifferences([clause({ expiryDate: null })]).dateRanges).toBe('from 2024-04-01')
    expect(clauseDifferences([clause({ effectiveDate: null })]).dateRanges).toBe('until 2026-03-31')
    expect(clauseDifferences([clause({ effectiveDate: null, expiryDate: null })]).dateRanges).toBe('')
  })

  it('is empty for no clauses', () => {
    expect(clauseDifferences([])).toEqual({ clauseTypes: [], sectors: [], provinces: [], dateRanges: '', sharingLevels: [] })
  })
})
