/**
 * @nzila/platform-anomaly-engine — barrel exports
 *
 * Statistical anomaly detection: z-score, IQR, Grubbs, EMA bands,
 * seasonal decomposition, CUSUM change-point detection, and
 * multi-metric correlation analysis.
 */

export type {
  AnomalyType,
  AnomalySeverity,
  Anomaly,
  AnomalyRule,
  MetricDataPoint,
} from './types'

export { anomalySchema, anomalyRuleSchema } from './types'

export {
  detectGrievanceSpike,
  detectFinancialIrregularity,
  detectPricingOutlier,
  detectPartnerPerformanceDrop,
} from './detectors'

export { getDefaultRules, findRule } from './rules'

// ── Statistical Methods ─────────────────────────────────────────────────────

export {
  // Core statistics
  mean,
  median,
  standardDeviation,
  medianAbsoluteDeviation,
  scaledMAD,
  // Z-score detectors
  modifiedZScore,
  classicalZScore,
  // IQR (Tukey's fences)
  iqrDetect,
  // Grubbs' test
  grubbsTest,
  // EMA with adaptive bands
  emaWithBands,
  // Seasonal decomposition
  seasonalDecompose,
  // Multi-metric correlation
  pearsonCorrelation,
  correlationMatrix,
  // Change-point detection (CUSUM)
  cusumDetect,
} from './statistics'

export type {
  ZScoreResult,
  IQRResult,
  GrubbsResult,
  EMABand,
  SeasonalDecomposition,
  CorrelationResult,
  ChangePoint,
} from './statistics'
