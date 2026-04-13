import { describe, it, expect, vi } from 'vitest'
import {
  checkPayoutEligibility,
  DEFAULT_MINIMUM_PAYOUT_MINOR,
  DEFAULT_COOLDOWN_HOURS,
  type EligibilityCheckInput,
} from './payout-eligibility'

function makeInput(overrides?: Partial<EligibilityCheckInput>): EligibilityCheckInput {
  return {
    recipientId: 'recipient-1',
    orgId: 'org-1',
    balanceMinor: 5000,
    minimumPayoutMinor: DEFAULT_MINIMUM_PAYOUT_MINOR,
    kycVerified: true,
    hasActiveDisputes: false,
    payoutsFrozen: false,
    accountActive: true,
    lastPayoutAt: null,
    cooldownHours: DEFAULT_COOLDOWN_HOURS,
    ...overrides,
  }
}

describe('checkPayoutEligibility', () => {
  it('returns eligible for valid input', () => {
    const result = checkPayoutEligibility(makeInput())
    expect(result.eligible).toBe(true)
    expect(result.blockers).toHaveLength(0)
    expect(result.recipientId).toBe('recipient-1')
    expect(result.orgId).toBe('org-1')
  })

  it('blocks inactive account', () => {
    const result = checkPayoutEligibility(makeInput({ accountActive: false }))
    expect(result.eligible).toBe(false)
    expect(result.blockers).toContainEqual(expect.stringContaining('not active'))
  })

  it('blocks unverified KYC', () => {
    const result = checkPayoutEligibility(makeInput({ kycVerified: false }))
    expect(result.eligible).toBe(false)
    expect(result.blockers).toContainEqual(expect.stringContaining('KYC'))
  })

  it('blocks active disputes', () => {
    const result = checkPayoutEligibility(makeInput({ hasActiveDisputes: true }))
    expect(result.eligible).toBe(false)
    expect(result.blockers).toContainEqual(expect.stringContaining('disputes'))
  })

  it('blocks frozen payouts', () => {
    const result = checkPayoutEligibility(makeInput({ payoutsFrozen: true }))
    expect(result.eligible).toBe(false)
    expect(result.blockers).toContainEqual(expect.stringContaining('frozen'))
  })

  it('blocks balance below minimum', () => {
    const result = checkPayoutEligibility(makeInput({ balanceMinor: 50, minimumPayoutMinor: 100 }))
    expect(result.eligible).toBe(false)
    expect(result.blockers).toContainEqual(expect.stringContaining('below minimum'))
  })

  it('allows balance equal to minimum', () => {
    const result = checkPayoutEligibility(makeInput({ balanceMinor: 100, minimumPayoutMinor: 100 }))
    expect(result.eligible).toBe(true)
  })

  it('blocks when cooldown has not elapsed', () => {
    const recentPayout = new Date(Date.now() - 1 * 60 * 60 * 1000) // 1 hour ago
    const result = checkPayoutEligibility(makeInput({
      lastPayoutAt: recentPayout,
      cooldownHours: 24,
    }))
    expect(result.eligible).toBe(false)
    expect(result.blockers).toContainEqual(expect.stringContaining('cooldown'))
  })

  it('allows payout after cooldown elapsed', () => {
    const oldPayout = new Date(Date.now() - 48 * 60 * 60 * 1000) // 48 hours ago
    const result = checkPayoutEligibility(makeInput({
      lastPayoutAt: oldPayout,
      cooldownHours: 24,
    }))
    expect(result.eligible).toBe(true)
  })

  it('skips cooldown check when lastPayoutAt is null', () => {
    const result = checkPayoutEligibility(makeInput({ lastPayoutAt: null }))
    expect(result.eligible).toBe(true)
  })

  it('skips cooldown check when cooldownHours is 0', () => {
    const recentPayout = new Date(Date.now() - 1 * 60 * 1000)
    const result = checkPayoutEligibility(makeInput({
      lastPayoutAt: recentPayout,
      cooldownHours: 0,
    }))
    expect(result.eligible).toBe(true)
  })

  it('collects all blocking reasons together', () => {
    const result = checkPayoutEligibility(makeInput({
      accountActive: false,
      kycVerified: false,
      hasActiveDisputes: true,
      payoutsFrozen: true,
      balanceMinor: 0,
    }))
    expect(result.eligible).toBe(false)
    expect(result.blockers.length).toBe(5)
  })

  it('preserves input fields in result', () => {
    const result = checkPayoutEligibility(makeInput({ kycVerified: true, balanceMinor: 999 }))
    expect(result.kycVerified).toBe(true)
    expect(result.balanceMinor).toBe(999)
    expect(result.minimumPayoutMinor).toBe(DEFAULT_MINIMUM_PAYOUT_MINOR)
    expect(result.hasActiveDisputes).toBe(false)
  })
})

describe('DEFAULT constants', () => {
  it('DEFAULT_MINIMUM_PAYOUT_MINOR is 100', () => {
    expect(DEFAULT_MINIMUM_PAYOUT_MINOR).toBe(100)
  })

  it('DEFAULT_COOLDOWN_HOURS is 24', () => {
    expect(DEFAULT_COOLDOWN_HOURS).toBe(24)
  })
})
