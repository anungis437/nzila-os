/**
 * @nzila/zonga-growth — Referral System
 *
 * Invite code generation, referral tracking, attribution chain,
 * and reward calculation for viral growth loops.
 *
 * @module @nzila/zonga-growth/referral
 */

import { z } from 'zod'

// ── Types ───────────────────────────────────────────────────────────────────

export interface ReferralCode {
  readonly code: string
  readonly referrerId: string
  readonly orgId: string
  readonly campaignId: string | null
  readonly createdAt: string
  readonly expiresAt: string | null
  readonly maxUses: number | null
  readonly currentUses: number
  readonly isActive: boolean
}

export interface ReferralConversion {
  readonly id: string
  readonly orgId: string
  readonly referralCode: string
  readonly referrerId: string
  readonly referredUserId: string
  readonly convertedAt: string
  readonly conversionType: ConversionType
  readonly rewardStatus: RewardStatus
  readonly rewardAmount: number       // cents
  readonly rewardCurrency: string
}

export type ConversionType = 'signup' | 'first_stream' | 'first_purchase' | 'subscription'
export type RewardStatus = 'pending' | 'eligible' | 'paid' | 'expired' | 'denied'

export interface ReferralRewardConfig {
  readonly rewards: readonly ReferralRewardTier[]
  readonly maxRewardsPerReferrer: number
  readonly rewardExpiryDays: number
  readonly cooldownMs: number            // Min time between conversions
  readonly requireVerifiedEmail: boolean
}

export interface ReferralRewardTier {
  readonly conversionType: ConversionType
  readonly rewardAmount: number           // cents
  readonly rewardCurrency: string
  readonly referrerGets: number           // cents
  readonly referreeGets: number           // cents
}

export interface ReferralStats {
  readonly referrerId: string
  readonly totalReferrals: number
  readonly successfulConversions: number
  readonly pendingConversions: number
  readonly totalEarned: number           // cents
  readonly conversionRate: number        // percentage
  readonly topConversionType: ConversionType | null
}

export interface ReferralChain {
  readonly userId: string
  readonly referredBy: string | null
  readonly depth: number                 // 0 = organic, 1 = direct referral, 2+ = chain
}

// ── Ports ───────────────────────────────────────────────────────────────────

export interface ReferralRepository {
  findCode(orgId: string, code: string): Promise<ReferralCode | null>
  insertCode(code: Omit<ReferralCode, 'currentUses'>): Promise<ReferralCode>
  incrementCodeUses(orgId: string, code: string): Promise<void>
  deactivateCode(orgId: string, code: string): Promise<void>
  listCodesByReferrer(orgId: string, referrerId: string): Promise<readonly ReferralCode[]>
  insertConversion(conversion: Omit<ReferralConversion, 'id'>): Promise<ReferralConversion>
  findConversion(orgId: string, referredUserId: string, conversionType: ConversionType): Promise<ReferralConversion | null>
  listConversions(orgId: string, referrerId: string): Promise<readonly ReferralConversion[]>
  updateRewardStatus(id: string, status: RewardStatus): Promise<void>
  countConversions(orgId: string, referrerId: string): Promise<number>
}

// ── Schemas ─────────────────────────────────────────────────────────────────

export const CreateReferralCodeSchema = z.object({
  referrerId: z.string().min(1),
  orgId: z.string().min(1),
  campaignId: z.string().nullable().default(null),
  maxUses: z.number().int().positive().nullable().default(null),
  expiryDays: z.number().int().positive().nullable().default(90),
})

export const RedeemReferralSchema = z.object({
  code: z.string().min(4).max(20),
  referredUserId: z.string().min(1),
  orgId: z.string().min(1),
  conversionType: z.enum(['signup', 'first_stream', 'first_purchase', 'subscription']),
})

// ── Default Config ──────────────────────────────────────────────────────────

export const DEFAULT_REFERRAL_CONFIG: Readonly<ReferralRewardConfig> = {
  rewards: [
    { conversionType: 'signup', rewardAmount: 0, rewardCurrency: 'USD', referrerGets: 0, referreeGets: 0 },
    { conversionType: 'first_stream', rewardAmount: 50, rewardCurrency: 'USD', referrerGets: 50, referreeGets: 25 },
    { conversionType: 'first_purchase', rewardAmount: 200, rewardCurrency: 'USD', referrerGets: 200, referreeGets: 100 },
    { conversionType: 'subscription', rewardAmount: 500, rewardCurrency: 'USD', referrerGets: 500, referreeGets: 250 },
  ],
  maxRewardsPerReferrer: 100,
  rewardExpiryDays: 30,
  cooldownMs: 60_000, // 1 minute between conversions to prevent abuse
  requireVerifiedEmail: true,
}

// ── Code Generation ─────────────────────────────────────────────────────────

/**
 * Generate a unique referral code.
 * Format: 6 alphanumeric characters, uppercase, no ambiguous chars (0/O, 1/I/L).
 */
export function generateReferralCode(salt: string = ''): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const input = `${Date.now()}-${salt}-${Math.random()}`
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0
  }
  // Use hash bits to index into character set
  let code = ''
  let h = Math.abs(hash)
  for (let i = 0; i < 6; i++) {
    code += chars[h % chars.length]
    h = Math.floor(h / chars.length) + i * 7 + 1
  }
  return code
}

// ── Validation ──────────────────────────────────────────────────────────────

export interface CodeValidation {
  readonly valid: boolean
  readonly error?: string
  readonly code?: ReferralCode
}

/**
 * Validate a referral code: exists, active, not expired, not maxed out.
 */
export function validateReferralCode(
  code: ReferralCode | null,
  referredUserId: string,
  now: number = Date.now(),
): CodeValidation {
  if (!code) {
    return { valid: false, error: 'Referral code not found' }
  }

  if (!code.isActive) {
    return { valid: false, error: 'Referral code is no longer active' }
  }

  if (code.expiresAt && new Date(code.expiresAt).getTime() < now) {
    return { valid: false, error: 'Referral code has expired' }
  }

  if (code.maxUses !== null && code.currentUses >= code.maxUses) {
    return { valid: false, error: 'Referral code has reached maximum uses' }
  }

  // Prevent self-referral
  if (code.referrerId === referredUserId) {
    return { valid: false, error: 'Cannot use your own referral code' }
  }

  return { valid: true, code }
}

// ── Reward Calculation ──────────────────────────────────────────────────────

/**
 * Calculate rewards for a conversion event.
 */
export function calculateReward(
  conversionType: ConversionType,
  config: Readonly<ReferralRewardConfig> = DEFAULT_REFERRAL_CONFIG,
): { referrerReward: number; referreeReward: number; currency: string } | null {
  const tier = config.rewards.find((r) => r.conversionType === conversionType)
  if (!tier) return null

  return {
    referrerReward: tier.referrerGets,
    referreeReward: tier.referreeGets,
    currency: tier.rewardCurrency,
  }
}

// ── Stats Computation ───────────────────────────────────────────────────────

/**
 * Compute referral statistics for a referrer.
 */
export function computeReferralStats(
  referrerId: string,
  conversions: readonly ReferralConversion[],
): ReferralStats {
  const successful = conversions.filter((c) => c.rewardStatus === 'paid' || c.rewardStatus === 'eligible')
  const pending = conversions.filter((c) => c.rewardStatus === 'pending')
  const totalEarned = successful.reduce((sum, c) => sum + c.rewardAmount, 0)

  // Find most common conversion type
  const typeCounts = new Map<ConversionType, number>()
  for (const c of conversions) {
    typeCounts.set(c.conversionType, (typeCounts.get(c.conversionType) ?? 0) + 1)
  }
  let topType: ConversionType | null = null
  let topCount = 0
  for (const [type, count] of typeCounts) {
    if (count > topCount) {
      topType = type
      topCount = count
    }
  }

  return {
    referrerId,
    totalReferrals: conversions.length,
    successfulConversions: successful.length,
    pendingConversions: pending.length,
    totalEarned,
    conversionRate: conversions.length > 0
      ? Math.round((successful.length / conversions.length) * 10000) / 100
      : 0,
    topConversionType: topType,
  }
}

// ── Referral Service ────────────────────────────────────────────────────────

export function createReferralService(deps: {
  repo: ReferralRepository
  config?: ReferralRewardConfig
}) {
  const { repo, config = DEFAULT_REFERRAL_CONFIG } = deps

  return {
    /**
     * Create a new referral code for a user.
     */
    async createCode(params: z.infer<typeof CreateReferralCodeSchema>): Promise<ReferralCode> {
      const parsed = CreateReferralCodeSchema.parse(params)
      const code = generateReferralCode(parsed.referrerId)

      const expiresAt = parsed.expiryDays
        ? new Date(Date.now() + parsed.expiryDays * 86_400_000).toISOString()
        : null

      return repo.insertCode({
        code,
        referrerId: parsed.referrerId,
        orgId: parsed.orgId,
        campaignId: parsed.campaignId,
        createdAt: new Date().toISOString(),
        expiresAt,
        maxUses: parsed.maxUses,
        isActive: true,
      })
    },

    /**
     * Redeem a referral code for a new user conversion.
     */
    async redeem(params: z.infer<typeof RedeemReferralSchema>): Promise<{
      conversion: ReferralConversion
      referrerReward: number
      referreeReward: number
    }> {
      const parsed = RedeemReferralSchema.parse(params)

      // 1. Validate code
      const codeRecord = await repo.findCode(parsed.orgId, parsed.code)
      const validation = validateReferralCode(codeRecord, parsed.referredUserId)
      if (!validation.valid) {
        throw new Error(validation.error)
      }

      // 2. Check for duplicate conversion
      const existing = await repo.findConversion(
        parsed.orgId,
        parsed.referredUserId,
        parsed.conversionType,
      )
      if (existing) {
        throw new Error('User has already converted for this referral type')
      }

      // 3. Check referrer hasn't exceeded max rewards
      const referrerConversions = await repo.countConversions(parsed.orgId, codeRecord!.referrerId)
      if (referrerConversions >= config.maxRewardsPerReferrer) {
        throw new Error('Referrer has reached maximum referral rewards')
      }

      // 4. Calculate reward
      const reward = calculateReward(parsed.conversionType, config)
      const rewardAmount = reward?.referrerReward ?? 0

      // 5. Record conversion
      const conversion = await repo.insertConversion({
        orgId: parsed.orgId,
        referralCode: parsed.code,
        referrerId: codeRecord!.referrerId,
        referredUserId: parsed.referredUserId,
        convertedAt: new Date().toISOString(),
        conversionType: parsed.conversionType,
        rewardStatus: rewardAmount > 0 ? 'pending' : 'paid',
        rewardAmount,
        rewardCurrency: reward?.currency ?? 'USD',
      })

      // 6. Increment code usage
      await repo.incrementCodeUses(parsed.orgId, parsed.code)

      return {
        conversion,
        referrerReward: reward?.referrerReward ?? 0,
        referreeReward: reward?.referreeReward ?? 0,
      }
    },

    /**
     * Get referral stats for a user.
     */
    async getStats(orgId: string, referrerId: string): Promise<ReferralStats> {
      const conversions = await repo.listConversions(orgId, referrerId)
      return computeReferralStats(referrerId, conversions)
    },

    /**
     * List all referral codes for a user.
     */
    async listCodes(orgId: string, referrerId: string): Promise<readonly ReferralCode[]> {
      return repo.listCodesByReferrer(orgId, referrerId)
    },

    /**
     * Deactivate a referral code.
     */
    async deactivateCode(orgId: string, code: string): Promise<void> {
      return repo.deactivateCode(orgId, code)
    },
  }
}
