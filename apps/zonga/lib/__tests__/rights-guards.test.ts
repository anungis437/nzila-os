/**
 * Zonga — Rights Guards Test Suite
 *
 * Validates R1-R5 rights/royalty invariant guards.
 */
import { describe, it, expect } from 'vitest'
import {
  guardSplitsSum100,
  guardNoPayoutOnDisputedRelease,
  guardSplitsHaveValidCreators,
  guardDisputeResolutionUnfreezes,
  guardSyncLicenseHasRightsHolder,
} from '../guards/rights-guards'

describe('Rights invariant guards', () => {
  describe('R1: guardSplitsSum100', () => {
    it('passes when splits sum to 100', () => {
      expect(guardSplitsSum100([
        { sharePercent: 50 },
        { sharePercent: 30 },
        { sharePercent: 20 },
      ]).passed).toBe(true)
    })

    it('passes within tolerance (±0.01)', () => {
      expect(guardSplitsSum100([
        { sharePercent: 33.33 },
        { sharePercent: 33.33 },
        { sharePercent: 33.34 },
      ]).passed).toBe(true)
    })

    it('fails when splits do not sum to 100', () => {
      const result = guardSplitsSum100([
        { sharePercent: 50 },
        { sharePercent: 30 },
      ])
      expect(result.passed).toBe(false)
      expect(result.invariant).toBe('R1_SPLITS_SUM_100')
    })
  })

  describe('R2: guardNoPayoutOnDisputedRelease', () => {
    it('passes when no active disputes', () => {
      expect(guardNoPayoutOnDisputedRelease(false, 'rel-1').passed).toBe(true)
    })

    it('fails when release has active disputes', () => {
      const result = guardNoPayoutOnDisputedRelease(true, 'rel-1')
      expect(result.passed).toBe(false)
      expect(result.invariant).toBe('R2_NO_PAYOUT_ON_DISPUTED')
    })
  })

  describe('R3: guardSplitsHaveValidCreators', () => {
    it('passes when all creator IDs are non-empty', () => {
      expect(guardSplitsHaveValidCreators([
        { creatorId: 'c1', creatorName: 'A' },
        { creatorId: 'c2', creatorName: 'B' },
      ]).passed).toBe(true)
    })

    it('fails when a creator ID is empty', () => {
      const result = guardSplitsHaveValidCreators([
        { creatorId: 'c1', creatorName: 'A' },
        { creatorId: '', creatorName: 'B' },
      ])
      expect(result.passed).toBe(false)
      expect(result.invariant).toBe('R3_VALID_CREATOR_REFS')
    })
  })

  describe('R4: guardDisputeResolutionUnfreezes', () => {
    it('passes when disputes resolved and will unfreeze', () => {
      expect(guardDisputeResolutionUnfreezes(0, true).passed).toBe(true)
    })

    it('passes when disputes still remain (no unfreeze needed)', () => {
      expect(guardDisputeResolutionUnfreezes(2, false).passed).toBe(true)
    })

    it('fails when no disputes remain but unfreeze not applied', () => {
      const result = guardDisputeResolutionUnfreezes(0, false)
      expect(result.passed).toBe(false)
      expect(result.invariant).toBe('R4_DISPUTE_UNFREEZE')
    })
  })

  describe('R5: guardSyncLicenseHasRightsHolder', () => {
    it('passes when rights holder exists', () => {
      expect(guardSyncLicenseHasRightsHolder('asset-1', true).passed).toBe(true)
    })

    it('fails when rights holder is missing', () => {
      const result = guardSyncLicenseHasRightsHolder('asset-1', false)
      expect(result.passed).toBe(false)
      expect(result.invariant).toBe('R5_SYNC_LICENSE_RIGHTS')
    })
  })
})
