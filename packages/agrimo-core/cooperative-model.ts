/**
 * Agrimo — Cooperative Model.
 *
 * Cooperatives, farmers, fields, crop batches, collection points.
 * Aggregation at cooperative + individual farmer levels.
 */
import { z } from 'zod'

// ── Schemas ─────────────────────────────────────────────────────────────────

export const GeoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

export const FieldSchema = z.object({
  id: z.string(),
  farmer_id: z.string(),
  name: z.string(),
  location: GeoPointSchema,
  area_hectares: z.number().positive(),
  crop_type: z.string(),
  soil_type: z.string().optional(),
  created_at: z.string().datetime(),
})

export const FarmerSchema = z.object({
  id: z.string(),
  cooperative_id: z.string(),
  name: z.string(),
  phone: z.string().optional(),
  location: GeoPointSchema.optional(),
  fields: z.array(FieldSchema).default([]),
  joined_at: z.string().datetime(),
  status: z.enum(['active', 'inactive', 'suspended']),
})

export const CropBatchSchema = z.object({
  id: z.string(),
  field_id: z.string(),
  farmer_id: z.string(),
  crop_type: z.string(),
  planted_at: z.string().datetime(),
  expected_harvest_at: z.string().datetime().optional(),
  actual_harvest_at: z.string().datetime().optional(),
  quantity_kg: z.number().nonnegative().optional(),
  quality_grade: z.string().optional(),
  status: z.enum(['planted', 'growing', 'ready', 'harvested', 'delivered']),
})

export const CollectionPointSchema = z.object({
  id: z.string(),
  cooperative_id: z.string(),
  name: z.string(),
  location: GeoPointSchema,
  capacity_kg: z.number().positive(),
  current_stock_kg: z.number().nonnegative(),
  manager_name: z.string().optional(),
})

export const CooperativeSchema = z.object({
  id: z.string(),
  org_id: z.string(),
  name: z.string(),
  region: z.string(),
  location: GeoPointSchema.optional(),
  farmers: z.array(FarmerSchema).default([]),
  collection_points: z.array(CollectionPointSchema).default([]),
  created_at: z.string().datetime(),
  status: z.enum(['active', 'inactive', 'pending']),
})

// ── Types ───────────────────────────────────────────────────────────────────

export type GeoPoint = z.infer<typeof GeoPointSchema>
export type Field = z.infer<typeof FieldSchema>
export type Farmer = z.infer<typeof FarmerSchema>
export type CropBatch = z.infer<typeof CropBatchSchema>
export type CollectionPoint = z.infer<typeof CollectionPointSchema>
export type Cooperative = z.infer<typeof CooperativeSchema>

// ── Aggregation ─────────────────────────────────────────────────────────────

export interface FarmerSummary {
  farmer_id: string
  name: string
  total_fields: number
  total_area_hectares: number
  active_batches: number
  total_harvested_kg: number
}

export interface CooperativeSummary {
  cooperative_id: string
  name: string
  region: string
  total_farmers: number
  active_farmers: number
  total_fields: number
  total_area_hectares: number
  total_harvested_kg: number
  total_collection_capacity_kg: number
  current_stock_kg: number
}

/** Summarise a single farmer's production. */
export function summariseFarmer(
  farmer: Farmer,
  batches: CropBatch[],
): FarmerSummary {
  const farmerBatches = batches.filter((b) => b.farmer_id === farmer.id)
  return {
    farmer_id: farmer.id,
    name: farmer.name,
    total_fields: farmer.fields.length,
    total_area_hectares: farmer.fields.reduce(
      (sum, f) => sum + f.area_hectares,
      0,
    ),
    active_batches: farmerBatches.filter(
      (b) => b.status !== 'harvested' && b.status !== 'delivered',
    ).length,
    total_harvested_kg: farmerBatches
      .filter((b) => b.status === 'harvested' || b.status === 'delivered')
      .reduce((sum, b) => sum + (b.quantity_kg ?? 0), 0),
  }
}

/** Summarise a cooperative's overall production. */
export function summariseCooperative(
  coop: Cooperative,
  batches: CropBatch[],
): CooperativeSummary {
  const farmerIds = new Set(coop.farmers.map((f) => f.id))
  const coopBatches = batches.filter((b) => farmerIds.has(b.farmer_id))
  return {
    cooperative_id: coop.id,
    name: coop.name,
    region: coop.region,
    total_farmers: coop.farmers.length,
    active_farmers: coop.farmers.filter((f) => f.status === 'active').length,
    total_fields: coop.farmers.reduce((sum, f) => sum + f.fields.length, 0),
    total_area_hectares: coop.farmers.reduce(
      (sum, f) =>
        sum + f.fields.reduce((fSum, field) => fSum + field.area_hectares, 0),
      0,
    ),
    total_harvested_kg: coopBatches
      .filter((b) => b.status === 'harvested' || b.status === 'delivered')
      .reduce((sum, b) => sum + (b.quantity_kg ?? 0), 0),
    total_collection_capacity_kg: coop.collection_points.reduce(
      (sum, cp) => sum + cp.capacity_kg,
      0,
    ),
    current_stock_kg: coop.collection_points.reduce(
      (sum, cp) => sum + cp.current_stock_kg,
      0,
    ),
  }
}

/** Get batches ready for collection at a specific point. */
export function batchesReadyForCollection(
  batches: CropBatch[],
  farmers: Farmer[],
  collectionPoint: CollectionPoint,
): CropBatch[] {
  // Find farmers near this collection point (same cooperative)
  const coopFarmerIds = new Set(farmers.map((f) => f.id))
  return batches.filter(
    (b) => b.status === 'ready' && coopFarmerIds.has(b.farmer_id),
  )
}
