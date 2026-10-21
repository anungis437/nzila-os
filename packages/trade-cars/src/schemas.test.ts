/**
 * Zod 4 qualification for @nzila/trade-cars (Snyk SNYK-JS-ZOD-20510278, PR #978).
 * All inputs are bounded; no test allocates unbounded memory.
 */

import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { vehicleDocUploadSchema, vehicleListingSchema } from './schemas'

const validListing = {
  vin: '1HGCM82633A004352',
  make: 'Honda',
  model: 'Accord',
  year: 2020,
  trim: null,
  mileage: 42_000,
  condition: 'used',
  transmission: 'automatic',
  drivetrain: 'fwd',
  fuelType: 'gasoline',
}

describe('vehicleListingSchema (zod 4)', () => {
  it('accepts a valid listing and preserves nullable/optional semantics', () => {
    const result = vehicleListingSchema.safeParse(validListing)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.trim).toBeNull()
      expect(result.data.exteriorColor).toBeUndefined()
    }
  })

  it('rejects malformed VINs, out-of-range years and unknown enum values', () => {
    const result = vehicleListingSchema.safeParse({
      ...validListing,
      vin: 'IOQ-invalid',
      year: 1800,
      condition: 'broken',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toEqual(expect.arrayContaining(['vin', 'year', 'condition']))
    }
  })

  it('does not fan out when a bounded array is supplied where a scalar is expected', () => {
    const result = vehicleListingSchema.safeParse({
      ...validListing,
      make: new Array(50_000).fill('x'),
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.length).toBeLessThanOrEqual(2)
    }
  })
})

describe('vehicleDocUploadSchema (zod 4)', () => {
  it('accepts a valid upload and rejects an empty storage key', () => {
    const base = {
      docType: 'title',
      title: 'Title',
      storageKey: 'k/1',
      contentHash: 'abc',
    }
    expect(vehicleDocUploadSchema.safeParse(base).success).toBe(true)
    expect(vehicleDocUploadSchema.safeParse({ ...base, storageKey: '' }).success).toBe(false)
  })
})

describe('zod array size-bound guard (advisory regression, requires zod >= 4.6.6)', () => {
  it('fails a bounded array on its size cap with a single issue before parsing elements', () => {
    const schema = z.array(z.number().max(1)).max(100)
    const result = schema.safeParse(new Array(20_000).fill(5))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1)
      expect(result.error.issues[0]?.code).toBe('too_big')
    }
  })

  it('applies the same pre-parse cap to sets and maps', () => {
    const setResult = z.set(z.number().max(1)).max(10).safeParse(new Set(Array.from({ length: 5_000 }, (_, i) => i + 2)))
    expect(setResult.success).toBe(false)
    if (!setResult.success) expect(setResult.error.issues).toHaveLength(1)

    const mapResult = z
      .map(z.string(), z.number().max(1))
      .max(10)
      .safeParse(new Map(Array.from({ length: 5_000 }, (_, i) => [`k${i}`, 5] as [string, number])))
    expect(mapResult.success).toBe(false)
    if (!mapResult.success) expect(mapResult.error.issues).toHaveLength(1)
  })
})
