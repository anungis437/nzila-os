/**
 * Zonga — Action Hardening Tests
 *
 * Validates that all critical action files have the required
 * hardening: audit trails, payout freezes, atomic operations,
 * ledger backing, and governance checks.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const APP = resolve(__dirname, '../..')

describe('Action file hardening', () => {
  describe('payout-actions.ts', () => {
    it('routes through executeCommand (control bus)', () => {
      const content = readFileSync(resolve(APP, 'lib/actions/payout-actions.ts'), 'utf-8')
      expect(content).toContain('executeCommand')
      expect(content).toContain("type: 'execute_payout'")
    })
  })

  describe('event-actions.ts', () => {
    it('uses atomic INSERT...SELECT for ticket purchase', () => {
      const content = readFileSync(resolve(APP, 'lib/actions/event-actions.ts'), 'utf-8')
      expect(content).toContain('INSERT INTO zonga_ticket_purchases')
      expect(content).toContain('quantity_available')
    })

    it('checks event status before publishing', () => {
      const content = readFileSync(resolve(APP, 'lib/actions/event-actions.ts'), 'utf-8')
      expect(content).toContain("status = 'draft'")
    })
  })

  describe('rights-actions.ts', () => {
    it('freezes payouts on dispute filing', () => {
      const content = readFileSync(resolve(APP, 'lib/actions/rights-actions.ts'), 'utf-8')
      expect(content).toContain('rights.dispute.payout_freeze')
    })

    it('unfreezes payouts when disputes resolved', () => {
      const content = readFileSync(resolve(APP, 'lib/actions/rights-actions.ts'), 'utf-8')
      expect(content).toContain('rights.dispute.payout_unfreeze')
    })
  })

  describe('revenue-actions.ts', () => {
    it('writes ledger entry alongside revenue event', () => {
      const content = readFileSync(resolve(APP, 'lib/actions/revenue-actions.ts'), 'utf-8')
      expect(content).toContain('ledger.revenue.entry')
      expect(content).toContain('audit_log')
    })
  })

  describe('moderation-actions.ts', () => {
    it('has audit trail for case assignment', () => {
      const content = readFileSync(resolve(APP, 'lib/actions/moderation-actions.ts'), 'utf-8')
      expect(content).toContain('moderation.case.assigned')
      expect(content).toContain('audit_log')
    })
  })
})

describe('Guard modules completeness', () => {
  it('economic guards export all E1-E6 functions', () => {
    const content = readFileSync(resolve(APP, 'lib/guards/economic-guards.ts'), 'utf-8')
    expect(content).toContain('guardRevenueHasLedgerBacking')
    expect(content).toContain('guardPayoutWithinBalance')
    expect(content).toContain('guardLedgerBalanced')
    expect(content).toContain('guardNoNegativePayout')
    expect(content).toContain('guardTransactionReversible')
    expect(content).toContain('guardSettlementReconciled')
    expect(content).toContain('runEconomicGuards')
  })

  it('rights guards export all R1-R5 functions', () => {
    const content = readFileSync(resolve(APP, 'lib/guards/rights-guards.ts'), 'utf-8')
    expect(content).toContain('guardSplitsSum100')
    expect(content).toContain('guardNoPayoutOnDisputedRelease')
    expect(content).toContain('guardSplitsHaveValidCreators')
    expect(content).toContain('guardDisputeResolutionUnfreezes')
    expect(content).toContain('guardSyncLicenseHasRightsHolder')
  })

  it('ticketing guards export all T1-T6 functions', () => {
    const content = readFileSync(resolve(APP, 'lib/guards/ticketing-guards.ts'), 'utf-8')
    expect(content).toContain('guardNoOversell')
    expect(content).toContain('guardAtomicReservation')
    expect(content).toContain('guardRefundEligibility')
    expect(content).toContain('guardNoDuplicateScan')
    expect(content).toContain('guardEventNotCancelled')
    expect(content).toContain('guardTransferOwnership')
  })

  it('governance guards export all G1-G5 functions', () => {
    const content = readFileSync(resolve(APP, 'lib/guards/governance-guards.ts'), 'utf-8')
    expect(content).toContain('guardAdminActionReason')
    expect(content).toContain('guardRoleAuthorization')
    expect(content).toContain('guardRateLimit')
    expect(content).toContain('guardAuditCompleteness')
    expect(content).toContain('guardEnvironmentRestriction')
  })

  it('compensation module has all recovery functions', () => {
    const content = readFileSync(resolve(APP, 'lib/guards/compensation.ts'), 'utf-8')
    expect(content).toContain('compensateFailedPayout')
    expect(content).toContain('compensateFailedTicketPurchase')
    expect(content).toContain('compensateReleaseTransition')
  })

  it('guards barrel exports all modules', () => {
    const content = readFileSync(resolve(APP, 'lib/guards/index.ts'), 'utf-8')
    expect(content).toContain('./economic-guards')
    expect(content).toContain('./rights-guards')
    expect(content).toContain('./ticketing-guards')
    expect(content).toContain('./governance-guards')
    expect(content).toContain('./compensation')
  })
})
