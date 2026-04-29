import { describe, it, expect } from 'vitest'
import { resolveFinanceFlag, FINANCE_FLAGS } from './feature-flags.js'

describe('resolveFinanceFlag', () => {
  it('returns true for FINANCE_CORE_ENABLED by default', () => {
    expect(resolveFinanceFlag(FINANCE_FLAGS.FINANCE_CORE_ENABLED, {})).toBe(true)
  })

  it('returns false for risky flags by default', () => {
    expect(resolveFinanceFlag(FINANCE_FLAGS.FINANCE_EXPERIMENTAL_ENABLED, {})).toBe(false)
    expect(resolveFinanceFlag(FINANCE_FLAGS.FINANCE_PAYOUTS_ENABLED, {})).toBe(false)
    expect(resolveFinanceFlag(FINANCE_FLAGS.FINANCE_GOVERNANCE_ENABLED, {})).toBe(false)
  })

  it('respects env override to enable a flag', () => {
    expect(resolveFinanceFlag(FINANCE_FLAGS.FINANCE_PAYOUTS_ENABLED, { FINANCE_PAYOUTS_ENABLED: '1' })).toBe(true)
    expect(resolveFinanceFlag(FINANCE_FLAGS.FINANCE_PAYOUTS_ENABLED, { FINANCE_PAYOUTS_ENABLED: 'true' })).toBe(true)
  })

  it('respects env override to disable a flag', () => {
    expect(resolveFinanceFlag(FINANCE_FLAGS.FINANCE_CORE_ENABLED, { FINANCE_CORE_ENABLED: 'false' })).toBe(false)
    expect(resolveFinanceFlag(FINANCE_FLAGS.FINANCE_CORE_ENABLED, { FINANCE_CORE_ENABLED: '0' })).toBe(false)
  })
})
