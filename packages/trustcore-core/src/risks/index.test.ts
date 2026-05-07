import { describe, expect, it } from 'vitest'
import {
  RISK_REGISTER_CATEGORIES,
  RISK_REGISTER_SEVERITIES,
  RISK_REGISTER_STATUSES,
  compareSeverityDesc,
  isOpenRisk,
  riskRegisterCategorySchema,
  riskRegisterSeveritySchema,
  riskRegisterStatusSchema,
} from './index'

describe('risk register enums', () => {
  it('exposes the 10 register categories', () => {
    expect(RISK_REGISTER_CATEGORIES).toHaveLength(10)
    expect(RISK_REGISTER_CATEGORIES).toContain('governance')
    expect(RISK_REGISTER_CATEGORIES).toContain('financial')
  })

  it('exposes severities low → critical', () => {
    expect(RISK_REGISTER_SEVERITIES).toEqual(['low', 'medium', 'high', 'critical'])
  })

  it('exposes the five lifecycle statuses', () => {
    expect(RISK_REGISTER_STATUSES).toEqual([
      'open', 'mitigating', 'accepted', 'transferred', 'closed',
    ])
  })
})

describe('compareSeverityDesc', () => {
  it('sorts critical first, low last', () => {
    const sorted = ['low', 'critical', 'medium', 'high'].sort(
      // @ts-expect-error narrow widening for test convenience
      compareSeverityDesc,
    )
    expect(sorted).toEqual(['critical', 'high', 'medium', 'low'])
  })

  it('returns 0 for equal severities', () => {
    expect(compareSeverityDesc('high', 'high')).toBe(0)
  })
})

describe('isOpenRisk', () => {
  it('treats open and mitigating as open', () => {
    expect(isOpenRisk('open')).toBe(true)
    expect(isOpenRisk('mitigating')).toBe(true)
  })

  it('treats accepted/transferred/closed as not open', () => {
    expect(isOpenRisk('accepted')).toBe(false)
    expect(isOpenRisk('transferred')).toBe(false)
    expect(isOpenRisk('closed')).toBe(false)
  })
})

describe('zod schemas', () => {
  it('accepts valid enum values', () => {
    expect(riskRegisterCategorySchema.parse('governance')).toBe('governance')
    expect(riskRegisterSeveritySchema.parse('critical')).toBe('critical')
    expect(riskRegisterStatusSchema.parse('mitigating')).toBe('mitigating')
  })

  it('rejects invalid values', () => {
    expect(() => riskRegisterCategorySchema.parse('nope')).toThrow()
    expect(() => riskRegisterSeveritySchema.parse('catastrophic')).toThrow()
    expect(() => riskRegisterStatusSchema.parse('done')).toThrow()
  })
})
