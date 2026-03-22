import { describe, it, expect } from 'vitest'
import {
  CooperativeSchema,
  FarmerSchema,
  CropBatchSchema,
  summariseFarmer,
  summariseCooperative,
  batchesReadyForCollection,
  type Farmer,
  type CropBatch,
  type Cooperative,
  type CollectionPoint,
} from '../cooperative-model'

const NOW = new Date().toISOString()

function makeFarmer(overrides: Partial<Farmer> = {}): Farmer {
  return FarmerSchema.parse({
    id: 'f1',
    cooperative_id: 'c1',
    name: 'Alice',
    joined_at: NOW,
    status: 'active',
    fields: [
      {
        id: 'field1',
        farmer_id: 'f1',
        name: 'North plot',
        location: { lat: -4.3, lng: 15.3 },
        area_hectares: 2.5,
        crop_type: 'maize',
        created_at: NOW,
      },
    ],
    ...overrides,
  })
}

function makeBatch(overrides: Partial<CropBatch> = {}): CropBatch {
  return CropBatchSchema.parse({
    id: 'b1',
    field_id: 'field1',
    farmer_id: 'f1',
    crop_type: 'maize',
    planted_at: NOW,
    status: 'growing',
    ...overrides,
  })
}

function makeCooperative(overrides: Partial<Cooperative> = {}): Cooperative {
  return CooperativeSchema.parse({
    id: 'c1',
    org_id: 'org1',
    name: 'TestCoop',
    region: 'Bandundu',
    created_at: NOW,
    status: 'active',
    farmers: [makeFarmer()],
    collection_points: [
      {
        id: 'cp1',
        cooperative_id: 'c1',
        name: 'Central Hub',
        location: { lat: -4.3, lng: 15.3 },
        capacity_kg: 5000,
        current_stock_kg: 1200,
      },
    ],
    ...overrides,
  })
}

describe('Cooperative Model', () => {
  describe('schema validation', () => {
    it('validates a valid farmer', () => {
      const result = FarmerSchema.safeParse(makeFarmer())
      expect(result.success).toBe(true)
    })

    it('rejects invalid geolocation', () => {
      const result = FarmerSchema.safeParse({
        id: 'f1',
        cooperative_id: 'c1',
        name: 'Bad',
        joined_at: NOW,
        status: 'active',
        fields: [
          {
            id: 'f1',
            farmer_id: 'f1',
            name: 'Bad',
            location: { lat: 999, lng: 0 },
            area_hectares: 1,
            crop_type: 'maize',
            created_at: NOW,
          },
        ],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('summariseFarmer', () => {
    it('calculates correct summary', () => {
      const farmer = makeFarmer()
      const batches = [
        makeBatch({ status: 'growing' }),
        makeBatch({
          id: 'b2',
          status: 'harvested',
          quantity_kg: 500,
        }),
      ]
      const summary = summariseFarmer(farmer, batches)
      expect(summary.farmer_id).toBe('f1')
      expect(summary.total_fields).toBe(1)
      expect(summary.total_area_hectares).toBe(2.5)
      expect(summary.active_batches).toBe(1)
      expect(summary.total_harvested_kg).toBe(500)
    })

    it('handles farmer with no batches', () => {
      const summary = summariseFarmer(makeFarmer(), [])
      expect(summary.active_batches).toBe(0)
      expect(summary.total_harvested_kg).toBe(0)
    })
  })

  describe('summariseCooperative', () => {
    it('aggregates across all farmers', () => {
      const coop = makeCooperative()
      const batches = [
        makeBatch({ status: 'harvested', quantity_kg: 300 }),
        makeBatch({ id: 'b2', status: 'delivered', quantity_kg: 200 }),
      ]
      const summary = summariseCooperative(coop, batches)
      expect(summary.total_farmers).toBe(1)
      expect(summary.active_farmers).toBe(1)
      expect(summary.total_harvested_kg).toBe(500)
      expect(summary.total_collection_capacity_kg).toBe(5000)
      expect(summary.current_stock_kg).toBe(1200)
    })
  })

  describe('batchesReadyForCollection', () => {
    it('returns only ready batches for cooperative farmers', () => {
      const farmers = [makeFarmer()]
      const cp: CollectionPoint = {
        id: 'cp1',
        cooperative_id: 'c1',
        name: 'Hub',
        location: { lat: -4.3, lng: 15.3 },
        capacity_kg: 5000,
        current_stock_kg: 0,
      }
      const batches = [
        makeBatch({ status: 'ready' }),
        makeBatch({ id: 'b2', status: 'growing' }),
        makeBatch({ id: 'b3', farmer_id: 'other', status: 'ready' }),
      ]
      const ready = batchesReadyForCollection(batches, farmers, cp)
      expect(ready).toHaveLength(1)
      expect(ready[0]!.id).toBe('b1')
    })
  })
})
