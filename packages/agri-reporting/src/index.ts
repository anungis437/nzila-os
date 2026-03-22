// ---------------------------------------------------------------------------
// @nzila/agri-reporting — barrel export
// ---------------------------------------------------------------------------

export {
  ReportType,
  type ReportTypeValue,
  metric,
  type BuildReportParams,
  buildReport,
  aggregateMetrics,
  mergeReportMetrics,
  buildCompositeReport,
} from './engine.js'

export {
  type GovReportRow,
  type GovReport,
  toGovReport,
  toCSV,
  type ReportSummary,
  toSummary,
} from './formats.js'

export {
  CANONICAL_SCHEMA_VERSION,
  SourceApp,
  type SourceAppValue,
  EntityScope,
  type EntityScopeValue,
  canonicalMetricSchema,
  type CanonicalMetric,
  canonicalForecastSchema,
  type CanonicalForecast,
  canonicalRiskSignalSchema,
  type CanonicalRiskSignal,
  canonicalSupplyChainEventSchema,
  type CanonicalSupplyChainEvent,
  canonicalProvenanceRefSchema,
  type CanonicalProvenanceRef,
  canonicalExtensionsSchema,
  type CanonicalExtensions,
  canonicalReportSchema,
  type CanonicalReport,
  type BuildCanonicalReportParams,
  buildCanonicalReport,
} from './canonical-reporting-schema.js'

export {
  type ValidationOk,
  type ValidationFail,
  type ValidationResult,
  validateCanonicalReport,
} from './validate-canonical-report.js'

export {
  coraGovRowSchema,
  type CoraGovRow,
  coraGovPayloadSchema,
  type CoraGovPayload,
  type IngestionOk,
  type IngestionRejected,
  type IngestionResult,
  canonicalToCoraGovRows,
  buildCoraGovPayload,
} from './coragov-ingestion-contract.js'

export {
  simulateCoraGovIngestion,
  serializeForIngestion,
} from './coragov-ingestion-harness.js'
