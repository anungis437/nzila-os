export type {
  AnonymizedDecisionAggregate,
  BenchmarkQuery,
  DecisionAggregate,
  DecisionAggregateInputRecord,
  DecisionAggregateOptions,
  DecisionAggregatePack,
  DecisionAggregateRow,
  DecisionAggregateSource,
  DecisionBenchmark,
  NarAggregateSource,
} from './types'

export { aggregateDecisionRecords, aggregateNarExportPack, buildDecisionBenchmarks, getBenchmark } from './aggregator'
export { anonymizeAggregate, anonymizeAggregates } from './anonymization'
export {
  computeFreshnessLag,
  evaluateFreshnessSla,
  FRESHNESS_BREACH_THRESHOLD_MS,
  FRESHNESS_WARNING_THRESHOLD_MS,
} from './freshness'
export type { FreshnessStatus } from './freshness'
export {
  verifyAggregateCompleteness,
  verifyAggregateConsistency,
  detectAggregateAnomalies,
  buildAggregateIntegrityReport,
} from './integrity'
export type { AggregateIntegrityCheck, AggregateIntegrityReport } from './integrity'