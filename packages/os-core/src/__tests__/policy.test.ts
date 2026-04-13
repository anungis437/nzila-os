/**
 * @nzila/os-core — Policy engine tests
 */
import { describe, it, expect } from 'vitest'
import { evaluateGovernanceRequirements } from '../policy'

describe('evaluateGovernanceRequirements', () => {
  // ── issue_shares ──────────────────────────────────────────────────────

  describe('issue_shares', () => {
    it('requires board approval', () => {
      const result = evaluateGovernanceRequirements('issue_shares')
      expect(result.allowed).toBe(true)
      expect(result.requirements.some((r) => r.kind === 'board_approval')).toBe(true)
    })

    it('adds shareholder approval when dilution exceeds threshold', () => {
      const result = evaluateGovernanceRequirements('issue_shares', {
        totalSharesOutstanding: 100,
        quantity: 200, // 200/(100+200) = 66% dilution
      })
      expect(result.requirements.some((r) => r.kind === 'shareholder_approval')).toBe(true)
    })

    it('no shareholder approval when dilution is below threshold', () => {
      const result = evaluateGovernanceRequirements('issue_shares', {
        totalSharesOutstanding: 1000,
        quantity: 1, // negligible dilution
      })
      expect(result.requirements.some((r) => r.kind === 'shareholder_approval')).toBe(false)
    })

    it('includes share register notice', () => {
      const result = evaluateGovernanceRequirements('issue_shares')
      expect(result.notices).toContain('Update share register and cap table after issuance.')
    })
  })

  // ── transfer_shares ────────────────────────────────────────────────────

  describe('transfer_shares', () => {
    it('requires board approval for restricted shares', () => {
      const result = evaluateGovernanceRequirements('transfer_shares', {
        transferRestricted: true,
      })
      expect(result.requirements.some((r) => r.kind === 'board_approval')).toBe(true)
    })

    it('requires board approval for large block transfers', () => {
      const result = evaluateGovernanceRequirements('transfer_shares', {
        totalSharesOutstanding: 100,
        quantity: 30, // 30% block
      })
      expect(result.requirements.some((r) => r.kind === 'board_approval')).toBe(true)
    })

    it('handles ROFR notice requirement', () => {
      const result = evaluateGovernanceRequirements('transfer_shares', {
        rofrApplies: true,
      })
      expect(result.requirements.some((r) => r.kind === 'notice')).toBe(true)
    })

    it('no requirements for unrestricted small transfer', () => {
      const result = evaluateGovernanceRequirements('transfer_shares', {
        transferRestricted: false,
        totalSharesOutstanding: 1000,
        quantity: 1,
        rofrApplies: false,
      })
      expect(result.requirements).toHaveLength(0)
    })
  })

  // ── convert_shares ─────────────────────────────────────────────────────

  describe('convert_shares', () => {
    it('requires board approval', () => {
      const result = evaluateGovernanceRequirements('convert_shares')
      expect(result.requirements.some((r) => r.kind === 'board_approval')).toBe(true)
      expect(result.notices).toContain('Update ledger with conversion entries.')
    })
  })

  // ── borrow_funds ───────────────────────────────────────────────────────

  describe('borrow_funds', () => {
    it('requires board approval above borrowing threshold', () => {
      const result = evaluateGovernanceRequirements('borrow_funds', {
        amount: 1_000_000,
      })
      expect(result.requirements.some((r) => r.kind === 'board_approval')).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('no requirements below borrowing threshold', () => {
      const result = evaluateGovernanceRequirements('borrow_funds', {
        amount: 1, // well below default threshold
      })
      expect(result.requirements).toHaveLength(0)
    })
  })

  // ── amend_rights ───────────────────────────────────────────────────────

  describe('amend_rights', () => {
    it('requires special resolution and filing', () => {
      const result = evaluateGovernanceRequirements('amend_rights')
      expect(result.requirements.some((r) => r.kind === 'special_resolution')).toBe(true)
      expect(result.requirements.some((r) => r.kind === 'filing')).toBe(true)
    })
  })

  // ── create_class ───────────────────────────────────────────────────────

  describe('create_class', () => {
    it('requires special resolution and filing', () => {
      const result = evaluateGovernanceRequirements('create_class')
      expect(result.requirements.some((r) => r.kind === 'special_resolution')).toBe(true)
      expect(result.requirements.some((r) => r.kind === 'filing')).toBe(true)
    })
  })

  // ── repurchase_shares ──────────────────────────────────────────────────

  describe('repurchase_shares', () => {
    it('requires board approval', () => {
      const result = evaluateGovernanceRequirements('repurchase_shares')
      expect(result.requirements.some((r) => r.kind === 'board_approval')).toBe(true)
    })

    it('includes solvency warning', () => {
      const result = evaluateGovernanceRequirements('repurchase_shares')
      expect(result.warnings.some((w) => w.includes('solvency'))).toBe(true)
    })
  })

  // ── dividend ───────────────────────────────────────────────────────────

  describe('dividend', () => {
    it('requires board approval', () => {
      const result = evaluateGovernanceRequirements('dividend')
      expect(result.requirements.some((r) => r.kind === 'board_approval')).toBe(true)
    })

    it('includes solvency warning', () => {
      const result = evaluateGovernanceRequirements('dividend')
      expect(result.warnings.some((w) => w.includes('Solvency'))).toBe(true)
    })
  })

  // ── merger_acquisition ─────────────────────────────────────────────────

  describe('merger_acquisition', () => {
    it('requires special resolution and board approval', () => {
      const result = evaluateGovernanceRequirements('merger_acquisition')
      expect(result.requirements.some((r) => r.kind === 'special_resolution')).toBe(true)
      expect(result.requirements.some((r) => r.kind === 'board_approval')).toBe(true)
    })

    it('includes valuation warning', () => {
      const result = evaluateGovernanceRequirements('merger_acquisition')
      expect(result.warnings.some((w) => w.includes('valuation'))).toBe(true)
    })
  })

  // ── elect_directors ────────────────────────────────────────────────────

  describe('elect_directors', () => {
    it('requires shareholder approval and filing', () => {
      const result = evaluateGovernanceRequirements('elect_directors')
      expect(result.requirements.some((r) => r.kind === 'shareholder_approval')).toBe(true)
      expect(result.requirements.some((r) => r.kind === 'filing')).toBe(true)
    })
  })

  // ── amend_constitution ─────────────────────────────────────────────────

  describe('amend_constitution', () => {
    it('requires special resolution and filing', () => {
      const result = evaluateGovernanceRequirements('amend_constitution')
      expect(result.requirements.some((r) => r.kind === 'special_resolution')).toBe(true)
      expect(result.requirements.some((r) => r.kind === 'filing')).toBe(true)
    })
  })

  // ── General ────────────────────────────────────────────────────────────

  describe('general', () => {
    it('all evaluations have allowed=true (no blockers in base config)', () => {
      const actions = [
        'issue_shares', 'transfer_shares', 'convert_shares', 'borrow_funds',
        'amend_rights', 'create_class', 'repurchase_shares', 'dividend',
        'merger_acquisition', 'elect_directors', 'amend_constitution',
      ] as const

      for (const action of actions) {
        const result = evaluateGovernanceRequirements(action)
        expect(result.allowed).toBe(true)
        expect(result.action).toBe(action)
        expect(result.blockers).toEqual([])
      }
    })

    it('accepts custom policy config overrides', () => {
      const result = evaluateGovernanceRequirements(
        'issue_shares',
        { totalSharesOutstanding: 100, quantity: 10 }, // 9% dilution
        { issuanceDilutionThreshold: 0.05 }, // 5% threshold → should trigger
      )
      expect(result.requirements.some((r) => r.kind === 'shareholder_approval')).toBe(true)
    })
  })
})
