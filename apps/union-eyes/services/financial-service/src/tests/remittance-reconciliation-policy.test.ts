import { describe, expect, it } from 'vitest'
import { calculateRemittanceVariance, moneyToCents, readMatchedTransactionIds } from '../routes/remittance-reconciliation-policy'

describe('financial remittance currency reconciliation', () => {
  it('converts decimal amounts to exact integer cents', () => {
    expect(moneyToCents('0.10')).toBe(10)
    expect(moneyToCents('0.2')).toBe(20)
    expect(moneyToCents('-12.34')).toBe(-1234)
    expect(moneyToCents(123.4)).toBe(12340)
  })

  it('matches amounts exactly rather than accepting floating-point drift', () => {
    expect(calculateRemittanceVariance('0.30', ['0.10', '0.20'])).toEqual({
      expectedAmount: 0.3,
      matchedAmount: 0.3,
      variance: 0,
      varianceAmount: '0.00',
      exactMatch: true,
    })
  })

  it('preserves negative and positive cent variances', () => {
    expect(calculateRemittanceVariance('10.00', ['10.01']).varianceAmount).toBe('-0.01')
    expect(calculateRemittanceVariance('10.00', ['9.99']).varianceAmount).toBe('0.01')
    expect(calculateRemittanceVariance('10.00', ['9.99']).exactMatch).toBe(false)
  })

  it('fails closed on malformed values and precision overflow', () => {
    for (const input of ['NaN', 'Infinity', '1.001', '1e3', '', '12abc']) {
      expect(() => moneyToCents(input)).toThrow()
    }
    expect(() => moneyToCents('9007199254740999999.00')).toThrow()
    expect(() => calculateRemittanceVariance('1.00', ['NaN'])).toThrow()
  })
  it('requires complete, unique UUID evidence for matched payments', () => {
    const id = '11111111-1111-4111-8111-111111111111'
    const other = '22222222-2222-4222-8222-222222222222'
    expect(readMatchedTransactionIds({ matchedTransactionIds: [id, other] })).toEqual([id, other])
    for (const invalid of [
      null, {}, [], { matchedTransactionIds: [] },
      { matchedTransactionIds: [id, id] },
      { matchedTransactionIds: [id, 'not-a-uuid'] },
      { matchedTransactionIds: [42] },
    ]) expect(readMatchedTransactionIds(invalid)).toBeNull()
  })

})
