/**
 * @nzila/zonga-rights — Split Agreement Engine
 *
 * Validates splits sum to 100%, manages agreement lifecycle,
 * versioning, and signature tracking.
 */
import type { SplitAgreement, SplitEntry, Signatory, RightsVersionHistory } from './types'
import { AgreementStatus } from './types'

// ── Validation ────────────────────────────────────────────────────────────

export interface SplitValidation {
  readonly valid: boolean
  readonly errors: string[]
}

/**
 * Validate that split entries are consistent.
 * - Percentages within each rights type must sum to exactly 100
 * - No duplicate holder+rights-type combinations
 * - All percentages positive
 */
export function validateSplits(splits: readonly SplitEntry[]): SplitValidation {
  const errors: string[] = []

  if (splits.length === 0) {
    return { valid: false, errors: ['At least one split entry is required'] }
  }

  // Check for negative/zero percentages
  for (const split of splits) {
    if (split.percentage <= 0) {
      errors.push(`Split for ${split.holderName} has non-positive percentage: ${split.percentage}%`)
    }
    if (split.percentage > 100) {
      errors.push(`Split for ${split.holderName} exceeds 100%: ${split.percentage}%`)
    }
  }

  // Group by rights type and validate each sums to 100
  const byRightsType = new Map<string, SplitEntry[]>()
  for (const split of splits) {
    const existing = byRightsType.get(split.rightsType) ?? []
    existing.push(split)
    byRightsType.set(split.rightsType, existing)
  }

  for (const [rightsType, entries] of byRightsType) {
    const total = entries.reduce((sum, e) => sum + e.percentage, 0)
    const rounded = Math.round(total * 100) / 100
    if (rounded !== 100) {
      errors.push(`Splits for "${rightsType}" sum to ${rounded}%, must equal 100%`)
    }

    // Check for duplicate holders within the same rights type
    const holderIds = entries.map((e) => e.holderId)
    const uniqueHolders = new Set(holderIds)
    if (uniqueHolders.size !== holderIds.length) {
      errors.push(`Duplicate holder in "${rightsType}" splits`)
    }
  }

  return { valid: errors.length === 0, errors }
}

// ── Agreement Lifecycle ───────────────────────────────────────────────────

/**
 * Check if all signatories have signed.
 */
export function isFullySigned(agreement: SplitAgreement): boolean {
  return (
    agreement.signatories.length > 0 &&
    agreement.signatories.every((s) => s.status === 'signed')
  )
}

/**
 * Determine if an agreement can be amended.
 */
export function canAmend(agreement: SplitAgreement): boolean {
  return (
    agreement.status === AgreementStatus.ACTIVE ||
    agreement.status === AgreementStatus.DRAFT
  )
}

/**
 * Determine if an agreement can accept signatures.
 */
export function canSign(agreement: SplitAgreement): boolean {
  return (
    agreement.status === AgreementStatus.PENDING_SIGNATURES ||
    agreement.status === AgreementStatus.DRAFT
  )
}

/**
 * Record a signature on a split agreement.
 * Returns updated signatories array.
 */
export function recordSignature(
  signatories: readonly Signatory[],
  holderId: string,
  action: 'signed' | 'rejected',
  rejectionReason?: string,
): Signatory[] {
  return signatories.map((s) => {
    if (s.holderId !== holderId) return { ...s }
    if (s.status !== 'pending') return { ...s } // already acted

    return {
      ...s,
      status: action,
      signedAt: action === 'signed' ? new Date() : null,
      rejectionReason: action === 'rejected' ? rejectionReason : undefined,
    }
  })
}

/**
 * Compute the next agreement status after a signature action.
 */
export function computeAgreementStatus(
  signatories: readonly Signatory[],
): AgreementStatus {
  const hasRejection = signatories.some((s) => s.status === 'rejected')
  if (hasRejection) return AgreementStatus.TERMINATED

  const allSigned = signatories.every((s) => s.status === 'signed')
  if (allSigned) return AgreementStatus.ACTIVE

  return AgreementStatus.PENDING_SIGNATURES
}

// ── Versioning ────────────────────────────────────────────────────────────

/**
 * Build a version history entry for an amendment.
 */
export function buildVersionHistoryEntry(
  assetId: string,
  agreementId: string,
  currentVersion: number,
  changedBy: string,
  previousSplits: readonly SplitEntry[],
  newSplits: readonly SplitEntry[],
  reason: string,
  changeType: RightsVersionHistory['changeType'] = 'amended',
): RightsVersionHistory {
  return {
    id: `version-${agreementId}-v${currentVersion + 1}`,
    assetId,
    agreementId,
    version: currentVersion + 1,
    changedBy,
    changeType,
    previousSplits,
    newSplits,
    reason,
    createdAt: new Date(),
  }
}
