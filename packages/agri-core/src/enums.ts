// ─── Crop & Measurement ───

export const CropType = {
  COFFEE: 'coffee',
  COCOA: 'cocoa',
  CASHEW: 'cashew',
  COTTON: 'cotton',
  SESAME: 'sesame',
  SOY: 'soy',
  PALM_OIL: 'palm_oil',
  SPICE: 'spice',
  OTHER: 'other',
} as const
export type CropType = (typeof CropType)[keyof typeof CropType]

export const UnitOfMeasure = {
  KG: 'kg',
  LB: 'lb',
  MT: 'mt',
  BAG_60KG: 'bag_60kg',
  BAG_69KG: 'bag_69kg',
  LITER: 'liter',
} as const
export type UnitOfMeasure = (typeof UnitOfMeasure)[keyof typeof UnitOfMeasure]

// ─── Producer / Cooperative ───

export const ProducerStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
} as const
export type ProducerStatus = (typeof ProducerStatus)[keyof typeof ProducerStatus]

// ─── Lot Quality FSM ───

export const LotStatus = {
  PENDING: 'pending',
  INSPECTED: 'inspected',
  GRADED: 'graded',
  CERTIFIED: 'certified',
  REJECTED: 'rejected',
} as const
export type LotStatus = (typeof LotStatus)[keyof typeof LotStatus]

// ─── Batch ───

export const BatchStatus = {
  AVAILABLE: 'available',
  ALLOCATED: 'allocated',
  DEPLETED: 'depleted',
} as const
export type BatchStatus = (typeof BatchStatus)[keyof typeof BatchStatus]

// ─── Warehouse ───

export const WarehouseStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const
export type WarehouseStatus = (typeof WarehouseStatus)[keyof typeof WarehouseStatus]

// ─── Shipment FSM ───

export const ShipmentStatus = {
  PLANNED: 'planned',
  PACKED: 'packed',
  DISPATCHED: 'dispatched',
  ARRIVED: 'arrived',
  CLOSED: 'closed',
} as const
export type ShipmentStatus = (typeof ShipmentStatus)[keyof typeof ShipmentStatus]

// ─── Payment ───

export const PaymentPlanStatus = {
  DRAFT: 'draft',
  APPROVED: 'approved',
  EXECUTING: 'executing',
  COMPLETED: 'completed',
} as const
export type PaymentPlanStatus = (typeof PaymentPlanStatus)[keyof typeof PaymentPlanStatus]

export const PaymentStatus = {
  PENDING: 'pending',
  EXECUTED: 'executed',
  FAILED: 'failed',
  REVERSED: 'reversed',
} as const
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus]

export const PaymentMethod = {
  MOBILE_MONEY: 'mobile_money',
  BANK_TRANSFER: 'bank_transfer',
  CASH: 'cash',
  CHECK: 'check',
  STRIPE: 'stripe',
} as const
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod]

// ─── Certification ───

export const CertificationType = {
  ORGANIC: 'organic',
  FAIRTRADE: 'fairtrade',
  RAINFOREST_ALLIANCE: 'rainforest_alliance',
  UTZ: 'utz',
  INTERNAL_QUALITY: 'internal_quality',
  EXPORT_GRADE: 'export_grade',
} as const
export type CertificationType = (typeof CertificationType)[keyof typeof CertificationType]

// ─── Evidence ───

export const AgriEvidenceType = {
  LOT_CERTIFICATION: 'lot_certification',
  SHIPMENT_MANIFEST: 'shipment_manifest',
  PAYMENT_DISTRIBUTION: 'payment_distribution',
  TRACEABILITY_CHAIN: 'traceability_chain',
} as const
export type AgriEvidenceType = (typeof AgriEvidenceType)[keyof typeof AgriEvidenceType]

// ─── Traceability ───

export const TraceabilityEntityType = {
  LOT: 'lot',
  BATCH: 'batch',
  SHIPMENT: 'shipment',
  PAYMENT: 'payment',
  HARVEST: 'harvest',
} as const
export type TraceabilityEntityType = (typeof TraceabilityEntityType)[keyof typeof TraceabilityEntityType]

// ─── Org Roles ───

export const AgriOrgRole = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  OPERATOR: 'operator',
  VIEWER: 'viewer',
} as const
export type AgriOrgRole = (typeof AgriOrgRole)[keyof typeof AgriOrgRole]

// ─── Forecast ───

export const ForecastType = {
  YIELD: 'yield',
  PRICE: 'price',
  DEMAND: 'demand',
  COST: 'cost',
  CLIMATE: 'climate',
  PRODUCTION: 'production',
  LOGISTICS: 'logistics',
} as const
export type ForecastType = (typeof ForecastType)[keyof typeof ForecastType]

// ─── Risk ───

export const RiskType = {
  CLIMATE: 'climate',
  MARKET: 'market',
  OPERATIONAL: 'operational',
} as const
export type RiskType = (typeof RiskType)[keyof typeof RiskType]

export const RiskScope = {
  COOPERATIVE: 'cooperative',
  REGION: 'region',
  CROP: 'crop',
} as const
export type RiskScope = (typeof RiskScope)[keyof typeof RiskScope]

// ─── Supply Chain Step ───

export const SupplyChainStepType = {
  HARVEST: 'harvest',
  COLLECTION: 'collection',
  STORAGE: 'storage',
  PROCESSING: 'processing',
  TRANSPORT: 'transport',
  DELIVERY: 'delivery',
} as const
export type SupplyChainStepType = (typeof SupplyChainStepType)[keyof typeof SupplyChainStepType]

export const SupplyChainStepStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
} as const
export type SupplyChainStepStatus = (typeof SupplyChainStepStatus)[keyof typeof SupplyChainStepStatus]

export const SupplyChainStatus = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const
export type SupplyChainStatus = (typeof SupplyChainStatus)[keyof typeof SupplyChainStatus]

// ─── Provenance ───

export const ProvenanceSourceType = {
  MANUAL_ENTRY: 'manual_entry',
  SENSOR: 'sensor',
  IMPORT: 'import',
  API: 'api',
  DERIVED: 'derived',
  EXTERNAL: 'external',
} as const
export type ProvenanceSourceType = (typeof ProvenanceSourceType)[keyof typeof ProvenanceSourceType]

// ─── Sync ───

export const SyncStatus = {
  PENDING: 'pending',
  SYNCED: 'synced',
  CONFLICT: 'conflict',
  FAILED: 'failed',
} as const
export type SyncStatus = (typeof SyncStatus)[keyof typeof SyncStatus]

export const ConflictResolutionStrategy = {
  LAST_WRITE_WINS: 'last_write_wins',
  DEVICE_PRIORITY: 'device_priority',
  MANUAL: 'manual',
} as const
export type ConflictResolutionStrategy = (typeof ConflictResolutionStrategy)[keyof typeof ConflictResolutionStrategy]

// ─── Intelligence ───

export const ConfidenceLevel = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const
export type ConfidenceLevel = (typeof ConfidenceLevel)[keyof typeof ConfidenceLevel]
