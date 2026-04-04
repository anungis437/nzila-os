import { describe, it, expect } from 'vitest'
import {
  validateSplitShares,
  detectTerritoryConflicts,
  validateISRC,
  validateUPC,
  shouldBlockPayout,
  canActivateSplitAgreement,
} from './services/rights'
import type { SplitAgreementShare, RightsShare, SplitAgreement } from './types/index'
import { RightsOwnerRole, SplitAgreementStatus } from './enums'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeShare(overrides: Partial<SplitAgreementShare> = {}): SplitAgreementShare {
  return {
    ownerId: '550e8400-e29b-41d4-a716-446655440000',
    ownerName: 'DJ Kinshasa',
    role: RightsOwnerRole.PERFORMER,
    sharePercent: 50,
    accepted: true,
    acceptedAt: '2025-01-15T12:00:00Z',
    ...overrides,
  }
}

function makeRightsShare(overrides: Partial<RightsShare> = {}): RightsShare {
  return {
    id: '110e8400-e29b-41d4-a716-446655440010',
    assetId: '220e8400-e29b-41d4-a716-446655440020',
    ownerId: '330e8400-e29b-41d4-a716-446655440030',
    ownerRole: RightsOwnerRole.MASTER,
    sharePercent: 60,
    territory: 'NG',
    validFrom: '2025-01-01T00:00:00Z',
    validUntil: null,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('@nzila/zonga-core — rights service', () => {
  describe('validateSplitShares', () => {
    it('accepts valid shares summing to 100%', () => {
      const shares = [
        makeShare({ ownerId: 'a', ownerName: 'Artist A', sharePercent: 60 }),
        makeShare({ ownerId: 'b', ownerName: 'Producer B', sharePercent: 40 }),
      ]
      const result = validateSplitShares(shares)
      expect(result.valid).toBe(true)
      expect(result.totalPercent).toBe(100)
      expect(result.errors).toHaveLength(0)
    })

    it('rejects empty shares list', () => {
      const result = validateSplitShares([])
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.code).toBe('NO_SHARES')
    })

    it('detects shares exceeding 100%', () => {
      const shares = [
        makeShare({ ownerId: 'a', ownerName: 'A', sharePercent: 70 }),
        makeShare({ ownerId: 'b', ownerName: 'B', sharePercent: 40 }),
      ]
      const result = validateSplitShares(shares)
      expect(result.valid).toBe(false)
      expect(result.totalPercent).toBe(110)
      expect(result.errors.some(e => e.code === 'SHARES_EXCEED_100')).toBe(true)
    })

    it('detects shares below 100%', () => {
      const shares = [
        makeShare({ ownerId: 'a', ownerName: 'A', sharePercent: 30 }),
        makeShare({ ownerId: 'b', ownerName: 'B', sharePercent: 20 }),
      ]
      const result = validateSplitShares(shares)
      expect(result.valid).toBe(false)
      expect(result.totalPercent).toBe(50)
      expect(result.errors.some(e => e.code === 'SHARES_BELOW_100')).toBe(true)
    })

    it('rejects negative shares', () => {
      const shares = [
        makeShare({ ownerId: 'a', ownerName: 'A', sharePercent: 110 }),
        makeShare({ ownerId: 'b', ownerName: 'B', sharePercent: -10 }),
      ]
      const result = validateSplitShares(shares)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'NEGATIVE_SHARE')).toBe(true)
    })

    it('rejects zero shares', () => {
      const shares = [
        makeShare({ ownerId: 'a', ownerName: 'A', sharePercent: 100 }),
        makeShare({ ownerId: 'b', ownerName: 'B', sharePercent: 0 }),
      ]
      const result = validateSplitShares(shares)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'ZERO_SHARE')).toBe(true)
    })

    it('detects duplicate owners', () => {
      const shares = [
        makeShare({ ownerId: 'same-id', ownerName: 'A', sharePercent: 50 }),
        makeShare({ ownerId: 'same-id', ownerName: 'A', sharePercent: 50 }),
      ]
      const result = validateSplitShares(shares)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'DUPLICATE_OWNER')).toBe(true)
    })

    it('rejects empty owner names', () => {
      const shares = [
        makeShare({ ownerId: 'a', ownerName: '  ', sharePercent: 100 }),
      ]
      const result = validateSplitShares(shares)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'OWNER_NAME_MISSING')).toBe(true)
    })

    it('handles floating-point precision within tolerance', () => {
      const shares = [
        makeShare({ ownerId: 'a', ownerName: 'A', sharePercent: 33.333 }),
        makeShare({ ownerId: 'b', ownerName: 'B', sharePercent: 33.333 }),
        makeShare({ ownerId: 'c', ownerName: 'C', sharePercent: 33.334 }),
      ]
      const result = validateSplitShares(shares)
      expect(result.valid).toBe(true)
    })

    it('collects multiple errors at once', () => {
      const shares = [
        makeShare({ ownerId: 'a', ownerName: '', sharePercent: -5 }),
        makeShare({ ownerId: 'a', ownerName: 'Dup', sharePercent: 0 }),
      ]
      const result = validateSplitShares(shares)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('detectTerritoryConflicts', () => {
    it('returns empty for non-conflicting shares', () => {
      const shares = [
        makeRightsShare({ ownerId: 'a', territory: 'NG', sharePercent: 60 }),
        makeRightsShare({ ownerId: 'b', territory: 'NG', sharePercent: 40 }),
      ]
      const conflicts = detectTerritoryConflicts(shares)
      expect(conflicts).toHaveLength(0)
    })

    it('detects territory exceeding 100%', () => {
      const shares = [
        makeRightsShare({ ownerId: 'a', territory: 'KE', sharePercent: 70 }),
        makeRightsShare({ ownerId: 'b', territory: 'KE', sharePercent: 50 }),
      ]
      const conflicts = detectTerritoryConflicts(shares)
      expect(conflicts).toHaveLength(1)
      expect(conflicts[0]!.territory).toBe('KE')
      expect(conflicts[0]!.totalPercent).toBe(120)
    })

    it('handles multiple territories independently', () => {
      const shares = [
        makeRightsShare({ ownerId: 'a', territory: 'NG', sharePercent: 60 }),
        makeRightsShare({ ownerId: 'b', territory: 'NG', sharePercent: 60 }),
        makeRightsShare({ ownerId: 'c', territory: 'ZA', sharePercent: 50 }),
        makeRightsShare({ ownerId: 'd', territory: 'ZA', sharePercent: 40 }),
      ]
      const conflicts = detectTerritoryConflicts(shares)
      expect(conflicts).toHaveLength(1) // Only NG conflicts
      expect(conflicts[0]!.territory).toBe('NG')
    })

    it('returns empty for an empty list', () => {
      expect(detectTerritoryConflicts([])).toHaveLength(0)
    })
  })

  describe('validateISRC', () => {
    it('accepts valid ISRC with hyphens', () => {
      const result = validateISRC('US-S1Z-99-00001')
      expect(result.valid).toBe(true)
      expect(result.normalized).toBe('USS1Z9900001')
    })

    it('accepts valid ISRC without hyphens', () => {
      const result = validateISRC('USS1Z9900001')
      expect(result.valid).toBe(true)
      expect(result.normalized).toBe('USS1Z9900001')
    })

    it('rejects ISRC with wrong length', () => {
      const result = validateISRC('US-S1Z-99')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('12 characters')
    })

    it('rejects ISRC with invalid format', () => {
      const result = validateISRC('123456789012')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Invalid ISRC format')
    })

    it('normalizes to uppercase', () => {
      const result = validateISRC('us-s1z-99-00001')
      expect(result.valid).toBe(true)
      expect(result.normalized).toBe('USS1Z9900001')
    })
  })

  describe('validateUPC', () => {
    it('accepts valid 12-digit UPC', () => {
      const result = validateUPC('012345678901')
      expect(result.valid).toBe(true)
      expect(result.normalized).toBe('012345678901')
    })

    it('accepts valid 13-digit EAN', () => {
      const result = validateUPC('0123456789012')
      expect(result.valid).toBe(true)
      expect(result.normalized).toBe('0123456789012')
    })

    it('rejects non-numeric UPC', () => {
      const result = validateUPC('01234567890A')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('12 or 13 digits')
    })

    it('rejects UPC with wrong length', () => {
      const result = validateUPC('1234')
      expect(result.valid).toBe(false)
    })

    it('strips hyphens and spaces', () => {
      const result = validateUPC('012-345-678-901')
      expect(result.valid).toBe(true)
      expect(result.normalized).toBe('012345678901')
    })
  })

  describe('shouldBlockPayout', () => {
    it('blocks payout for open ownership dispute', () => {
      expect(shouldBlockPayout({ status: 'open', disputeType: 'ownership' })).toBe(true)
    })

    it('blocks payout for under_review split_percentage dispute', () => {
      expect(shouldBlockPayout({ status: 'under_review', disputeType: 'split_percentage' })).toBe(true)
    })

    it('blocks payout for mediation payout dispute', () => {
      expect(shouldBlockPayout({ status: 'mediation', disputeType: 'payout' })).toBe(true)
    })

    it('does not block payout for resolved dispute', () => {
      expect(shouldBlockPayout({ status: 'resolved_for_claimant', disputeType: 'ownership' })).toBe(false)
    })

    it('does not block payout for metadata dispute (non-blocking type)', () => {
      expect(shouldBlockPayout({ status: 'open', disputeType: 'metadata' })).toBe(false)
    })

    it('does not block payout for dismissed dispute', () => {
      expect(shouldBlockPayout({ status: 'dismissed', disputeType: 'ownership' })).toBe(false)
    })
  })

  describe('canActivateSplitAgreement', () => {
    it('allows activation when all shares accepted and status is pending_approval', () => {
      const agreement: Pick<SplitAgreement, 'shares' | 'status'> = {
        status: SplitAgreementStatus.PENDING_APPROVAL,
        shares: [
          makeShare({ ownerId: 'a', ownerName: 'A', sharePercent: 60, accepted: true }),
          makeShare({ ownerId: 'b', ownerName: 'B', sharePercent: 40, accepted: true }),
        ],
      }
      const result = canActivateSplitAgreement(agreement)
      expect(result.canActivate).toBe(true)
      expect(result.reason).toBeNull()
    })

    it('rejects activation from wrong status', () => {
      const agreement: Pick<SplitAgreement, 'shares' | 'status'> = {
        status: SplitAgreementStatus.DRAFT,
        shares: [makeShare({ ownerId: 'a', ownerName: 'A', sharePercent: 100, accepted: true })],
      }
      const result = canActivateSplitAgreement(agreement)
      expect(result.canActivate).toBe(false)
      expect(result.reason).toContain('Cannot activate from status')
    })

    it('rejects activation when shares not all accepted', () => {
      const agreement: Pick<SplitAgreement, 'shares' | 'status'> = {
        status: SplitAgreementStatus.PENDING_APPROVAL,
        shares: [
          makeShare({ ownerId: 'a', ownerName: 'Alice', sharePercent: 50, accepted: true }),
          makeShare({ ownerId: 'b', ownerName: 'Bob', sharePercent: 50, accepted: false }),
        ],
      }
      const result = canActivateSplitAgreement(agreement)
      expect(result.canActivate).toBe(false)
      expect(result.reason).toContain('Bob')
    })

    it('rejects activation when shares are invalid even if accepted', () => {
      const agreement: Pick<SplitAgreement, 'shares' | 'status'> = {
        status: SplitAgreementStatus.PENDING_APPROVAL,
        shares: [
          makeShare({ ownerId: 'a', ownerName: 'A', sharePercent: 60, accepted: true }),
          makeShare({ ownerId: 'b', ownerName: 'B', sharePercent: 60, accepted: true }),
        ],
      }
      const result = canActivateSplitAgreement(agreement)
      expect(result.canActivate).toBe(false)
      expect(result.reason).toContain('120')
    })
  })
})
