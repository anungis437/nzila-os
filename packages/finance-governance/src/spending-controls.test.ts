import { describe, it, expect } from 'vitest'
import { checkSpendingControl, validateDailySpend, validateMonthlySpend } from './spending-controls.js'
import type { SpendingControl } from './types.js'

const control: SpendingControl = {
  id: 'ctrl-1',
  orgId: 'org-1',
  dailyLimitCents: 500000,
  monthlyLimitCents: 2000000,
  perTransactionLimitCents: 100000,
  requiresApprovalAboveCents: 20000,
  requiresDualApprovalAboveCents: 50000,
  currency: 'ZAR',
  createdBy: 'admin-1',
  updatedAt: new Date().toISOString(),
}

describe('checkSpendingControl', () => {
  it('allows amounts within per-transaction limit', () => {
    const result = checkSpendingControl(control, 50000)
    expect(result.allowed).toBe(true)
  })

  it('blocks amounts exceeding per-transaction limit', () => {
    const result = checkSpendingControl(control, 150000)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBeDefined()
  })

  it('flags amounts requiring dual approval but still within per-transaction limit', () => {
    const result = checkSpendingControl(control, 60000)
    expect(result.allowed).toBe(true)
    expect(result.requiresDualApproval).toBe(true)
  })
})

describe('validateDailySpend', () => {
  it('allows spend within daily limit', () => {
    expect(validateDailySpend(control, 200000, 100000)).toBe(true)
  })

  it('blocks spend exceeding daily limit', () => {
    expect(validateDailySpend(control, 400000, 200000)).toBe(false)
  })
})

describe('validateMonthlySpend', () => {
  it('allows spend within monthly limit', () => {
    expect(validateMonthlySpend(control, 1000000, 500000)).toBe(true)
  })

  it('blocks spend exceeding monthly limit', () => {
    expect(validateMonthlySpend(control, 1800000, 500000)).toBe(false)
  })
})
