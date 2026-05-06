/**
 * @nzila/otel-core — Base OpenTelemetry SDK with evidence correlation
 *
 * Builds on @nzila/os-core/telemetry to add:
 * - Nzila-specific span attributes (orgId, workflowId)
 * - Cost attribution telemetry
 * - Evidence-trace correlation
 * - SLO burn-rate alerting
 */

export { createNzilaSpan, withNzilaSpan, addNzilaAttributes } from './spans';
export { attributeCost, type CostAttribution, type ResourceMetrics } from './cost-attribution';
export {
  EvidenceSpanProcessor,
  verifyEvidenceTrace,
  injectTraceContext,
  type EvidenceTraceContext,
} from './evidence-correlation';
export {
  SLOMonitor,
  evaluateBurnRate,
  type SLODefinition,
  type BurnRateAlert,
} from './slo';
