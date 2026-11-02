import { describe, expect, it } from 'vitest'
import { GeoPointSchema, FarmerSchema } from './cooperative-model'
import { ProvenanceSchema } from './provenance'
describe('Zod 4 Agrimo boundaries', () => {
  it('retains geographic bounds and farmer defaults', () => {
    expect(GeoPointSchema.safeParse({ lat: 45, lng: -75 }).success).toBe(true)
    expect(GeoPointSchema.safeParse({ lat: 91, lng: -75 }).success).toBe(false)
    const farmer = { id: 'farmer-1', cooperative_id: 'coop-1', name: 'Farmer', joined_at: '2026-11-02T00:00:00Z', status: 'active' }
    expect(FarmerSchema.parse(farmer).fields).toEqual([])
    expect(FarmerSchema.safeParse({ ...farmer, status: 'unknown' }).success).toBe(false)
  })
  it('retains provenance defaults and rejects invalid source types', () => {
    const provenance = { id: 'record-1', source: 'field', source_type: 'sensor', raw_input: { temperature: 22 }, hash: 'digest', timestamp: '2026-11-02T00:00:00Z' }
    expect(ProvenanceSchema.parse(provenance).verified).toBe(false)
    expect(ProvenanceSchema.parse(provenance).transformations).toEqual([])
    expect(ProvenanceSchema.safeParse({ ...provenance, source_type: 'unknown' }).success).toBe(false)
  })
})
