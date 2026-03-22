import { describe, it, expect } from 'vitest'
import {
  createProvenance,
  attachProvenance,
  recordTransformation,
  verifyProvenance,
  enforceProvenance,
  computeHash,
  getProvenanceChain,
} from '../provenance'

describe('Provenance', () => {
  describe('computeHash', () => {
    it('produces deterministic hash', () => {
      const data = { crop: 'maize', quantity: 100 }
      const h1 = computeHash(data)
      const h2 = computeHash(data)
      expect(h1).toBe(h2)
      expect(h1).toHaveLength(64) // sha256 hex
    })

    it('different data produces different hash', () => {
      const h1 = computeHash({ a: 1 })
      const h2 = computeHash({ a: 2 })
      expect(h1).not.toBe(h2)
    })
  })

  describe('createProvenance', () => {
    it('creates with correct fields', () => {
      const prov = createProvenance({
        source: 'field-officer',
        source_type: 'manual_entry',
        raw_input: { crop: 'maize', weight: 50 },
        device_id: 'phone-1',
      })
      expect(prov.id).toMatch(/^prov_/)
      expect(prov.source).toBe('field-officer')
      expect(prov.source_type).toBe('manual_entry')
      expect(prov.hash).toHaveLength(64)
      expect(prov.transformations).toHaveLength(0)
      expect(prov.verified).toBe(false)
    })
  })

  describe('attachProvenance', () => {
    it('wraps data with provenance', () => {
      const data = { crop: 'cassava' }
      const prov = createProvenance({
        source: 'sensor',
        source_type: 'sensor',
        raw_input: data,
      })
      const attached = attachProvenance(data, prov)
      expect(attached.data).toEqual(data)
      expect(attached.provenance).toEqual(prov)
    })
  })

  describe('recordTransformation', () => {
    it('adds transformation and recomputes hash', () => {
      const prov = createProvenance({
        source: 'import',
        source_type: 'import',
        raw_input: { raw: true },
      })
      const transformed = recordTransformation(
        prov,
        { raw: false, cleaned: true },
        'cleaning',
        'Removed invalid entries',
        'system',
      )
      expect(transformed.transformations).toHaveLength(1)
      expect(transformed.transformations[0]!.step).toBe('cleaning')
      expect(transformed.hash).not.toBe(prov.hash)
    })
  })

  describe('verifyProvenance', () => {
    it('returns true for matching data', () => {
      const data = { test: 'value' }
      const prov = createProvenance({
        source: 'test',
        source_type: 'manual_entry',
        raw_input: data,
      })
      expect(verifyProvenance(data, prov)).toBe(true)
    })

    it('returns false for tampered data', () => {
      const data = { test: 'value' }
      const prov = createProvenance({
        source: 'test',
        source_type: 'manual_entry',
        raw_input: data,
      })
      expect(verifyProvenance({ test: 'tampered' }, prov)).toBe(false)
    })
  })

  describe('enforceProvenance', () => {
    it('passes with valid provenance', () => {
      const data = { ok: true }
      const prov = createProvenance({
        source: 'test',
        source_type: 'manual_entry',
        raw_input: data,
      })
      const result = enforceProvenance({ data, provenance: prov })
      expect(result.provenance).toBeDefined()
    })

    it('throws AGRIMO_DATA_BLOCKED_NO_PROVENANCE when missing', () => {
      expect(() =>
        enforceProvenance({ data: {} } as never),
      ).toThrow('AGRIMO_DATA_BLOCKED_NO_PROVENANCE')
    })
  })

  describe('getProvenanceChain', () => {
    it('summarises provenance for audit', () => {
      let prov = createProvenance({
        source: 'field',
        source_type: 'manual_entry',
        raw_input: { weight: 100 },
      })
      prov = recordTransformation(
        prov,
        { weight: 100, grade: 'A' },
        'grading',
        'Added quality grade',
        'qa-officer',
      )
      const chain = getProvenanceChain(prov)
      expect(chain.source).toBe('field')
      expect(chain.transformations_count).toBe(1)
      expect(chain.verified).toBe(false)
    })
  })
})
