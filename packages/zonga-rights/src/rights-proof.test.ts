/**
 * Zonga — Rights & Royalty Operational Proof Suite
 *
 * RGT-1: Per-rights-type splits sum to 100%
 * RGT-2: Agreement lifecycle FSM enforced
 * RGT-3: Signature tracking enforced
 * RGT-4: Royalty computation determinism
 * RGT-5: Dispute payout freeze integrity
 * RGT-6: Dispute FSM transitions
 */
import { describe, it, expect } from 'vitest'
import {
  validateSplits,
  isFullySigned,
  canAmend,
  canSign,
  recordSignature,
  computeAgreementStatus,
  buildVersionHistoryEntry,
} from './agreements'
import {
  calculateRoyalties,
  checkPayoutReadiness,
  summarizeRoyalties,
} from './royalties'
import {
  canFileDispute,
  canTransitionDispute,
  getAvailableDisputeTransitions,
  shouldFreezePayouts,
  getFrozenAssets,
} from './disputes'
import {
  RightsType,
  ContributorRole,
  AgreementStatus,
  DisputeStatus,
  DisputeType,
  RoyaltyTrigger,
} from './types'
import type {
  SplitEntry,
  SplitAgreement,
  Signatory,
  RoyaltyRule,
  RoyaltyAccrual,
  RightsDispute,
} from './types'

// ── Helpers ──────────────────────────────────────────────────────────

let _id = 0
function nextId(prefix = 'id'): string { return `${prefix}_${++_id}` }

function makeSplitEntry(overrides: Partial<SplitEntry> = {}): SplitEntry {
  return {
    holderId: nextId('holder'),
    holderName: 'Artist',
    role: ContributorRole.PRIMARY_ARTIST,
    percentage: 50,
    rightsType: RightsType.MASTER,
    ...overrides,
  }
}

function makeSignatory(overrides: Partial<Signatory> = {}): Signatory {
  return {
    holderId: nextId('signer'),
    signedAt: null,
    status: 'pending',
    ...overrides,
  }
}

function makeAgreement(overrides: Partial<SplitAgreement> = {}): SplitAgreement {
  const now = new Date('2025-06-01')
  return {
    id: nextId('agreement'),
    assetId: nextId('asset'),
    assetType: 'track',
    title: 'Test Agreement',
    status: AgreementStatus.ACTIVE,
    splits: [
      makeSplitEntry({ holderId: 'h1', holderName: 'Artist A', percentage: 60 }),
      makeSplitEntry({ holderId: 'h2', holderName: 'Producer B', percentage: 40, role: ContributorRole.PRODUCER }),
    ],
    signatories: [],
    effectiveFrom: now,
    effectiveUntil: null,
    version: 1,
    previousVersionId: null,
    notes: '',
    createdBy: 'admin',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeDispute(overrides: Partial<RightsDispute> = {}): RightsDispute {
  return {
    id: nextId('dispute'),
    assetId: 'asset-1',
    type: DisputeType.OWNERSHIP,
    status: DisputeStatus.FILED,
    complainantId: 'user-1',
    respondentId: 'user-2',
    description: 'Ownership dispute',
    evidenceIds: [],
    resolution: null,
    payoutsFrozen: true,
    filedAt: new Date('2025-06-01'),
    resolvedAt: null,
    ...overrides,
  }
}

function makeRoyaltyRule(overrides: Partial<RoyaltyRule> = {}): RoyaltyRule {
  return {
    id: nextId('rule'),
    assetId: 'asset-1',
    trigger: RoyaltyTrigger.STREAM,
    ratePerUnit: 0.003,
    currency: 'USD',
    minimumPayout: 10,
    isActive: true,
    ...overrides,
  }
}

function makeRoyaltyAccrual(overrides: Partial<RoyaltyAccrual> = {}): RoyaltyAccrual {
  return {
    id: nextId('accrual'),
    assetId: 'asset-1',
    holderId: 'holder-1',
    trigger: RoyaltyTrigger.STREAM,
    units: 10000,
    ratePerUnit: 0.003,
    grossAmount: 30,
    netAmount: 25.5,
    periodStart: new Date('2025-01-01'),
    periodEnd: new Date('2025-01-31'),
    status: 'approved',
    ...overrides,
  }
}

// ── RGT-1: Per-Rights-Type Splits Sum to 100% ─────────────────────────

describe('RGT-1: Per-rights-type splits sum to 100%', () => {
  it('valid: master rights split to 100%', () => {
    const splits = [
      makeSplitEntry({ holderId: 'a', percentage: 60, rightsType: RightsType.MASTER }),
      makeSplitEntry({ holderId: 'b', percentage: 40, rightsType: RightsType.MASTER }),
    ]
    expect(validateSplits(splits).valid).toBe(true)
  })

  it('valid: multiple rights types each sum to 100%', () => {
    const splits = [
      makeSplitEntry({ holderId: 'a', percentage: 70, rightsType: RightsType.MASTER }),
      makeSplitEntry({ holderId: 'b', percentage: 30, rightsType: RightsType.MASTER }),
      makeSplitEntry({ holderId: 'c', percentage: 50, rightsType: RightsType.PUBLISHING }),
      makeSplitEntry({ holderId: 'd', percentage: 50, rightsType: RightsType.PUBLISHING }),
    ]
    expect(validateSplits(splits).valid).toBe(true)
  })

  it('rejects master splits not summing to 100%', () => {
    const splits = [
      makeSplitEntry({ holderId: 'a', percentage: 60, rightsType: RightsType.MASTER }),
      makeSplitEntry({ holderId: 'b', percentage: 30, rightsType: RightsType.MASTER }),
    ]
    const result = validateSplits(splits)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e: string) => e.includes('90%'))).toBe(true)
  })

  it('rejects when one rights type valid but another invalid', () => {
    const splits = [
      makeSplitEntry({ holderId: 'a', percentage: 100, rightsType: RightsType.MASTER }),
      makeSplitEntry({ holderId: 'c', percentage: 60, rightsType: RightsType.PUBLISHING }),
    ]
    const result = validateSplits(splits)
    expect(result.valid).toBe(false)
  })

  it('rejects negative percentages', () => {
    const splits = [
      makeSplitEntry({ holderId: 'a', percentage: -10, rightsType: RightsType.MASTER }),
      makeSplitEntry({ holderId: 'b', percentage: 110, rightsType: RightsType.MASTER }),
    ]
    const result = validateSplits(splits)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e: string) => e.includes('non-positive'))).toBe(true)
  })

  it('rejects duplicate holders within same rights type', () => {
    const splits = [
      makeSplitEntry({ holderId: 'a', percentage: 50, rightsType: RightsType.MASTER }),
      makeSplitEntry({ holderId: 'a', percentage: 50, rightsType: RightsType.MASTER }),
    ]
    const result = validateSplits(splits)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e: string) => e.includes('Duplicate'))).toBe(true)
  })

  it('rejects empty splits', () => {
    expect(validateSplits([]).valid).toBe(false)
  })

  it('property: 50 random split configurations per rights type validate correctly', () => {
    for (let seed = 0; seed < 50; seed++) {
      const count = (seed % 4) + 2
      // Generate percentages that sum to 100
      let remaining = 100
      const pcts: number[] = []
      for (let i = 0; i < count - 1; i++) {
        const max = remaining - (count - i - 1)
        const pct = Math.max(1, Math.floor(Math.random() * max))
        pcts.push(pct)
        remaining -= pct
      }
      pcts.push(remaining)

      const splits = pcts.map((p, i) =>
        makeSplitEntry({ holderId: `h${i}`, percentage: p, rightsType: RightsType.MASTER }),
      )
      const result = validateSplits(splits)
      expect(result.valid).toBe(true)
    }
  })
})

// ── RGT-2: Agreement Lifecycle FSM ────────────────────────────────────

describe('RGT-2: Agreement lifecycle FSM enforced', () => {
  it('allows amending ACTIVE agreement', () => {
    const agreement = makeAgreement({ status: AgreementStatus.ACTIVE })
    expect(canAmend(agreement)).toBe(true)
  })

  it('allows amending DRAFT agreement', () => {
    const agreement = makeAgreement({ status: AgreementStatus.DRAFT })
    expect(canAmend(agreement)).toBe(true)
  })

  it('blocks amending TERMINATED agreement', () => {
    const agreement = makeAgreement({ status: AgreementStatus.TERMINATED })
    expect(canAmend(agreement)).toBe(false)
  })

  it('blocks amending EXPIRED agreement', () => {
    const agreement = makeAgreement({ status: AgreementStatus.EXPIRED })
    expect(canAmend(agreement)).toBe(false)
  })

  it('allows signing PENDING_SIGNATURES agreement', () => {
    const agreement = makeAgreement({ status: AgreementStatus.PENDING_SIGNATURES })
    expect(canSign(agreement)).toBe(true)
  })

  it('allows signing DRAFT agreement', () => {
    const agreement = makeAgreement({ status: AgreementStatus.DRAFT })
    expect(canSign(agreement)).toBe(true)
  })

  it('blocks signing ACTIVE agreement', () => {
    const agreement = makeAgreement({ status: AgreementStatus.ACTIVE })
    expect(canSign(agreement)).toBe(false)
  })

  it('version history captures amendment correctly', () => {
    const prevSplits = [makeSplitEntry({ holderId: 'h1', percentage: 100 })]
    const newSplits = [
      makeSplitEntry({ holderId: 'h1', percentage: 60 }),
      makeSplitEntry({ holderId: 'h2', percentage: 40 }),
    ]
    const entry = buildVersionHistoryEntry('asset-1', 'agr-1', 1, 'admin', prevSplits, newSplits, 'Producer added')
    expect(entry.version).toBe(2)
    expect(entry.changeType).toBe('amended')
    expect(entry.previousSplits).toEqual(prevSplits)
    expect(entry.newSplits).toEqual(newSplits)
  })
})

// ── RGT-3: Signature Tracking ─────────────────────────────────────────

describe('RGT-3: Signature tracking enforced', () => {
  it('empty signatories = not fully signed', () => {
    const agreement = makeAgreement({ signatories: [] })
    expect(isFullySigned(agreement)).toBe(false)
  })

  it('all signed = fully signed', () => {
    const agreement = makeAgreement({
      signatories: [
        makeSignatory({ holderId: 'h1', status: 'signed', signedAt: new Date() }),
        makeSignatory({ holderId: 'h2', status: 'signed', signedAt: new Date() }),
      ],
    })
    expect(isFullySigned(agreement)).toBe(true)
  })

  it('one pending = not fully signed', () => {
    const agreement = makeAgreement({
      signatories: [
        makeSignatory({ holderId: 'h1', status: 'signed', signedAt: new Date() }),
        makeSignatory({ holderId: 'h2', status: 'pending' }),
      ],
    })
    expect(isFullySigned(agreement)).toBe(false)
  })

  it('recordSignature sets signed status', () => {
    const signatories = [
      makeSignatory({ holderId: 'h1' }),
      makeSignatory({ holderId: 'h2' }),
    ]
    const updated = recordSignature(signatories, 'h1', 'signed')
    expect(updated.find((s) => s.holderId === 'h1')!.status).toBe('signed')
    expect(updated.find((s) => s.holderId === 'h2')!.status).toBe('pending')
  })

  it('recordSignature sets rejected status', () => {
    const signatories = [makeSignatory({ holderId: 'h1' })]
    const updated = recordSignature(signatories, 'h1', 'rejected', 'Disagree')
    expect(updated[0]!.status).toBe('rejected')
    expect(updated[0]!.rejectionReason).toBe('Disagree')
  })

  it('computeAgreementStatus: all signed → ACTIVE', () => {
    const signatories = [
      makeSignatory({ holderId: 'h1', status: 'signed', signedAt: new Date() }),
      makeSignatory({ holderId: 'h2', status: 'signed', signedAt: new Date() }),
    ]
    expect(computeAgreementStatus(signatories)).toBe(AgreementStatus.ACTIVE)
  })

  it('computeAgreementStatus: any rejection → TERMINATED', () => {
    const signatories = [
      makeSignatory({ holderId: 'h1', status: 'signed', signedAt: new Date() }),
      makeSignatory({ holderId: 'h2', status: 'rejected' }),
    ]
    expect(computeAgreementStatus(signatories)).toBe(AgreementStatus.TERMINATED)
  })

  it('computeAgreementStatus: mix of pending → PENDING_SIGNATURES', () => {
    const signatories = [
      makeSignatory({ holderId: 'h1', status: 'signed', signedAt: new Date() }),
      makeSignatory({ holderId: 'h2', status: 'pending' }),
    ]
    expect(computeAgreementStatus(signatories)).toBe(AgreementStatus.PENDING_SIGNATURES)
  })

  it('already-signed signatory cannot re-sign', () => {
    const signatories = [makeSignatory({ holderId: 'h1', status: 'signed', signedAt: new Date() })]
    const updated = recordSignature(signatories, 'h1', 'rejected')
    // Should remain signed (already acted)
    expect(updated[0]!.status).toBe('signed')
  })
})

// ── RGT-4: Royalty Computation Determinism ────────────────────────────

describe('RGT-4: Royalty computation determinism', () => {
  it('1 000 streams at $0.003 = $3.00 gross', () => {
    const rule = makeRoyaltyRule({ ratePerUnit: 0.003 })
    const splits = [
      makeSplitEntry({ holderId: 'a', holderName: 'Artist', percentage: 60 }),
      makeSplitEntry({ holderId: 'b', holderName: 'Producer', percentage: 40 }),
    ]
    const result = calculateRoyalties(rule, 1000, splits)
    expect(result.grossAmount).toBe(3)
    expect(result.units).toBe(1000)
  })

  it('zero units produce zero royalties', () => {
    const rule = makeRoyaltyRule()
    const splits = [makeSplitEntry({ holderId: 'a', percentage: 100 })]
    const result = calculateRoyalties(rule, 0, splits)
    expect(result.grossAmount).toBe(0)
    expect(result.netAmount).toBe(0)
    expect(result.accruals).toHaveLength(0)
  })

  it('negative units produce zero royalties', () => {
    const rule = makeRoyaltyRule()
    const splits = [makeSplitEntry({ holderId: 'a', percentage: 100 })]
    const result = calculateRoyalties(rule, -100, splits)
    expect(result.grossAmount).toBe(0)
  })

  it('accruals sum <= gross (fees deducted)', () => {
    const rule = makeRoyaltyRule()
    const splits = [
      makeSplitEntry({ holderId: 'a', holderName: 'A', percentage: 60 }),
      makeSplitEntry({ holderId: 'b', holderName: 'B', percentage: 40 }),
    ]
    const result = calculateRoyalties(rule, 100000, splits)
    const accrualSum = result.accruals.reduce((s, a) => s + a.netAmount, 0)
    expect(accrualSum).toBeLessThanOrEqual(result.grossAmount)
    expect(result.netAmount).toBeLessThanOrEqual(result.grossAmount)
  })

  it('deterministic: same input produces identical output 100 times', () => {
    const rule = makeRoyaltyRule()
    const splits = [
      makeSplitEntry({ holderId: 'a', holderName: 'Artist', percentage: 55 }),
      makeSplitEntry({ holderId: 'b', holderName: 'Producer', percentage: 45 }),
    ]
    const results = Array.from({ length: 100 }, () => calculateRoyalties(rule, 50000, splits))
    const first = results[0]!
    expect(results.every((r) =>
      r.grossAmount === first.grossAmount
      && r.netAmount === first.netAmount
      && r.accruals.length === first.accruals.length,
    )).toBe(true)
  })

  it('checkPayoutReadiness: above threshold ⟹ ready', () => {
    const accruals = [
      makeRoyaltyAccrual({ holderId: 'h1', netAmount: 12, status: 'approved' }),
    ]
    const readiness = checkPayoutReadiness('h1', accruals, 10)
    expect(readiness.ready).toBe(true)
    expect(readiness.shortfall).toBe(0)
  })

  it('checkPayoutReadiness: below threshold ⟹ not ready', () => {
    const accruals = [
      makeRoyaltyAccrual({ holderId: 'h1', netAmount: 5, status: 'approved' }),
    ]
    const readiness = checkPayoutReadiness('h1', accruals, 10)
    expect(readiness.ready).toBe(false)
    expect(readiness.shortfall).toBe(5)
  })

  it('checkPayoutReadiness: non-approved accruals not counted', () => {
    const accruals = [
      makeRoyaltyAccrual({ holderId: 'h1', netAmount: 20, status: 'pending' }),
    ]
    const readiness = checkPayoutReadiness('h1', accruals, 10)
    expect(readiness.ready).toBe(false)
  })

  it('summarizeRoyalties aggregates by trigger', () => {
    const accruals = [
      makeRoyaltyAccrual({ assetId: 'a1', trigger: RoyaltyTrigger.STREAM, units: 1000, grossAmount: 3, netAmount: 2.5 }),
      makeRoyaltyAccrual({ assetId: 'a1', trigger: RoyaltyTrigger.STREAM, units: 2000, grossAmount: 6, netAmount: 5 }),
      makeRoyaltyAccrual({ assetId: 'a1', trigger: RoyaltyTrigger.DOWNLOAD, units: 50, grossAmount: 50, netAmount: 44 }),
    ]
    const summary = summarizeRoyalties('a1', accruals)
    expect(summary.totalUnits).toBe(3050)
    expect(summary.byTrigger[RoyaltyTrigger.STREAM]!.units).toBe(3000)
    expect(summary.byTrigger[RoyaltyTrigger.DOWNLOAD]!.units).toBe(50)
  })
})

// ── RGT-5: Dispute Payout Freeze ──────────────────────────────────────

describe('RGT-5: Dispute payout freeze integrity', () => {
  it('open dispute with payoutsFrozen freezes asset', () => {
    const disputes = [makeDispute({ assetId: 'asset-1', payoutsFrozen: true })]
    expect(shouldFreezePayouts('asset-1', disputes)).toBe(true)
  })

  it('resolved dispute does not freeze asset', () => {
    const disputes = [makeDispute({ assetId: 'asset-1', status: DisputeStatus.RESOLVED })]
    expect(shouldFreezePayouts('asset-1', disputes)).toBe(false)
  })

  it('dismissed dispute does not freeze asset', () => {
    const disputes = [makeDispute({ assetId: 'asset-1', status: DisputeStatus.DISMISSED })]
    expect(shouldFreezePayouts('asset-1', disputes)).toBe(false)
  })

  it('no disputes = no freeze', () => {
    expect(shouldFreezePayouts('asset-1', [])).toBe(false)
  })

  it('getFrozenAssets returns all frozen asset IDs', () => {
    const disputes = [
      makeDispute({ assetId: 'asset-1', payoutsFrozen: true }),
      makeDispute({ assetId: 'asset-2', payoutsFrozen: true }),
      makeDispute({ assetId: 'asset-3', status: DisputeStatus.RESOLVED }),
    ]
    const frozen = getFrozenAssets(disputes)
    expect(frozen).toContain('asset-1')
    expect(frozen).toContain('asset-2')
    expect(frozen).not.toContain('asset-3')
  })

  it('different asset not frozen by dispute on another', () => {
    const disputes = [makeDispute({ assetId: 'asset-1' })]
    expect(shouldFreezePayouts('asset-2', disputes)).toBe(false)
  })
})

// ── RGT-6: Dispute FSM Transitions ───────────────────────────────────

describe('RGT-6: Dispute FSM transitions', () => {
  it('FILED → UNDER_REVIEW allowed', () => {
    expect(canTransitionDispute(DisputeStatus.FILED, DisputeStatus.UNDER_REVIEW).allowed).toBe(true)
  })

  it('FILED → DISMISSED allowed', () => {
    expect(canTransitionDispute(DisputeStatus.FILED, DisputeStatus.DISMISSED).allowed).toBe(true)
  })

  it('FILED → RESOLVED blocked', () => {
    expect(canTransitionDispute(DisputeStatus.FILED, DisputeStatus.RESOLVED).allowed).toBe(false)
  })

  it('UNDER_REVIEW → EVIDENCE_REQUESTED allowed', () => {
    expect(canTransitionDispute(DisputeStatus.UNDER_REVIEW, DisputeStatus.EVIDENCE_REQUESTED).allowed).toBe(true)
  })

  it('UNDER_REVIEW → MEDIATION allowed', () => {
    expect(canTransitionDispute(DisputeStatus.UNDER_REVIEW, DisputeStatus.MEDIATION).allowed).toBe(true)
  })

  it('MEDIATION → RESOLVED allowed', () => {
    expect(canTransitionDispute(DisputeStatus.MEDIATION, DisputeStatus.RESOLVED).allowed).toBe(true)
  })

  it('MEDIATION → ESCALATED allowed', () => {
    expect(canTransitionDispute(DisputeStatus.MEDIATION, DisputeStatus.ESCALATED).allowed).toBe(true)
  })

  it('RESOLVED → anything blocked (terminal)', () => {
    const transitions = getAvailableDisputeTransitions(DisputeStatus.RESOLVED)
    expect(transitions).toHaveLength(0)
  })

  it('DISMISSED → anything blocked (terminal)', () => {
    const transitions = getAvailableDisputeTransitions(DisputeStatus.DISMISSED)
    expect(transitions).toHaveLength(0)
  })

  it('cannot file dispute against draft agreement', () => {
    const agreement = makeAgreement({ status: AgreementStatus.DRAFT })
    const result = canFileDispute(agreement, [])
    expect(result.allowed).toBe(false)
    expect(result.error).toContain('draft')
  })

  it('cannot file duplicate dispute for same asset', () => {
    const agreement = makeAgreement({ assetId: 'asset-1', status: AgreementStatus.ACTIVE })
    const existing = [makeDispute({ assetId: 'asset-1', status: DisputeStatus.FILED })]
    const result = canFileDispute(agreement, existing)
    expect(result.allowed).toBe(false)
    expect(result.error).toContain('open dispute')
  })

  it('can file dispute when previous disputes resolved', () => {
    const agreement = makeAgreement({ assetId: 'asset-1', status: AgreementStatus.ACTIVE })
    const existing = [makeDispute({ assetId: 'asset-1', status: DisputeStatus.RESOLVED })]
    const result = canFileDispute(agreement, existing)
    expect(result.allowed).toBe(true)
  })

  it('full lifecycle: FILED → UNDER_REVIEW → MEDIATION → RESOLVED', () => {
    let status: DisputeStatus = DisputeStatus.FILED
    const steps: DisputeStatus[] = [DisputeStatus.UNDER_REVIEW, DisputeStatus.MEDIATION, DisputeStatus.RESOLVED]
    for (const next of steps) {
      const result = canTransitionDispute(status, next)
      expect(result.allowed).toBe(true)
      status = next
    }
    expect(status).toBe(DisputeStatus.RESOLVED)
    expect(getAvailableDisputeTransitions(status)).toHaveLength(0)
  })
})
