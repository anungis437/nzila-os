/**
 * @nzila/platform-governed-ai — Instrumented Operations
 *
 * Wraps governed AI operations with telemetry from platform-observability.
 * Every AI run emits structured lifecycle events:
 *   context_built → policy_checked → model_invoked → result_persisted
 */
import type { AIRunRecord } from './types'
import { executeGovernedAIRun, type ExecuteAIRunOptions } from './operations'
import {
  aiRunTelemetry,
  governanceTelemetry,
} from '@nzila/platform-observability'
import { createLogger } from '@nzila/platform-observability'

const logger = createLogger({ org_id: 'platform' })

// ── Instrumented AI Run ─────────────────────────────────────────────────────

/**
 * Execute a governed AI run with full telemetry instrumentation.
 *
 * Telemetry emitted:
 *   - `ai_reasoning_runs_total` counter
 *   - `ai_reasoning_latency_ms` histogram
 *   - `ai_citation_coverage_pct` gauge (if applicable)
 *   - `governance_policy_violations_total` (on policy block)
 *   - `governance_audit_events_total` (run lifecycle events)
 *   - Structured logs for each lifecycle phase
 */
export async function executeInstrumentedAIRun(
  options: ExecuteAIRunOptions,
): Promise<AIRunRecord> {
  const runId = crypto.randomUUID()
  const profileKey = options.request.operationType
  const tel = aiRunTelemetry(runId, profileKey)
  const gov = governanceTelemetry(options.request.tenantId)

  // Log context info
  tel.contextBuilt(options.evidence?.length ?? 0)

  logger.info('ai_run_started', {
    runId,
    operationType: options.request.operationType,
    entityType: options.request.entityType,
    resourceId: options.request.resourceId,
    tenantId: options.request.tenantId,
    modelId: options.request.modelId,
  })

  // Execute the core governed AI run
  const result = await executeGovernedAIRun(options)

  // Emit telemetry based on outcome
  if (result.status === 'rejected_by_policy') {
    const violations = result.policyConstraints.filter((p) => !p.satisfied).length
    tel.policyChecked(false, violations)
    gov.policyEvaluated(profileKey, false)

    logger.warn('ai_run_rejected_by_policy', {
      runId: result.id,
      operationType: result.operationType,
      violations,
      reasoning: result.reasoning,
      latencyMs: result.latencyMs,
    })
  } else if (result.status === 'failed') {
    tel.policyChecked(true, 0)
    tel.modelInvoked(result.modelId)

    logger.error('ai_run_failed', {
      runId: result.id,
      operationType: result.operationType,
      reasoning: result.reasoning,
      latencyMs: result.latencyMs,
    })
  } else {
    // completed
    tel.policyChecked(true, 0)
    tel.modelInvoked(result.modelId)

    if (result.evidence && result.evidence.length > 0) {
      const coveragePct = result.confidence != null ? result.confidence * 100 : 0
      tel.citationsAttached(result.evidence.length, coveragePct)
    }

    tel.resultPersisted()
    gov.auditEmitted('ai_run_completed', {
      runId: result.id,
      operationType: result.operationType,
      modelId: result.modelId,
      confidence: result.confidence,
    })

    logger.info('ai_run_completed', {
      runId: result.id,
      operationType: result.operationType,
      confidence: result.confidence,
      latencyMs: result.latencyMs,
    })
  }

  return result
}
