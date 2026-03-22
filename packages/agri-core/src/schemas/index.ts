import { z } from 'zod'
import {
  CropType, UnitOfMeasure, ProducerStatus, LotStatus as _LotStatus, BatchStatus as _BatchStatus,
  PaymentMethod,
  CertificationType,
  SupplyChainStepType, SupplyChainStepStatus, SupplyChainStatus,
  ProvenanceSourceType, SyncStatus, ConflictResolutionStrategy,
  ConfidenceLevel, ForecastType,
} from '../enums'

// ─── Shared ───

export const uuidSchema = z.string().uuid()
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
})
export const seasonSchema = z.string().min(1).max(20)
export const geoPointSchema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
export const locationSchema = geoPointSchema.extend({
  region: z.string().optional(),
  district: z.string().optional(),
  address: z.string().optional(),
})

// ─── Producer ───

export const createProducerSchema = z.object({
  name: z.string().min(1).max(300),
  contactPhone: z.string().max(30).nullable().default(null),
  contactEmail: z.string().email().nullable().default(null),
  location: locationSchema.nullable().default(null),
  cooperativeId: uuidSchema.nullable().default(null),
  metadata: z.record(z.unknown()).default({}),
})
export type CreateProducerInput = z.infer<typeof createProducerSchema>

export const updateProducerSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(300).optional(),
  contactPhone: z.string().max(30).nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  location: locationSchema.nullable().optional(),
  cooperativeId: uuidSchema.nullable().optional(),
  status: z.enum([ProducerStatus.ACTIVE, ProducerStatus.INACTIVE, ProducerStatus.SUSPENDED]).optional(),
  metadata: z.record(z.unknown()).optional(),
})
export type UpdateProducerInput = z.infer<typeof updateProducerSchema>

// ─── Crop ───

export const createCropSchema = z.object({
  name: z.string().min(1).max(200),
  cropType: z.enum([CropType.COFFEE, CropType.COCOA, CropType.CASHEW, CropType.COTTON, CropType.SESAME, CropType.SOY, CropType.PALM_OIL, CropType.SPICE, CropType.OTHER]),
  unitOfMeasure: z.enum([UnitOfMeasure.KG, UnitOfMeasure.LB, UnitOfMeasure.MT, UnitOfMeasure.BAG_60KG, UnitOfMeasure.BAG_69KG, UnitOfMeasure.LITER]),
  baselineYieldPerHectare: z.number().nonnegative().nullable().default(null),
  metadata: z.record(z.unknown()).default({}),
})
export type CreateCropInput = z.infer<typeof createCropSchema>

// ─── Harvest ───

export const recordHarvestSchema = z.object({
  producerId: uuidSchema,
  cropId: uuidSchema,
  season: seasonSchema,
  harvestDate: z.string().date(),
  quantity: z.number().positive(),
  geoPoint: geoPointSchema.nullable().default(null),
  notes: z.string().max(2000).nullable().default(null),
})
export type RecordHarvestInput = z.infer<typeof recordHarvestSchema>

// ─── Lot ───

export const createLotSchema = z.object({
  cropId: uuidSchema,
  season: seasonSchema,
  harvestIds: z.array(uuidSchema).min(1),
})
export type CreateLotInput = z.infer<typeof createLotSchema>

// ─── Quality Inspection ───

export const inspectLotSchema = z.object({
  lotId: uuidSchema,
  defects: z.record(z.unknown()).default({}),
  notes: z.string().max(2000).nullable().default(null),
})
export type InspectLotInput = z.infer<typeof inspectLotSchema>

export const gradeLotSchema = z.object({
  lotId: uuidSchema,
  inspectionId: uuidSchema,
  grade: z.string().min(1).max(50),
  score: z.number().min(0).max(100),
})
export type GradeLotInput = z.infer<typeof gradeLotSchema>

export const certifyLotSchema = z.object({
  lotId: uuidSchema,
  certificationType: z.enum([
    CertificationType.ORGANIC, CertificationType.FAIRTRADE,
    CertificationType.RAINFOREST_ALLIANCE, CertificationType.UTZ,
    CertificationType.INTERNAL_QUALITY, CertificationType.EXPORT_GRADE,
  ]),
  certificateRef: z.string().max(200).nullable().default(null),
  metadata: z.record(z.unknown()).default({}),
})
export type CertifyLotInput = z.infer<typeof certifyLotSchema>

export const rejectLotSchema = z.object({
  lotId: uuidSchema,
  reason: z.string().min(1).max(2000),
})
export type RejectLotInput = z.infer<typeof rejectLotSchema>

// ─── Warehouse ───

export const createWarehouseSchema = z.object({
  name: z.string().min(1).max(200),
  location: locationSchema.nullable().default(null),
  capacity: z.number().positive().nullable().default(null),
})
export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>

// ─── Batch ───

export const createBatchSchema = z.object({
  warehouseId: uuidSchema,
  cropId: uuidSchema,
  lotIds: z.array(uuidSchema).min(1),
})
export type CreateBatchInput = z.infer<typeof createBatchSchema>

export const allocateBatchSchema = z.object({
  batchId: uuidSchema,
  shipmentId: uuidSchema,
  weight: z.number().positive(),
})
export type AllocateBatchInput = z.infer<typeof allocateBatchSchema>

// ─── Shipment ───

export const createShipmentSchema = z.object({
  batchId: uuidSchema,
  destination: z.object({
    port: z.string().optional(),
    country: z.string().min(2).max(100),
    buyer: z.string().optional(),
  }),
  allocatedWeight: z.number().positive(),
  plannedDeparture: z.string().date().nullable().default(null),
  plannedArrival: z.string().date().nullable().default(null),
})
export type CreateShipmentInput = z.infer<typeof createShipmentSchema>

export const updateMilestoneSchema = z.object({
  shipmentId: uuidSchema,
  milestone: z.string().min(1).max(100),
  notes: z.string().max(2000).nullable().default(null),
})
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>

// ─── Payment ───

export const generatePaymentPlanSchema = z.object({
  lotId: uuidSchema,
  totalAmount: z.number().positive(),
  currency: z.string().min(3).max(3),
})
export type GeneratePaymentPlanInput = z.infer<typeof generatePaymentPlanSchema>

export const executePaymentSchema = z.object({
  planId: uuidSchema,
  producerId: uuidSchema,
  amount: z.number().positive(),
  method: z.enum([
    PaymentMethod.MOBILE_MONEY, PaymentMethod.BANK_TRANSFER,
    PaymentMethod.CASH, PaymentMethod.CHECK, PaymentMethod.STRIPE,
  ]),
  reference: z.string().max(200).nullable().default(null),
})
export type ExecutePaymentInput = z.infer<typeof executePaymentSchema>

// ─── Inferred type helpers ───

export type PaginationInput = z.infer<typeof paginationSchema>

// ─── Field ───

export const createFieldSchema = z.object({
  producerId: uuidSchema,
  name: z.string().min(1).max(200),
  location: geoPointSchema.nullable().default(null),
  areaHectares: z.number().positive(),
  cropType: z.enum([CropType.COFFEE, CropType.COCOA, CropType.CASHEW, CropType.COTTON, CropType.SESAME, CropType.SOY, CropType.PALM_OIL, CropType.SPICE, CropType.OTHER]),
  soilType: z.string().max(100).nullable().default(null),
  metadata: z.record(z.unknown()).default({}),
})
export type CreateFieldInput = z.infer<typeof createFieldSchema>

// ─── Collection Point ───

export const createCollectionPointSchema = z.object({
  cooperativeId: uuidSchema,
  name: z.string().min(1).max(200),
  location: locationSchema.nullable().default(null),
  capacityKg: z.number().positive().nullable().default(null),
  managerName: z.string().max(200).nullable().default(null),
})
export type CreateCollectionPointInput = z.infer<typeof createCollectionPointSchema>

// ─── Supply Chain ───

const supplyChainStepTypeValues = [
  SupplyChainStepType.HARVEST, SupplyChainStepType.COLLECTION,
  SupplyChainStepType.STORAGE, SupplyChainStepType.PROCESSING,
  SupplyChainStepType.TRANSPORT, SupplyChainStepType.DELIVERY,
] as const

const supplyChainStepStatusValues = [
  SupplyChainStepStatus.PENDING, SupplyChainStepStatus.IN_PROGRESS,
  SupplyChainStepStatus.COMPLETED, SupplyChainStepStatus.FAILED,
  SupplyChainStepStatus.SKIPPED,
] as const

export const recordSupplyChainEventSchema = z.object({
  chainId: uuidSchema,
  stepType: z.enum(supplyChainStepTypeValues),
  status: z.enum(supplyChainStepStatusValues),
  location: geoPointSchema.nullable().default(null),
  responsibleParty: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    role: z.string().min(1),
  }),
  quantityKg: z.number().nonnegative().nullable().default(null),
  qualityGrade: z.string().max(50).nullable().default(null),
  notes: z.string().max(2000).nullable().default(null),
  deviceId: z.string().max(100).nullable().default(null),
  provenanceRef: z.string().max(200).nullable().default(null),
})
export type RecordSupplyChainEventInput = z.infer<typeof recordSupplyChainEventSchema>

const supplyChainStatusValues = [
  SupplyChainStatus.ACTIVE, SupplyChainStatus.COMPLETED, SupplyChainStatus.CANCELLED,
] as const

export const createSupplyChainSchema = z.object({
  batchId: uuidSchema,
  cropType: z.string().min(1).max(100),
  originCooperativeId: uuidSchema,
  originProducerId: uuidSchema,
  destination: z.string().max(500).nullable().default(null),
})
export type CreateSupplyChainInput = z.infer<typeof createSupplyChainSchema>

// ─── Provenance ───

const provenanceSourceTypeValues = [
  ProvenanceSourceType.MANUAL_ENTRY, ProvenanceSourceType.SENSOR,
  ProvenanceSourceType.IMPORT, ProvenanceSourceType.API,
  ProvenanceSourceType.DERIVED, ProvenanceSourceType.EXTERNAL,
] as const

export const createProvenanceSchema = z.object({
  source: z.string().min(1).max(500),
  sourceType: z.enum(provenanceSourceTypeValues),
  rawInputRef: z.string().max(500).nullable().default(null),
  transformationVersion: z.string().max(50).default('1.0'),
  deviceId: z.string().max(100).nullable().default(null),
})
export type CreateProvenanceInput = z.infer<typeof createProvenanceSchema>

export const provenanceTransformationSchema = z.object({
  step: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  appliedBy: z.string().min(1).max(200),
})
export type ProvenanceTransformationInput = z.infer<typeof provenanceTransformationSchema>

// ─── Sync ───

const syncStatusValues = [
  SyncStatus.PENDING, SyncStatus.SYNCED, SyncStatus.CONFLICT, SyncStatus.FAILED,
] as const

const conflictResolutionValues = [
  ConflictResolutionStrategy.LAST_WRITE_WINS,
  ConflictResolutionStrategy.DEVICE_PRIORITY,
  ConflictResolutionStrategy.MANUAL,
] as const

export const syncMetadataSchema = z.object({
  localId: z.string().min(1),
  canonicalId: z.string().nullable().default(null),
  deviceId: z.string().min(1),
  lastSyncedAt: z.string().datetime().nullable().default(null),
  syncStatus: z.enum(syncStatusValues),
  conflictState: z.string().nullable().default(null),
  resolutionStrategy: z.enum(conflictResolutionValues),
  version: z.number().int().nonnegative(),
})
export type SyncMetadataInput = z.infer<typeof syncMetadataSchema>

// ─── Intelligence ───

const confidenceLevelValues = [
  ConfidenceLevel.HIGH, ConfidenceLevel.MEDIUM, ConfidenceLevel.LOW,
] as const

export const sourceDataRefSchema = z.object({
  type: z.string().min(1),
  id: z.string().min(1),
  label: z.string().optional(),
})

export const explainableOutputSchema = z.object({
  explanation: z.string().min(1),
  sourceDataRefs: z.array(sourceDataRefSchema),
  confidenceLevel: z.enum(confidenceLevelValues),
  modelVersion: z.string().min(1),
  generatedAt: z.string().datetime(),
})

// ─── Forecast ───

const forecastTypeValues = [
  ForecastType.YIELD, ForecastType.PRICE, ForecastType.DEMAND,
  ForecastType.COST, ForecastType.CLIMATE, ForecastType.PRODUCTION,
  ForecastType.LOGISTICS,
] as const

export const createForecastSchema = z.object({
  forecastType: z.enum(forecastTypeValues),
  cropId: uuidSchema.nullable().default(null),
  regionId: z.string().nullable().default(null),
  season: seasonSchema.nullable().default(null),
  assumptions: z.array(z.string()),
  inputRefs: z.array(z.string()),
})
export type CreateForecastInput = z.infer<typeof createForecastSchema>
