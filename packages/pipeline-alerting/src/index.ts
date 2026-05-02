import type {
  PipelineAlert,
  PipelineAlertChannel,
  PipelineAlertEvaluationInput,
  PipelineAlertResult,
  PipelineAlertSeverity,
  PipelineAlertTrigger,
} from './types'
import { sendConsoleAlert } from './adapters/console'
import { sendWebhookAlert } from './adapters/webhook'
import { sendNoopAlert } from './adapters/noop'

export type { PipelineAlert, PipelineAlertChannel, PipelineAlertEvaluationInput, PipelineAlertResult, PipelineAlertSeverity, PipelineAlertTrigger }

/**
 * Builds a PipelineAlert object from input fields.
 */
export function buildPipelineAlert(
  params: Omit<PipelineAlert, 'createdAt'> & { createdAt?: Date },
): PipelineAlert {
  return {
    ...params,
    createdAt: params.createdAt ?? new Date(),
  }
}

/**
 * Evaluates pipeline state and returns the alerts that should be emitted.
 * Returns an empty array if no alerts are warranted.
 */
export function evaluatePipelineAlerts(input: PipelineAlertEvaluationInput): PipelineAlert[] {
  const alerts: PipelineAlert[] = []
  const now = new Date()

  const base = {
    pipelineName: input.pipelineName,
    organizationId: input.organizationId,
    runId: input.runId,
    createdAt: now,
  }

  if (input.freshnessStatus === 'warning') {
    alerts.push({
      ...base,
      severity: 'warning',
      trigger: 'freshness_sla_warning',
      message: `Pipeline freshness SLA warning: lag ${input.freshnessLagMs ?? 'unknown'}ms`,
      freshnessLagMs: input.freshnessLagMs,
    })
  }

  if (input.freshnessStatus === 'breached') {
    alerts.push({
      ...base,
      severity: 'critical',
      trigger: 'freshness_sla_breach',
      message: `Pipeline freshness SLA breached: lag ${input.freshnessLagMs ?? 'unknown'}ms`,
      freshnessLagMs: input.freshnessLagMs,
    })
  }

  if (input.lastRunStatus === 'failure') {
    alerts.push({
      ...base,
      severity: 'critical',
      trigger: 'latest_run_failed',
      message: `Pipeline run failed for ${input.pipelineName}`,
    })
  }

  if (input.integritySeverity === 'critical') {
    alerts.push({
      ...base,
      severity: 'critical',
      trigger: 'aggregate_verification_failed',
      message: `Aggregate integrity check critical for ${input.pipelineName}`,
      metadata: { integritySeverity: input.integritySeverity, integrityValid: input.integrityValid },
    })
  } else if (input.integritySeverity === 'warning') {
    alerts.push({
      ...base,
      severity: 'warning',
      trigger: 'aggregate_verification_failed',
      message: `Aggregate integrity check warning for ${input.pipelineName}`,
      metadata: { integritySeverity: input.integritySeverity, integrityValid: input.integrityValid },
    })
  }

  if (
    input.maxAttempts !== undefined &&
    input.retryAttempt !== undefined &&
    input.retryAttempt >= input.maxAttempts
  ) {
    alerts.push({
      ...base,
      severity: 'critical',
      trigger: 'repeated_retry_failures',
      message: `Pipeline exceeded max retry attempts (${input.retryAttempt}/${input.maxAttempts})`,
      metadata: { retryAttempt: input.retryAttempt, maxAttempts: input.maxAttempts },
    })
  }

  return alerts
}

/**
 * Sends an alert through the configured channels.
 * Reads PIPELINE_ALERT_CHANNELS from env (comma-separated; defaults to 'console_log').
 * Never throws — delivery failures are captured in the result.
 * IMPORTANT: failed delivery must NOT hide the original pipeline failure.
 */
export async function sendPipelineAlert(alert: PipelineAlert): Promise<PipelineAlertResult> {
  // Determine channels from env — never hardcoded
  const channelsEnv = process.env.PIPELINE_ALERT_CHANNELS ?? 'console_log'
  const channels = channelsEnv
    .split(',')
    .map((c: string) => c.trim())
    .filter(Boolean) as PipelineAlertChannel[]

  // CI / noop environment
  if (process.env.CI === 'true' && !process.env.PIPELINE_ALERT_CHANNELS) {
    sendNoopAlert(alert)
    return { delivered: false, channels: [] }
  }

  let delivered = false
  let lastError: string | undefined
  const deliveredChannels: PipelineAlertChannel[] = []

  for (const channel of channels) {
    try {
      if (channel === 'console_log') {
        sendConsoleAlert(alert)
        deliveredChannels.push('console_log')
        delivered = true
      } else if (channel === 'webhook') {
        const result = await sendWebhookAlert(alert)
        if (result.delivered) {
          deliveredChannels.push('webhook')
          delivered = true
        } else {
          lastError = result.error
        }
      } else {
        // email/slack: not implemented; no-op with log
        sendNoopAlert(alert)
      }
    } catch (err) {
      // Intentionally swallow — delivery failures must NOT propagate
      lastError = err instanceof Error ? err.message : String(err)
    }
  }

  return { delivered, channels: deliveredChannels, error: lastError }
}
