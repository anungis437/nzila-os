/**
 * Commerce observability — Flow app.
 *
 * Wires @nzila/commerce-observability for quote lifecycle telemetry:
 * transition logging, saga metrics, and health checks.
 */
export {
  logTransition,
  logSagaExecution,
  logGovernanceGate,
  logEvidencePack,
  logAuditTrail,
  buildTransitionSpanAttrs,
  buildSagaSpanAttrs,
  COMMERCE_SPAN,
  COMMERCE_METRIC,
  commerceMetrics,
  COMMERCE_HEALTH_CHECKS,
  buildHealthResult,
  aggregateHealth,
} from '@nzila/commerce-observability'
