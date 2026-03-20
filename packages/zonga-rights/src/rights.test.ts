import { describe, it, expect } from 'vitest'
import type { SplitAgreement, SplitEntry, Signatory, RightsDispute, RoyaltyAccrual } from './types'
import { AgreementStatus, DisputeStatus, RightsType, ContributorRole, RoyaltyTrigger } from './types'
import {
  validateSplits,
  isFullySigned,
  canAmend,
  canSign,
  recordSignature,
} from './agreements'
import {
  canFileDispute,
  canTransitionDispute,
  getAvailableDisputeTransitions,
  shouldFreezePayouts,
  getFrozenAssets,
} from './disputes'
import { checkPayoutReadiness, summarizeRoyalties } from './royalties'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSplit(partial?: Partial<SplitEntry>): SplitEntry {
  return {
    holderId: 'holder-1',
    holderName: 'Artist One',
    role: ContributorRole.PRIMARY_ARTIST,
    percentage: 100,
    rightsType: RightsType.MASTER,
    ...partial,
  }
}

function makeAgreement(partial?: Partial<SplitAgreement>): SplitAgreement {
  return {
    id: 'agr-1',
    assetId: 'track-1',
    assetType: 'track',
    title: 'Test Agreement',
    status: AgreementStatus.ACTIVE,
    splits: [makeSplit()],
    signatories: [],
    effectiveFrom: new Date('2025-01-01'),
    effectiveUntil: null,
    version: 1,
    previousVersionId: null,
    notes: '',
    createdBy: 'user-1',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...partial,
  }
}

function makeDispute(partial?: Partial<RightsDispute>): RightsDispute {
  return {
    id: 'dsp-1',
    assetId: 'track-1',
    type: 'ownership',
    status: DisputeStatus.FILED,
    complainantId: 'user-a',
    respondentId: 'user-b',
    description: 'Ownership claim',
    evidenceIds: [],
    resolution: null,
    payoutsFrozen: true,
    filedAt: new Date('2025-06-01'),
    resolvedAt: null,
    ...partial,
  }
}

function makeAccrual(partial?: Partial<RoyaltyAccrual>): RoyaltyAccrual {
  return {
    id: 'acr-1',
    assetId: 'track-1',
    holderId: 'holder-1',
    trigger: RoyaltyTrigger.STREAM,
    units: 1000,
    ratePerUnit: 0.003,
    grossAmount: 3,
    netAmount: 2.1,
    periodStart: new Date('2025-01-01'),
    periodEnd: new Date('2025-01-31'),
    status: 'approved',
    ...partial,
  }
}

// ── Agreements: validateSplits ───────────────────────────────────────────────

describe('validateSplits', () => {
  it('should pass when splits per rights type sum to 100%', () => {
    const splits = [
      makeSplit({ holderId: 'h1', percentage: 60, rightsType: RightsType.MASTER }),
      makeSplit({ holderId: 'h2', percentage: 40, rightsType: RightsType.MASTER }),
    ]
    const result = validateSplits(splits)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should fail when splits do not sum to 100%', () => {
    const splits = [
      makeSplit({ holderId: 'h1', percentage: 60, rightsType: RightsType.MASTER }),
      makeSplit({ holderId: 'h2', percentage: 30, rightsType: RightsType.MASTER }),
    ]
    const result = validateSplits(splits)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('90%')
  })

  it('should validate each rights type independently', () => {
    const splits = [
      makeSplit({ holderId: 'h1', percentage: 100, rightsType: RightsType.MASTER }),
      makeSplit({ holderId: 'h1', percentage: 50, rightsType: RightsType.PUBLISHING }),
      makeSplit({ holderId: 'h2', percentage: 50, rightsType: RightsType.PUBLISHING }),
    ]
    const result = validateSplits(splits)
    expect(result.valid).toBe(true)
  })

  it('should reject duplicate holders within same rights type', () => {
    const splits = [
      makeSplit({ holderId: 'h1', percentage: 50, rightsType: RightsType.MASTER }),
      makeSplit({ holderId: 'h1', percentage: 50, rightsType: RightsType.MASTER }),
    ]
    const result = validateSplits(splits)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('Duplicate'))).toBe(true)
  })

  it('should reject empty splits', () => {
    const result = validateSplits([])
    expect(result.valid).toBe(false)
  })

  it('should reject non-positive percentages', () => {
    const splits = [makeSplit({ percentage: -10 })]
    const result = validateSplits(splits)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('non-positive'))).toBe(true)
  })

  it('should reject percentages over 100', () => {
    const splits = [makeSplit({ percentage: 110 })]
    const result = validateSplits(splits)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('exceeds 100%'))).toBe(true)
  })
})

// ── Agreements: Lifecycle ────────────────────────────────────────────────────

describe('agreement lifecycle', () => {
  it('isFullySigned returns true when all signatories signed', () => {
    const agreement = makeAgreement({
      signatories: [
        { holderId: 'h1', signedAt: new Date(), status: 'signed' },
        { holderId: 'h2', signedAt: new Date(), status: 'signed' },
      ],
    })
    expect(isFullySigned(agreement)).toBe(true)
  })

  it('isFullySigned returns false when any signatory is pending', () => {
    const agreement = makeAgreement({
      signatories: [
        { holderId: 'h1', signedAt: new Date(), status: 'signed' },
        { holderId: 'h2', signedAt: null, status: 'pending' },
      ],
    })
    expect(isFullySigned(agreement)).toBe(false)
  })

  it('isFullySigned returns false with no signatories', () => {
    const agreement = makeAgreement({ signatories: [] })
    expect(isFullySigned(agreement)).toBe(false)
  })

  it('canAmend allows draft and active agreements', () => {
    expect(canAmend(makeAgreement({ status: AgreementStatus.DRAFT }))).toBe(true)
    expect(canAmend(makeAgreement({ status: AgreementStatus.ACTIVE }))).toBe(true)
  })

  it('canAmend rejects terminated agreements', () => {
    expect(canAmend(makeAgreement({ status: AgreementStatus.TERMINATED }))).toBe(false)
  })

  it('canSign allows draft and pending_signatures', () => {
    expect(canSign(makeAgreement({ status: AgreementStatus.DRAFT }))).toBe(true)
    expect(canSign(makeAgreement({ status: AgreementStatus.PENDING_SIGNATURES }))).toBe(true)
  })

  it('canSign rejects active agreements', () => {
    expect(canSign(makeAgreement({ status: AgreementStatus.ACTIVE }))).toBe(false)
  })
})

// ── Agreements: recordSignature ──────────────────────────────────────────────

describe('recordSignature', () => {
  it('records a signed signature', () => {
    const signatories: Signatory[] = [
      { holderId: 'h1', signedAt: null, status: 'pending' },
      { holderId: 'h2', signedAt: null, status: 'pending' },
    ]
    const result = recordSignature(signatories, 'h1', 'signed')
    expect(result[0]!.status).toBe('signed')
    expect(result[0]!.signedAt).toBeInstanceOf(Date)
    expect(result[1]!.status).toBe('pending')
  })

  it('records a rejection with reason', () => {
    const signatories: Signatory[] = [
      { holderId: 'h1', signedAt: null, status: 'pending' },
    ]
    const result = recordSignature(signatories, 'h1', 'rejected', 'Not my work')
    expect(result[0]!.status).toBe('rejected')
    expect(result[0]!.rejectionReason).toBe('Not my work')
  })

  it('does not overwrite already-signed status', () => {
    const signatories: Signatory[] = [
      { holderId: 'h1', signedAt: new Date(), status: 'signed' },
    ]
    const result = recordSignature(signatories, 'h1', 'rejected')
    expect(result[0]!.status).toBe('signed')
  })
})

// ── Disputes: canFileDispute ─────────────────────────────────────────────────

describe('canFileDispute', () => {
  it('allows filing against active agreement with no open disputes', () => {
    const agreement = makeAgreement({ status: AgreementStatus.ACTIVE })
    const result = canFileDispute(agreement, [])
    expect(result.allowed).toBe(true)
  })

  it('rejects filing against draft agreement', () => {
    const agreement = makeAgreement({ status: AgreementStatus.DRAFT })
    const result = canFileDispute(agreement, [])
    expect(result.allowed).toBe(false)
    expect(result.error).toContain('draft')
  })

  it('rejects filing when open dispute exists', () => {
    const agreement = makeAgreement()
    const existing = [makeDispute({ assetId: 'track-1', status: DisputeStatus.UNDER_REVIEW })]
    const result = canFileDispute(agreement, existing)
    expect(result.allowed).toBe(false)
    expect(result.error).toContain('open dispute')
  })

  it('allows filing when existing disputes are resolved', () => {
    const agreement = makeAgreement()
    const existing = [makeDispute({ assetId: 'track-1', status: DisputeStatus.RESOLVED })]
    const result = canFileDispute(agreement, existing)
    expect(result.allowed).toBe(true)
  })
})

// ── Disputes: Transitions ────────────────────────────────────────────────────

describe('dispute transitions', () => {
  it('allows filed → under_review', () => {
    const result = canTransitionDispute(DisputeStatus.FILED, DisputeStatus.UNDER_REVIEW)
    expect(result.allowed).toBe(true)
  })

  it('rejects filed → mediation', () => {
    const result = canTransitionDispute(DisputeStatus.FILED, DisputeStatus.MEDIATION)
    expect(result.allowed).toBe(false)
  })

  it('allows mediation → resolved', () => {
    const result = canTransitionDispute(DisputeStatus.MEDIATION, DisputeStatus.RESOLVED)
    expect(result.allowed).toBe(true)
  })

  it('resolved has no outgoing transitions', () => {
    const available = getAvailableDisputeTransitions(DisputeStatus.RESOLVED)
    expect(available).toHaveLength(0)
  })

  it('under_review has multiple options', () => {
    const available = getAvailableDisputeTransitions(DisputeStatus.UNDER_REVIEW)
    expect(available.length).toBeGreaterThanOrEqual(3)
  })
})

// ── Disputes: Payout Freeze ──────────────────────────────────────────────────

describe('payout freeze', () => {
  it('freezes payouts when active dispute with payoutsFrozen', () => {
    const disputes = [makeDispute({ assetId: 'track-1', payoutsFrozen: true, status: DisputeStatus.FILED })]
    expect(shouldFreezePayouts('track-1', disputes)).toBe(true)
  })

  it('does not freeze if dispute is resolved', () => {
    const disputes = [makeDispute({ assetId: 'track-1', payoutsFrozen: true, status: DisputeStatus.RESOLVED })]
    expect(shouldFreezePayouts('track-1', disputes)).toBe(false)
  })

  it('does not freeze if payoutsFrozen is false', () => {
    const disputes = [makeDispute({ assetId: 'track-1', payoutsFrozen: false, status: DisputeStatus.FILED })]
    expect(shouldFreezePayouts('track-1', disputes)).toBe(false)
  })

  it('getFrozenAssets returns unique asset IDs', () => {
    const disputes = [
      makeDispute({ id: 'd1', assetId: 'track-1', payoutsFrozen: true, status: DisputeStatus.FILED }),
      makeDispute({ id: 'd2', assetId: 'track-2', payoutsFrozen: true, status: DisputeStatus.MEDIATION }),
      makeDispute({ id: 'd3', assetId: 'track-1', payoutsFrozen: true, status: DisputeStatus.RESOLVED }),
    ]
    const frozen = getFrozenAssets(disputes)
    expect(frozen).toContain('track-1')
    expect(frozen).toContain('track-2')
    expect(frozen).toHaveLength(2)
  })
})

// ── Royalties: Payout Readiness ──────────────────────────────────────────────

describe('checkPayoutReadiness', () => {
  it('ready when accrued meets minimum', () => {
    const accruals = [
      makeAccrual({ holderId: 'holder-1', netAmount: 12 }),
    ]
    const result = checkPayoutReadiness('holder-1', accruals, 10)
    expect(result.ready).toBe(true)
    expect(result.shortfall).toBe(0)
  })

  it('not ready when below minimum', () => {
    const accruals = [
      makeAccrual({ holderId: 'holder-1', netAmount: 7 }),
    ]
    const result = checkPayoutReadiness('holder-1', accruals, 10)
    expect(result.ready).toBe(false)
    expect(result.shortfall).toBe(3)
  })

  it('ignores accruals not in approved status', () => {
    const accruals = [
      makeAccrual({ holderId: 'holder-1', netAmount: 20, status: 'pending' }),
    ]
    const result = checkPayoutReadiness('holder-1', accruals, 10)
    expect(result.ready).toBe(false)
    expect(result.totalAccrued).toBe(0)
  })
})

// ── Royalties: summarizeRoyalties ────────────────────────────────────────────

describe('summarizeRoyalties', () => {
  it('aggregates accruals by trigger', () => {
    const accruals = [
      makeAccrual({ assetId: 'track-1', trigger: RoyaltyTrigger.STREAM, units: 1000, grossAmount: 3, netAmount: 2.1 }),
      makeAccrual({ id: 'acr-2', assetId: 'track-1', trigger: RoyaltyTrigger.DOWNLOAD, units: 50, grossAmount: 25, netAmount: 17.5 }),
      makeAccrual({ id: 'acr-3', assetId: 'track-1', trigger: RoyaltyTrigger.STREAM, units: 500, grossAmount: 1.5, netAmount: 1.05 }),
    ]
    const summary = summarizeRoyalties('track-1', accruals)
    expect(summary.totalUnits).toBe(1550)
    expect(summary.byTrigger['stream']!.units).toBe(1500)
    expect(summary.byTrigger['download']!.units).toBe(50)
  })

  it('returns empty summary for unknown asset', () => {
    const summary = summarizeRoyalties('unknown', [])
    expect(summary.totalUnits).toBe(0)
    expect(summary.totalGross).toBe(0)
  })
})
