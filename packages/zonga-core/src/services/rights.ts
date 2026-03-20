/**
 * @nzila/zonga-core — Rights & Split Validation Services
 *
 * Pure functions for validating ownership splits, detecting conflicts,
 * and enforcing invariants on rights data.
 *
 * Zero I/O — callers supply data, callers persist results.
 *
 * @module @nzila/zonga-core/services/rights
 */

import type { RightsShare, SplitAgreement, SplitAgreementShare, RightsDispute } from '../types/index'

// ── Validation Results ──────────────────────────────────────────────────────

export interface SplitValidationResult {
  readonly valid: boolean
  readonly totalPercent: number
  readonly errors: readonly SplitValidationError[]
}

export interface SplitValidationError {
  readonly code: SplitErrorCode
  readonly message: string
  readonly context?: Readonly<Record<string, unknown>>
}

export type SplitErrorCode =
  | 'SHARES_EXCEED_100'
  | 'SHARES_BELOW_100'
  | 'NEGATIVE_SHARE'
  | 'ZERO_SHARE'
  | 'DUPLICATE_OWNER'
  | 'NO_SHARES'
  | 'OWNER_NAME_MISSING'

// ── Split Validation ────────────────────────────────────────────────────────

/**
 * Validates that a set of split agreement shares are consistent.
 *
 * Rules:
 * - Shares must sum to exactly 100
 * - No negative or zero shares
 * - No duplicate owners
 * - At least one share entry
 * - All owner names must be non-empty
 */
export function validateSplitShares(
  shares: readonly SplitAgreementShare[],
): SplitValidationResult {
  const errors: SplitValidationError[] = []

  if (shares.length === 0) {
    return { valid: false, totalPercent: 0, errors: [{ code: 'NO_SHARES', message: 'At least one share is required' }] }
  }

  const ownerIds = new Set<string>()
  let totalPercent = 0

  for (const share of shares) {
    if (share.sharePercent < 0) {
      errors.push({
        code: 'NEGATIVE_SHARE',
        message: `Share for ${share.ownerName} is negative (${share.sharePercent}%)`,
        context: { ownerId: share.ownerId, sharePercent: share.sharePercent },
      })
    }

    if (share.sharePercent === 0) {
      errors.push({
        code: 'ZERO_SHARE',
        message: `Share for ${share.ownerName} is zero`,
        context: { ownerId: share.ownerId },
      })
    }

    if (!share.ownerName.trim()) {
      errors.push({
        code: 'OWNER_NAME_MISSING',
        message: `Owner name is missing for share entry`,
        context: { ownerId: share.ownerId },
      })
    }

    if (ownerIds.has(share.ownerId)) {
      errors.push({
        code: 'DUPLICATE_OWNER',
        message: `Duplicate owner ${share.ownerName} (${share.ownerId})`,
        context: { ownerId: share.ownerId },
      })
    }
    ownerIds.add(share.ownerId)

    totalPercent += share.sharePercent
  }

  // Use tolerance for floating point
  const EPSILON = 0.001

  if (totalPercent > 100 + EPSILON) {
    errors.push({
      code: 'SHARES_EXCEED_100',
      message: `Shares total ${totalPercent}% (exceeds 100%)`,
      context: { totalPercent },
    })
  }

  if (totalPercent < 100 - EPSILON) {
    errors.push({
      code: 'SHARES_BELOW_100',
      message: `Shares total ${totalPercent}% (below 100%)`,
      context: { totalPercent },
    })
  }

  return { valid: errors.length === 0, totalPercent, errors }
}

// ── Territory Conflict Detection ────────────────────────────────────────────

export interface TerritoryConflict {
  readonly territory: string
  readonly totalPercent: number
  readonly shares: readonly { readonly ownerId: string; readonly sharePercent: number }[]
}

/**
 * Detects rights share conflicts where total ownership exceeds 100%
 * for a specific territory on a single asset.
 */
export function detectTerritoryConflicts(
  shares: readonly RightsShare[],
): readonly TerritoryConflict[] {
  const byTerritory = new Map<string, RightsShare[]>()

  for (const share of shares) {
    const existing = byTerritory.get(share.territory) ?? []
    existing.push(share)
    byTerritory.set(share.territory, existing)
  }

  const conflicts: TerritoryConflict[] = []

  for (const [territory, territoryShares] of byTerritory) {
    const totalPercent = territoryShares.reduce((sum, s) => sum + s.sharePercent, 0)
    if (totalPercent > 100.001) {
      conflicts.push({
        territory,
        totalPercent,
        shares: territoryShares.map((s) => ({ ownerId: s.ownerId, sharePercent: s.sharePercent })),
      })
    }
  }

  return conflicts
}

// ── ISRC Validation ─────────────────────────────────────────────────────────

/**
 * Validates an ISRC (International Standard Recording Code).
 * Format: CC-XXX-YY-NNNNN (12 chars alphanumeric, hyphens optional)
 */
export function validateISRC(isrc: string): { valid: boolean; normalized: string | null; error: string | null } {
  const normalized = isrc.replace(/[-\s]/g, '').toUpperCase()

  if (normalized.length !== 12) {
    return { valid: false, normalized: null, error: `ISRC must be 12 characters (got ${normalized.length})` }
  }

  if (!/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(normalized)) {
    return { valid: false, normalized: null, error: 'Invalid ISRC format. Expected: CC-XXX-YY-NNNNN' }
  }

  return { valid: true, normalized, error: null }
}

/**
 * Validates a UPC (Universal Product Code).
 * Standard UPC-A is 12 digits; EAN-13 is also accepted.
 */
export function validateUPC(upc: string): { valid: boolean; normalized: string | null; error: string | null } {
  const normalized = upc.replace(/[-\s]/g, '')

  if (!/^\d{12,13}$/.test(normalized)) {
    return { valid: false, normalized: null, error: 'UPC must be 12 or 13 digits' }
  }

  return { valid: true, normalized, error: null }
}

// ── Dispute Resolution Helpers ──────────────────────────────────────────────

/**
 * Determines if a dispute should block payouts for the associated asset/release.
 */
export function shouldBlockPayout(dispute: Pick<RightsDispute, 'status' | 'disputeType'>): boolean {
  const blockingStatuses = new Set(['open', 'under_review', 'evidence_requested', 'mediation'])
  const blockingTypes = new Set(['ownership', 'split_percentage', 'unauthorized_use', 'payout'])

  return blockingStatuses.has(dispute.status) && blockingTypes.has(dispute.disputeType)
}

/**
 * Checks if a split agreement can be activated based on its shares.
 */
export function canActivateSplitAgreement(
  agreement: Pick<SplitAgreement, 'shares' | 'status'>,
): { canActivate: boolean; reason: string | null } {
  if (agreement.status !== 'pending_approval') {
    return { canActivate: false, reason: `Cannot activate from status: ${agreement.status}` }
  }

  const allAccepted = agreement.shares.every((s) => s.accepted)
  if (!allAccepted) {
    const pending = agreement.shares.filter((s) => !s.accepted).map((s) => s.ownerName)
    return { canActivate: false, reason: `Awaiting acceptance from: ${pending.join(', ')}` }
  }

  const validation = validateSplitShares(agreement.shares)
  if (!validation.valid) {
    return { canActivate: false, reason: validation.errors[0]?.message ?? 'Invalid shares' }
  }

  return { canActivate: true, reason: null }
}
