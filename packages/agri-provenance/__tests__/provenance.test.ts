import { describe, it, expect } from 'vitest'
import {
  computeHash,
  createProvenanceRecord,
  recordTransformation,
  verifyProvenance,
  attachProvenance,
  enforceProvenance,
} from '../src/hash'
import {
  buildProvenanceChain,
  verifyProvenanceChain,
  provenanceRecordsToChainEntries,
} from '../src/chain'
import type { ProvenanceRecord } from '@nzila/agri-core'

// ── hash.ts ─────────────────────────────────────────────────────────────────

describe('computeHash', () => {
  it('returns deterministic SHA-256 hash', () => {
    const h1 = computeHash({ a: 1, b: 2 })
    const h2 = computeHash({ a: 1, b: 2 })
    expect(h1).toBe(h2)
    expect(h1).toHaveLength(64) // SHA-256 hex
  })

  it('is key-order independent', () => {
    const h1 = computeHash({ b: 2, a: 1 })
    const h2 = computeHash({ a: 1, b: 2 })
    expect(h1).toBe(h2)
  })

  it('hashes non-object values (array, string, null)', () => {
    const hArr = computeHash([1, 2, 3])
    const hStr = computeHash('hello')
    const hNull = computeHash(null)
    expect(hArr).toHaveLength(64)
    expect(hStr).toHaveLength(64)
    expect(hNull).toHaveLength(64)
    // All different
    expect(new Set([hArr, hStr, hNull]).size).toBe(3)
  })
})

describe('createProvenanceRecord', () => {
  it('creates a valid record with hash', () => {
    const rec = createProvenanceRecord({
      orgId: 'org_1',
      source: 'field-sensor-42',
      sourceType: 'SENSOR',
      outputData: { temp: 30, humidity: 0.7 },
      deviceId: 'device_a',
    })
    expect(rec.id).toMatch(/^prov_/)
    expect(rec.orgId).toBe('org_1')
    expect(rec.sourceType).toBe('SENSOR')
    expect(rec.outputHash).toHaveLength(64)
    expect(rec.verified).toBe(false)
    expect(rec.transformations).toEqual([])
  })
})

describe('recordTransformation', () => {
  it('appends transformation and recomputes hash', () => {
    const rec = createProvenanceRecord({
      orgId: 'org_1',
      source: 'import',
      sourceType: 'IMPORT',
      outputData: { raw: true },
    })
    const oldHash = rec.outputHash
    const updated = recordTransformation(
      rec,
      { cleaned: true },
      'clean',
      'Removed nulls',
      'system',
    )
    expect(updated.transformations).toHaveLength(1)
    expect(updated.outputHash).not.toBe(oldHash)
  })

  it('does not mutate the original record', () => {
    const rec = createProvenanceRecord({
      orgId: 'org_1',
      source: 's',
      sourceType: 'MANUAL_ENTRY',
      outputData: { x: 1 },
    })
    recordTransformation(rec, { y: 2 }, 'x', 'y', 'z')
    expect(rec.transformations).toHaveLength(0)
  })
})

describe('verifyProvenance', () => {
  it('returns true for matching data', () => {
    const data = { value: 42 }
    const rec = createProvenanceRecord({
      orgId: 'org_1',
      source: 's',
      sourceType: 'API',
      outputData: data,
    })
    expect(verifyProvenance(rec, data)).toBe(true)
  })

  it('returns false for tampered data', () => {
    const rec = createProvenanceRecord({
      orgId: 'org_1',
      source: 's',
      sourceType: 'API',
      outputData: { value: 42 },
    })
    expect(verifyProvenance(rec, { value: 'TAMPERED' })).toBe(false)
  })
})

describe('attachProvenance', () => {
  it('wraps data with provenance', () => {
    const rec = createProvenanceRecord({
      orgId: 'org_1',
      source: 's',
      sourceType: 'MANUAL_ENTRY',
      outputData: { name: 'test' },
    })
    const wrapped = attachProvenance({ name: 'test' }, rec)
    expect(wrapped.data.name).toBe('test')
    expect(wrapped.provenance.id).toBe(rec.id)
  })
})

describe('enforceProvenance', () => {
  it('passes through valid provenance', () => {
    const data = { x: 1 }
    const rec = createProvenanceRecord({
      orgId: 'org_1',
      source: 's',
      sourceType: 'MANUAL_ENTRY',
      outputData: data,
    })
    // should not throw
    expect(() => enforceProvenance(rec, data)).not.toThrow()
  })

  it('throws AGRI_DATA_BLOCKED_NO_PROVENANCE for missing', () => {
    expect(() => enforceProvenance(null, {}))
      .toThrow('AGRI_DATA_BLOCKED_NO_PROVENANCE')
  })

  it('throws AGRI_DATA_BLOCKED_HASH_MISMATCH for tampered hash', () => {
    const rec = createProvenanceRecord({
      orgId: 'org_1',
      source: 's',
      sourceType: 'MANUAL_ENTRY',
      outputData: { x: 1 },
    })
    expect(() => enforceProvenance(rec, { x: 'tampered' }))
      .toThrow('AGRI_DATA_BLOCKED_HASH_MISMATCH')
  })
})

// ── chain.ts ────────────────────────────────────────────────────────────────

describe('buildProvenanceChain', () => {
  it('builds a chain from entries', () => {
    const entries = [
      { entityType: 'crop', subjectId: 'a', action: 'harvest', timestamp: '2025-01-01T00:00:00Z' },
      { entityType: 'crop', subjectId: 'b', action: 'harvest', timestamp: '2025-01-02T00:00:00Z' },
    ]
    const chain = buildProvenanceChain('org_1', entries)
    expect(chain.entries).toHaveLength(2)
    expect(chain.entries[0]!.previousHash).toMatch(/^[a-f0-9]{64}$/) // genesis = SHA-256('')
    expect(chain.entries[1]!.previousHash).toBe(chain.entries[0]!.hash)
    expect(chain.orgId).toBe('org_1')
    expect(chain.entryCount).toBe(2)
  })

  it('returns empty entries for empty input', () => {
    const chain = buildProvenanceChain('org_1', [])
    expect(chain.entries).toEqual([])
    expect(chain.entryCount).toBe(0)
  })
})

describe('verifyProvenanceChain', () => {
  it('verifies a valid chain', () => {
    const entries = [
      { entityType: 'crop', subjectId: 'a', action: 'create', timestamp: '2025-01-01T00:00:00Z' },
      { entityType: 'crop', subjectId: 'b', action: 'create', timestamp: '2025-01-02T00:00:00Z' },
      { entityType: 'crop', subjectId: 'c', action: 'create', timestamp: '2025-01-03T00:00:00Z' },
    ]
    const chain = buildProvenanceChain('org_1', entries)
    expect(verifyProvenanceChain(chain)).toBe(true)
  })

  it('rejects a tampered chain', () => {
    const entries = [
      { entityType: 'crop', subjectId: 'a', action: 'create', timestamp: '2025-01-01T00:00:00Z' },
      { entityType: 'crop', subjectId: 'b', action: 'create', timestamp: '2025-01-02T00:00:00Z' },
    ]
    const chain = buildProvenanceChain('org_1', entries)
    // Tamper with the first entry's hash
    const tampered = {
      ...chain,
      entries: chain.entries.map((e, i) =>
        i === 0 ? { ...e, hash: 'tampered' } : e,
      ),
    }
    expect(verifyProvenanceChain(tampered)).toBe(false)
  })

  it('rejects a chain with tampered previousHash', () => {
    const entries = [
      { entityType: 'crop', subjectId: 'a', action: 'create', timestamp: '2025-01-01T00:00:00Z' },
      { entityType: 'crop', subjectId: 'b', action: 'create', timestamp: '2025-01-02T00:00:00Z' },
    ]
    const chain = buildProvenanceChain('org_1', entries)
    const tampered = {
      ...chain,
      entries: chain.entries.map((e, i) =>
        i === 1 ? { ...e, previousHash: 'tampered' } : e,
      ),
    }
    expect(verifyProvenanceChain(tampered)).toBe(false)
  })
})

describe('provenanceRecordsToChainEntries', () => {
  it('converts provenance records to chain entries', () => {
    const records = [
      { id: 'p1', createdAt: '2025-01-01T00:00:00Z' },
      { id: 'p2', createdAt: '2025-01-02T00:00:00Z' },
    ] as unknown as ProvenanceRecord[]
    const entries = provenanceRecordsToChainEntries(records, 'provenance', 'create')
    expect(entries).toEqual([
      { entityType: 'provenance', subjectId: 'p1', action: 'create', timestamp: '2025-01-01T00:00:00Z', provenanceRef: 'p1' },
      { entityType: 'provenance', subjectId: 'p2', action: 'create', timestamp: '2025-01-02T00:00:00Z', provenanceRef: 'p2' },
    ])
  })
})
