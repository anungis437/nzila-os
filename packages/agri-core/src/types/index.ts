import type {
  LotStatus, ShipmentStatus, BatchStatus, PaymentPlanStatus,
  AgriOrgRole, CropType, UnitOfMeasure, ProducerStatus,
  PaymentStatus, PaymentMethod, CertificationType,
  TraceabilityEntityType, WarehouseStatus,
  ForecastType, RiskType, RiskScope,
  SupplyChainStepType, SupplyChainStepStatus, SupplyChainStatus,
  ProvenanceSourceType, SyncStatus, ConflictResolutionStrategy,
  ConfidenceLevel,
} from '../enums'

export type {
  AgriOrgRole, CropType, UnitOfMeasure, ProducerStatus,
  LotStatus, ShipmentStatus, BatchStatus, PaymentPlanStatus,
  PaymentStatus, PaymentMethod, CertificationType,
  AgriEvidenceType, TraceabilityEntityType, WarehouseStatus,
  ForecastType, RiskType, RiskScope,
  SupplyChainStepType, SupplyChainStepStatus, SupplyChainStatus,
  ProvenanceSourceType, SyncStatus, ConflictResolutionStrategy,
  ConfidenceLevel,
} from '../enums'

// ─── Geo ───

export interface GeoPoint {
  readonly lat: number
  readonly lng: number
}

export interface Location extends GeoPoint {
  readonly region?: string
  readonly district?: string
  readonly address?: string
}

// ─── Org Context ───

export interface AgriOrgContext {
  readonly orgId: string
  readonly actorId: string
  readonly role: AgriOrgRole
  readonly permissions: readonly string[]
  readonly requestId: string
}

// ─── Producer / Cooperative ───

export interface ProducerProfile {
  readonly id: string
  readonly orgId: string
  readonly name: string
  readonly contactPhone: string | null
  readonly contactEmail: string | null
  readonly location: Location | null
  readonly cooperativeId: string | null
  readonly status: ProducerStatus
  readonly metadata: Record<string, unknown>
  readonly createdAt: string
  readonly updatedAt: string
}

export interface CooperativeProfile {
  readonly id: string
  readonly orgId: string
  readonly name: string
  readonly contactPhone: string | null
  readonly contactEmail: string | null
  readonly location: Location | null
  readonly memberCount: number
  readonly status: ProducerStatus
  readonly metadata: Record<string, unknown>
  readonly createdAt: string
  readonly updatedAt: string
}

// ─── Crop ───

export interface Crop {
  readonly id: string
  readonly orgId: string
  readonly name: string
  readonly cropType: CropType
  readonly unitOfMeasure: UnitOfMeasure
  readonly baselineYieldPerHectare: number | null
  readonly metadata: Record<string, unknown>
  readonly createdAt: string
}

// ─── Harvest ───

export interface HarvestRecord {
  readonly id: string
  readonly orgId: string
  readonly producerId: string
  readonly cropId: string
  readonly season: string
  readonly harvestDate: string
  readonly quantity: number
  readonly geoPoint: GeoPoint | null
  readonly notes: string | null
  readonly createdAt: string
}

// ─── Lot ───

export interface AggregationLot {
  readonly id: string
  readonly orgId: string
  readonly ref: string
  readonly cropId: string
  readonly season: string
  readonly totalWeight: number
  readonly status: LotStatus
  readonly createdAt: string
  readonly updatedAt: string
}

export interface LotContribution {
  readonly id: string
  readonly orgId: string
  readonly lotId: string
  readonly harvestId: string
  readonly weight: number
  readonly createdAt: string
}

// ─── Quality ───

export interface QualityInspection {
  readonly id: string
  readonly orgId: string
  readonly lotId: string
  readonly inspectorId: string
  readonly grade: string | null
  readonly score: number | null
  readonly defects: Record<string, unknown>
  readonly notes: string | null
  readonly inspectedAt: string
  readonly createdAt: string
}

// ─── Batch / Warehouse ───

export interface Warehouse {
  readonly id: string
  readonly orgId: string
  readonly name: string
  readonly location: Location | null
  readonly capacity: number | null
  readonly status: WarehouseStatus
  readonly createdAt: string
}

export interface InventoryBatch {
  readonly id: string
  readonly orgId: string
  readonly ref: string
  readonly warehouseId: string
  readonly cropId: string
  readonly totalWeight: number
  readonly availableWeight: number
  readonly status: BatchStatus
  readonly createdAt: string
  readonly updatedAt: string
}

export interface BatchAllocation {
  readonly id: string
  readonly orgId: string
  readonly batchId: string
  readonly lotId: string
  readonly weight: number
  readonly createdAt: string
}

// ─── Shipment ───

export interface ShipmentPlan {
  readonly id: string
  readonly orgId: string
  readonly ref: string
  readonly batchId: string
  readonly destination: ShipmentDestination
  readonly allocatedWeight: number
  readonly status: ShipmentStatus
  readonly plannedDeparture: string | null
  readonly plannedArrival: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface ShipmentDestination {
  readonly port?: string
  readonly country: string
  readonly buyer?: string
}

export interface ShipmentMilestone {
  readonly id: string
  readonly orgId: string
  readonly shipmentId: string
  readonly milestone: string
  readonly occurredAt: string
  readonly actorId: string
  readonly notes: string | null
  readonly createdAt: string
}

// ─── Payment ───

export interface PaymentDistributionPlan {
  readonly id: string
  readonly orgId: string
  readonly lotId: string
  readonly totalAmount: number
  readonly currency: string
  readonly status: PaymentPlanStatus
  readonly createdAt: string
  readonly updatedAt: string
}

export interface Payment {
  readonly id: string
  readonly orgId: string
  readonly planId: string
  readonly producerId: string
  readonly amount: number
  readonly method: PaymentMethod
  readonly reference: string | null
  readonly status: PaymentStatus
  readonly executedAt: string | null
  readonly createdAt: string
}

// ─── Certification ───

export interface CertificationArtifact {
  readonly id: string
  readonly orgId: string
  readonly lotId: string
  readonly certificationType: CertificationType
  readonly certificateRef: string | null
  readonly contentHash: string
  readonly storageKey: string | null
  readonly issuedAt: string
  readonly expiresAt: string | null
  readonly metadata: Record<string, unknown>
  readonly createdAt: string
}

// ─── Traceability ───

export interface TraceabilityChain {
  readonly id: string
  readonly orgId: string
  readonly sourceType: TraceabilityEntityType
  readonly sourceId: string
  readonly targetType: TraceabilityEntityType
  readonly targetId: string
  readonly linkMetadata: Record<string, unknown>
  readonly createdAt: string
}

// ─── Intelligence Outputs ───

export interface AgriForcast {
  readonly id: string
  readonly orgId: string
  readonly cropId: string
  readonly season: string
  readonly forecastType: ForecastType
  readonly value: number
  readonly confidence: number
  readonly modelVersion: string
  readonly computedAt: string
  readonly createdAt: string
}

export interface PriceSignal {
  readonly id: string
  readonly orgId: string
  readonly cropType: string
  readonly market: string
  readonly price: number
  readonly currency: string
  readonly source: string
  readonly observedAt: string
  readonly createdAt: string
}

export interface RiskScore {
  readonly id: string
  readonly orgId: string
  readonly scope: RiskScope
  readonly scopeId: string
  readonly riskType: RiskType
  readonly score: number
  readonly factors: Record<string, unknown>
  readonly computedAt: string
  readonly createdAt: string
}

// ─── Service Results ───

export interface AgriServiceResult<T> {
  readonly ok: boolean
  readonly data: T | null
  readonly error: string | null
  readonly auditEntries: readonly AgriAuditEntry[]
}

export interface AgriAuditEntry {
  readonly id: string
  readonly orgId: string
  readonly actorId: string
  readonly role: AgriOrgRole
  readonly entityType: string
  readonly targetEntityId: string
  readonly action: string
  readonly label: string
  readonly metadata: Record<string, unknown>
  readonly hash: string
  readonly timestamp: string
}

// ─── Evidence ───

export interface EvidenceArtifact {
  readonly label: string
  readonly sha256: string
  readonly mimeType: string
  readonly sizeBytes: number
}

export interface PackIndex {
  readonly schemaVersion: string
  readonly packType: string
  readonly orgId: string
  readonly createdAt: string
  readonly artifactCount: number
  readonly merkleRoot: string
  readonly artifacts: readonly EvidenceArtifact[]
  readonly [key: string]: unknown
}

export interface SealEnvelope {
  readonly algorithm: string
  readonly merkleRoot: string
  readonly signature: string
  readonly sealedAt: string
}

export interface EvidencePack extends PackIndex {
  readonly seal: SealEnvelope
}

// ─── Org Export ───

export interface OrgAgriExport {
  readonly exportedAt: string
  readonly orgId: string
  readonly packs: readonly PackIndex[]
  readonly totalPacks: number
}

// ─── Field / Parcel ───

export interface Field {
  readonly id: string
  readonly orgId: string
  readonly producerId: string
  readonly name: string
  readonly location: GeoPoint | null
  readonly areaHectares: number
  readonly cropType: CropType
  readonly soilType: string | null
  readonly metadata: Record<string, unknown>
  readonly createdAt: string
}

// ─── Crop Season ───

export interface CropSeason {
  readonly id: string
  readonly orgId: string
  readonly name: string
  readonly cropId: string
  readonly startDate: string
  readonly endDate: string | null
  readonly status: 'planning' | 'active' | 'complete'
  readonly metadata: Record<string, unknown>
  readonly createdAt: string
}

// ─── Collection Point ───

export interface CollectionPoint {
  readonly id: string
  readonly orgId: string
  readonly cooperativeId: string
  readonly name: string
  readonly location: Location | null
  readonly capacityKg: number | null
  readonly currentStockKg: number
  readonly managerName: string | null
  readonly status: 'active' | 'inactive'
  readonly createdAt: string
}

// ─── Supply Chain ───

export interface SupplyChainEvent {
  readonly id: string
  readonly orgId: string
  readonly chainId: string
  readonly stepType: SupplyChainStepType
  readonly status: SupplyChainStepStatus
  readonly timestamp: string
  readonly completedAt: string | null
  readonly location: GeoPoint | null
  readonly responsibleParty: { readonly id: string; readonly name: string; readonly role: string }
  readonly quantityKg: number | null
  readonly qualityGrade: string | null
  readonly notes: string | null
  readonly deviceId: string | null
  readonly provenanceRef: string | null
}

export interface SupplyChainRecord {
  readonly id: string
  readonly orgId: string
  readonly batchId: string
  readonly cropType: string
  readonly originCooperativeId: string
  readonly originProducerId: string
  readonly destination: string | null
  readonly events: readonly SupplyChainEvent[]
  readonly status: SupplyChainStatus
  readonly createdAt: string
  readonly updatedAt: string
}

// ─── Provenance ───

export interface ProvenanceTransformation {
  readonly step: string
  readonly description: string
  readonly appliedAt: string
  readonly appliedBy: string
}

export interface ProvenanceRecord {
  readonly id: string
  readonly orgId: string
  readonly sourceType: ProvenanceSourceType
  readonly source: string
  readonly rawInputRef: string | null
  readonly transformations: readonly ProvenanceTransformation[]
  readonly transformationVersion: string
  readonly outputHash: string
  readonly deviceId: string | null
  readonly verified: boolean
  readonly createdAt: string
}

// ─── Sync Metadata ───

export interface SyncMetadata {
  readonly localId: string
  readonly canonicalId: string | null
  readonly deviceId: string
  readonly lastSyncedAt: string | null
  readonly syncStatus: SyncStatus
  readonly conflictState: string | null
  readonly resolutionStrategy: ConflictResolutionStrategy
  readonly version: number
}

// ─── Intelligence Contracts ───

export interface SourceDataRef {
  readonly type: string
  readonly id: string
  readonly label?: string
}

export interface ExplainableOutput {
  readonly explanation: string
  readonly sourceDataRefs: readonly SourceDataRef[]
  readonly confidenceLevel: ConfidenceLevel
  readonly modelVersion: string
  readonly generatedAt: string
}

export interface IntelligenceRecommendation extends ExplainableOutput {
  readonly id: string
  readonly type: string
  readonly title: string
  readonly priority: 'critical' | 'high' | 'medium' | 'low'
  readonly actionable: boolean
  readonly suggestedAction: string | null
  readonly expiresAt: string | null
}

export interface IntelligenceAlert extends ExplainableOutput {
  readonly id: string
  readonly type: string
  readonly severity: 'critical' | 'warning' | 'info'
  readonly title: string
  readonly affectedEntities: readonly string[]
}

export interface IntelligenceInsight extends ExplainableOutput {
  readonly id: string
  readonly type: string
  readonly title: string
  readonly metricValue: number | null
  readonly metricUnit: string | null
  readonly comparisonPeriod: string | null
}

// ─── Forecast Contracts ───

export interface ForecastResult extends ExplainableOutput {
  readonly id: string
  readonly forecastType: ForecastType
  readonly cropId: string | null
  readonly regionId: string | null
  readonly season: string | null
  readonly predictedValue: number
  readonly confidenceRange: { readonly low: number; readonly high: number }
  readonly assumptions: readonly string[]
  readonly inputRefs: readonly string[]
}

// ─── Reporting Contracts ───

export interface ReportMetric {
  readonly key: string
  readonly label: string
  readonly value: number
  readonly unit: string
  readonly period: string
}

export interface AgriReport {
  readonly id: string
  readonly orgId: string
  readonly reportType: string
  readonly title: string
  readonly generatedAt: string
  readonly period: { readonly start: string; readonly end: string }
  readonly metrics: readonly ReportMetric[]
  readonly metadata: Record<string, unknown>
}
