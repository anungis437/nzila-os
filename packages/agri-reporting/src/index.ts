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
