import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateReferralCode,
  validateReferralCode,
  calculateReward,
  computeReferralStats,
  createReferralService,
  CreateReferralCodeSchema,
  RedeemReferralSchema,
} from './referral'
import type { ReferralCode, ReferralConversion, ReferralRepository } from './referral'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeCode(overrides: Partial<ReferralCode> = {}): ReferralCode {
  return {
    code: 'ABC123',
    referrerId: 'referrer-1',
    orgId: 'org-1',
    campaignId: null,
    createdAt: '2025-01-01T00:00:00Z',
    expiresAt: '2030-01-01T00:00:00Z',
    maxUses: 100,
    currentUses: 0,
    isActive: true,
    ...overrides,
  }
}

function makeConversion(overrides: Partial<ReferralConversion> = {}): ReferralConversion {
  return {
    id: 'conv-1',
    orgId: 'org-1',
    referralCode: 'ABC123',
    referrerId: 'referrer-1',
    referredUserId: 'referred-1',
    convertedAt: '2025-01-01T00:00:00Z',
    conversionType: 'first_stream',
    rewardStatus: 'eligible',
    rewardAmount: 50,
    rewardCurrency: 'USD',
    ...overrides,
  }
}

function makeRepo(): ReferralRepository {
  return {
    findCode: vi.fn(),
    insertCode: vi.fn(async (c) => ({ ...c, currentUses: 0 }) as ReferralCode),
    incrementCodeUses: vi.fn(),
    deactivateCode: vi.fn(),
    listCodesByReferrer: vi.fn(async () => []),
    insertConversion: vi.fn(async (c) => ({ id: 'conv-new', ...c }) as ReferralConversion),
    findConversion: vi.fn(async () => null),
    listConversions: vi.fn(async () => []),
    updateRewardStatus: vi.fn(),
    countConversions: vi.fn(async () => 0),
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('referral', () => {
  // ── generateReferralCode ─────────────────────────────────────────────────

  describe('generateReferralCode', () => {
    it('generates 6-char alphanumeric code', () => {
      const code = generateReferralCode('salt')
      expect(code).toHaveLength(6)
      expect(code).toMatch(/^[A-Z0-9]+$/)
    })

    it('excludes ambiguous characters (0, O, 1, I, L)', () => {
      // Generate several codes and check none contain ambiguous chars
      for (let i = 0; i < 20; i++) {
        const code = generateReferralCode(`salt-${i}`)
        expect(code).not.toMatch(/[01OIL]/)
      }
    })

    it('produces different codes for different salts', () => {
      const a = generateReferralCode('alpha')
      const b = generateReferralCode('beta')
      expect(a).not.toBe(b)
    })
  })

  // ── validateReferralCode ─────────────────────────────────────────────────

  describe('validateReferralCode', () => {
    it('returns invalid for null code', () => {
      const result = validateReferralCode(null, 'user-1')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('returns invalid for inactive code', () => {
      const result = validateReferralCode(makeCode({ isActive: false }), 'user-1')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('no longer active')
    })

    it('returns invalid for expired code', () => {
      const result = validateReferralCode(
        makeCode({ expiresAt: '2020-01-01T00:00:00Z' }),
        'user-1',
      )
      expect(result.valid).toBe(false)
      expect(result.error).toContain('expired')
    })

    it('returns invalid for maxed-out code', () => {
      const result = validateReferralCode(
        makeCode({ maxUses: 5, currentUses: 5 }),
        'user-1',
      )
      expect(result.valid).toBe(false)
      expect(result.error).toContain('maximum uses')
    })

    it('returns invalid for self-referral', () => {
      const result = validateReferralCode(makeCode(), 'referrer-1')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('own referral')
    })

    it('returns valid for good code', () => {
      const result = validateReferralCode(makeCode(), 'user-1')
      expect(result.valid).toBe(true)
      expect(result.code).toBeDefined()
    })

    it('ignores expiresAt when null', () => {
      const result = validateReferralCode(makeCode({ expiresAt: null }), 'user-1')
      expect(result.valid).toBe(true)
    })

    it('ignores maxUses when null', () => {
      const result = validateReferralCode(makeCode({ maxUses: null, currentUses: 999 }), 'user-1')
      expect(result.valid).toBe(true)
    })
  })

  // ── calculateReward ──────────────────────────────────────────────────────

  describe('calculateReward', () => {
    it('returns reward for known type', () => {
      const result = calculateReward('first_purchase')
      expect(result).not.toBeNull()
      expect(result!.referrerReward).toBe(200)
      expect(result!.referreeReward).toBe(100)
    })

    it('returns null for unknown type', () => {
      const result = calculateReward('nonexistent' as Parameters<typeof calculateReward>[0])
      expect(result).toBeNull()
    })

    it('returns 0 for signup type (no reward)', () => {
      const result = calculateReward('signup')
      expect(result).not.toBeNull()
      expect(result!.referrerReward).toBe(0)
    })
  })

  // ── computeReferralStats ─────────────────────────────────────────────────

  describe('computeReferralStats', () => {
    it('computes stats from conversions', () => {
      const conversions = [
        makeConversion({ rewardStatus: 'paid', rewardAmount: 50 }),
        makeConversion({ id: 'c2', rewardStatus: 'eligible', rewardAmount: 200 }),
        makeConversion({ id: 'c3', rewardStatus: 'pending', rewardAmount: 0 }),
      ]

      const stats = computeReferralStats('referrer-1', conversions)
      expect(stats.totalReferrals).toBe(3)
      expect(stats.successfulConversions).toBe(2) // paid + eligible
      expect(stats.pendingConversions).toBe(1)
      expect(stats.totalEarned).toBe(250) // 50 + 200
    })

    it('computes conversion rate', () => {
      const conversions = [
        makeConversion({ rewardStatus: 'paid' }),
        makeConversion({ id: 'c2', rewardStatus: 'denied' }),
      ]
      const stats = computeReferralStats('r', conversions)
      expect(stats.conversionRate).toBe(50) // 1/2 = 50%
    })

    it('handles empty conversions', () => {
      const stats = computeReferralStats('r', [])
      expect(stats.totalReferrals).toBe(0)
      expect(stats.conversionRate).toBe(0)
      expect(stats.topConversionType).toBeNull()
    })

    it('finds top conversion type', () => {
      const conversions = [
        makeConversion({ conversionType: 'signup' }),
        makeConversion({ id: 'c2', conversionType: 'first_stream' }),
        makeConversion({ id: 'c3', conversionType: 'first_stream' }),
      ]
      const stats = computeReferralStats('r', conversions)
      expect(stats.topConversionType).toBe('first_stream')
    })
  })

  // ── Zod Schemas ──────────────────────────────────────────────────────────

  describe('schemas', () => {
    it('CreateReferralCodeSchema validates valid input', () => {
      const result = CreateReferralCodeSchema.safeParse({
        referrerId: 'user-1',
        orgId: 'org-1',
      })
      expect(result.success).toBe(true)
    })

    it('RedeemReferralSchema validates valid input', () => {
      const result = RedeemReferralSchema.safeParse({
        code: 'ABCD',
        referredUserId: 'user-2',
        orgId: 'org-1',
        conversionType: 'signup',
      })
      expect(result.success).toBe(true)
    })

    it('RedeemReferralSchema rejects short code', () => {
      const result = RedeemReferralSchema.safeParse({
        code: 'AB',
        referredUserId: 'user-2',
        orgId: 'org-1',
        conversionType: 'signup',
      })
      expect(result.success).toBe(false)
    })
  })

  // ── createReferralService ────────────────────────────────────────────────

  describe('createReferralService', () => {
    let repo: ReferralRepository
    let service: ReturnType<typeof createReferralService>

    beforeEach(() => {
      repo = makeRepo()
      service = createReferralService({ repo })
    })

    it('createCode generates and persists a code', async () => {
      const code = await service.createCode({
        referrerId: 'user-1',
        orgId: 'org-1',
        campaignId: null,
        maxUses: null,
        expiryDays: null,
      })

      expect(repo.insertCode).toHaveBeenCalled()
      expect(code.code).toBeTruthy()
    })

    it('redeem validates code and creates conversion', async () => {
      vi.mocked(repo.findCode).mockResolvedValueOnce(makeCode())
      vi.mocked(repo.findConversion).mockResolvedValueOnce(null)
      vi.mocked(repo.countConversions).mockResolvedValueOnce(0)

      const result = await service.redeem({
        code: 'ABC123',
        referredUserId: 'user-2',
        orgId: 'org-1',
        conversionType: 'first_stream',
      })

      expect(result.conversion).toBeDefined()
      expect(result.referrerReward).toBe(50)
      expect(result.referreeReward).toBe(25)
      expect(repo.incrementCodeUses).toHaveBeenCalled()
    })

    it('redeem throws for invalid code', async () => {
      vi.mocked(repo.findCode).mockResolvedValueOnce(null)

      await expect(service.redeem({
        code: 'BAD1',
        referredUserId: 'user-2',
        orgId: 'org-1',
        conversionType: 'signup',
      })).rejects.toThrow('not found')
    })

    it('redeem throws for duplicate conversion', async () => {
      vi.mocked(repo.findCode).mockResolvedValueOnce(makeCode())
      vi.mocked(repo.findConversion).mockResolvedValueOnce(makeConversion())

      await expect(service.redeem({
        code: 'ABC123',
        referredUserId: 'user-2',
        orgId: 'org-1',
        conversionType: 'first_stream',
      })).rejects.toThrow('already converted')
    })

    it('redeem throws when referrer exceeded max rewards', async () => {
      vi.mocked(repo.findCode).mockResolvedValueOnce(makeCode())
      vi.mocked(repo.findConversion).mockResolvedValueOnce(null)
      vi.mocked(repo.countConversions).mockResolvedValueOnce(100) // >= maxRewardsPerReferrer

      await expect(service.redeem({
        code: 'ABC123',
        referredUserId: 'user-2',
        orgId: 'org-1',
        conversionType: 'signup',
      })).rejects.toThrow('maximum referral rewards')
    })

    it('getStats returns computed stats', async () => {
      vi.mocked(repo.listConversions).mockResolvedValueOnce([makeConversion()])
      const stats = await service.getStats('org-1', 'referrer-1')
      expect(stats.totalReferrals).toBe(1)
    })

    it('listCodes delegates to repo', async () => {
      vi.mocked(repo.listCodesByReferrer).mockResolvedValueOnce([makeCode()])
      const codes = await service.listCodes('org-1', 'user-1')
      expect(codes).toHaveLength(1)
    })

    it('deactivateCode delegates to repo', async () => {
      await service.deactivateCode('org-1', 'ABC123')
      expect(repo.deactivateCode).toHaveBeenCalledWith('org-1', 'ABC123')
    })
  })
})
