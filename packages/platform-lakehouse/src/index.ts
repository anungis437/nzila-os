/**
 * @nzila/platform-lakehouse
 *
 * Nzila Knowledge Lakehouse — unified data intelligence layer.
 *
 * Aggregates app telemetry, public Canadian data sources, funding intelligence,
 * deal pipeline, and partner intelligence into a single queryable warehouse.
 *
 * Architecture position:
 *   Sources → ingestion-core → platform-data-fabric
 *           → platform-lakehouse (warehouse schema + catalogs)
 *           → platform-intelligence → apps/console
 *
 * @module @nzila/platform-lakehouse
 */

// ── Core Types ──────────────────────────────────────────────────────────────

export {
  WarehouseDomains,
  DataSourceCategories,
  DataSourceFormats,
  RefreshCadences,
  FundingTypes,
  FundingGovernments,
  StrategicAgreementTypes,
  SponsorCategories,
  LakehouseIngestionStatuses,
  dataSourceDescriptorSchema,
  fundingProgramSchema,
} from './types'

export type {
  WarehouseDomain,
  DataSourceCategory,
  DataSourceFormat,
  RefreshCadence,
  FundingType,
  FundingGovernment,
  StrategicAgreementType,
  SponsorCategory,
  DataSourceDescriptor,
  FundingProgram,
  SponsorTarget,
  LakehouseIngestionStatus,
  LakehouseIngestionJob,
} from './types'

// ── Public Data Source Catalog ──────────────────────────────────────────────

export {
  PUBLIC_DATA_SOURCES,
  getSourcesForDomain,
  getSourcesByCategory,
  getIngestableSources,
} from './catalog'

// ── Canadian Funding Radar ──────────────────────────────────────────────────

export {
  CANADIAN_FUNDING_PROGRAMS,
  getFundingForDomain,
  getFundingByType,
  getRollingPrograms,
  getFundingByBudget,
} from './funding-radar'

// ── Warehouse Schema ────────────────────────────────────────────────────────

export {
  warehouseProductMetricSchema,
  warehouseDealEntrySchema,
  warehouseFundingApplicationSchema,
  warehousePartnerSchema,
  warehouseDataSourceSyncSchema,
  warehousePublicDataDocSchema,
  WAREHOUSE_TABLES,
} from './warehouse-schema'

export type {
  WarehouseProductMetric,
  WarehouseDealEntry,
  WarehouseFundingApplication,
  WarehousePartner,
  WarehouseDataSourceSync,
  WarehousePublicDataDoc,
  WarehouseTable,
} from './warehouse-schema'
