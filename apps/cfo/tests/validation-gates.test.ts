/**
 * CFO — Financial Validation Gates Tests
 */
import { describe, it, expect } from 'vitest'
import {
  runValidationGates,
  validateRequiredInputs,
  validateEntrySchemas,
  validateTimeRange,
  validateNoDuplicates,
  validateAmounts,
  FinancialValidationError,
} from '@nzila/cfo-core/validation'

describe('Financial Validation Gates', () => {
  const validEntries = [
    { account: 'Sales', amount: 50000, type: 'credit' as const, date: '2026-01-15' },
    { account: 'Rent', amount: 5000, type: 'debit' as const, date: '2026-02-01' },
  ]

  const validParams = {
    orgId: 'org-1',
    reportId: 'rpt-1',
    period: { start: '2026-01-01', end: '2026-03-31' },
    entries: validEntries,
  }

  describe('validateRequiredInputs', () => {
    it('passes with all required fields', () => {
      const result = validateRequiredInputs(validParams)
      expect(result.valid).toBe(true)
      expect(result.failures).toEqual([])
    })

    it('fails when orgId is missing', () => {
      const result = validateRequiredInputs({ ...validParams, orgId: '' })
      expect(result.valid).toBe(false)
      expect(result.failures.length).toBeGreaterThan(0)
    })

    it('fails when reportId is missing', () => {
      const result = validateRequiredInputs({ ...validParams, reportId: '' })
      expect(result.valid).toBe(false)
      expect(result.failures.length).toBeGreaterThan(0)
    })
  })

  describe('validateEntrySchemas', () => {
    it('passes for well-formed entries', () => {
      const result = validateEntrySchemas(validEntries)
      expect(result.valid).toBe(true)
    })

    it('fails for entry missing account', () => {
      const result = validateEntrySchemas([
        { account: '', amount: 100, type: 'credit' as const, date: '2026-01-01' },
      ])
      expect(result.valid).toBe(false)
      expect(result.failures.length).toBeGreaterThan(0)
    })
  })

  describe('validateTimeRange', () => {
    it('passes when start < end', () => {
      const result = validateTimeRange(
        validParams.period,
        validEntries,
      )
      expect(result.valid).toBe(true)
    })

    it('fails when start > end', () => {
      const result = validateTimeRange(
        { start: '2026-12-01', end: '2026-01-01' },
        validEntries,
      )
      expect(result.valid).toBe(false)
      expect(result.failures.length).toBeGreaterThan(0)
    })
  })

  describe('validateNoDuplicates', () => {
    it('passes when entries are unique', () => {
      const result = validateNoDuplicates(validEntries)
      expect(result.valid).toBe(true)
    })

    it('fails when entries are duplicated', () => {
      const result = validateNoDuplicates([
        { account: 'Sales', amount: 50000, type: 'credit', date: '2026-01-15' },
        { account: 'Sales', amount: 50000, type: 'credit', date: '2026-01-15' },
      ])
      expect(result.valid).toBe(false)
      expect(result.failures.length).toBeGreaterThan(0)
    })
  })

  describe('validateAmounts', () => {
    it('passes for positive amounts', () => {
      const result = validateAmounts(validEntries)
      expect(result.valid).toBe(true)
      expect(result.failures).toEqual([])
    })

    it('fails for negative amounts', () => {
      const result = validateAmounts([
        { amount: -1000 },
      ])
      expect(result.valid).toBe(false)
      expect(result.failures.length).toBeGreaterThan(0)
    })

    it('fails for NaN amounts', () => {
      const result = validateAmounts([
        { amount: NaN },
      ])
      expect(result.valid).toBe(false)
      expect(result.failures.length).toBeGreaterThan(0)
    })
  })

  describe('runValidationGates', () => {
    it('succeeds for valid inputs', () => {
      expect(() => runValidationGates(validParams)).not.toThrow()
    })

    it('throws FinancialValidationError with code', () => {
      const bad = { ...validParams, orgId: '' }
      try {
        runValidationGates(bad)
        expect.unreachable('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(FinancialValidationError)
        expect((err as FinancialValidationError).code).toBe('FINANCIAL_VALIDATION_FAILED')
        expect((err as FinancialValidationError).failures.length).toBeGreaterThan(0)
      }
    })

    it('aggregates failures from multiple gates', () => {
      const bad = {
        orgId: '',
        reportId: '',
        period: { start: '2026-12-01', end: '2026-01-01' },
        entries: [
          { account: '', amount: -1, type: 'credit' as const, date: '2026-01-01' },
          { account: '', amount: -1, type: 'credit' as const, date: '2026-01-01' },
        ],
      }
      try {
        runValidationGates(bad)
        expect.unreachable('should have thrown')
      } catch (err) {
        expect((err as FinancialValidationError).failures.length).toBeGreaterThan(2)
      }
    })
  })
})
