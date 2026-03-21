/**
 * @nzila/zonga-payments — Payout Eligibility
 *
 * Validates whether a recipient is eligible for payout disbursement.
 * Checks KYC status, balance thresholds, dispute freezes, and
 * org-level payout policies.
 *
 * All monetary amounts are in integer minor units (cents).
 */

// ── Types ─────────────────────────────────────────────────────────────────

export interface EligibilityCheckInput {
  readonly recipientId: string
  readonly orgId: string
  readonly balanceMinor: number
  readonly minimumPayoutMinor: number
  readonly kycVerified: boolean
  readonly hasActiveDisputes: boolean
  readonly payoutsFrozen: boolean
  readonly accountActive: boolean
  readonly lastPayoutAt: Date | null
  readonly cooldownHours: number
}

export interface EligibilityResult {
  readonly eligible: boolean
  readonly recipientId: string
  readonly orgId: string
  readonly blockers: readonly string[]
  readonly kycVerified: boolean
  readonly balanceMinor: number
  readonly minimumPayoutMinor: number
  readonly hasActiveDisputes: boolean
}

// ── Default Thresholds ────────────────────────────────────────────────────

export const DEFAULT_MINIMUM_PAYOUT_MINOR = 100 // $1.00
export const DEFAULT_COOLDOWN_HOURS = 24

// ── Eligibility Check ─────────────────────────────────────────────────────

/**
 * Check whether a recipient is eligible for payout.
 *
 * Enforces:
 * - Account is active
 * - KYC is verified
 * - No active disputes freezing payouts
 * - Balance meets minimum threshold
 * - Cooldown period has elapsed since last payout
 */
export function checkPayoutEligibility(input: EligibilityCheckInput): EligibilityResult {
  const blockers: string[] = []

  if (!input.accountActive) {
    blockers.push('Account is not active')
  }

  if (!input.kycVerified) {
    blockers.push('KYC verification required before payout')
  }

  if (input.hasActiveDisputes) {
    blockers.push('Active disputes exist — payouts frozen until resolution')
  }

  if (input.payoutsFrozen) {
    blockers.push('Payouts are frozen for this account')
  }

  if (input.balanceMinor < input.minimumPayoutMinor) {
    blockers.push(
      `Balance (${input.balanceMinor}) below minimum payout threshold (${input.minimumPayoutMinor})`,
    )
  }

  if (input.lastPayoutAt && input.cooldownHours > 0) {
    const cooldownMs = input.cooldownHours * 60 * 60 * 1000
    const elapsed = Date.now() - input.lastPayoutAt.getTime()
    if (elapsed < cooldownMs) {
      const remainingHours = Math.ceil((cooldownMs - elapsed) / (60 * 60 * 1000))
      blockers.push(`Payout cooldown — ${remainingHours}h remaining`)
    }
  }

  return {
    eligible: blockers.length === 0,
    recipientId: input.recipientId,
    orgId: input.orgId,
    blockers,
    kycVerified: input.kycVerified,
    balanceMinor: input.balanceMinor,
    minimumPayoutMinor: input.minimumPayoutMinor,
    hasActiveDisputes: input.hasActiveDisputes,
  }
}
