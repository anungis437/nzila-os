import type { PipelineAlert, PipelineAlertResult } from '../types'

/**
 * Webhook adapter: POSTs the alert as JSON to PIPELINE_ALERT_WEBHOOK_URL.
 * Does nothing if the env var is not set.
 * Never hardcodes any URL.
 */
export async function sendWebhookAlert(alert: PipelineAlert): Promise<PipelineAlertResult> {
  const url = process.env.PIPELINE_ALERT_WEBHOOK_URL
  if (!url) {
    return { delivered: false, channels: ['webhook'], error: 'PIPELINE_ALERT_WEBHOOK_URL not set' }
  }

  try {
    const body = JSON.stringify({
      source: 'pipeline-alerting',
      severity: alert.severity,
      trigger: alert.trigger,
      pipelineName: alert.pipelineName,
      organizationId: alert.organizationId ?? null,
      runId: alert.runId ?? null,
      message: alert.message,
      freshnessLagMs: alert.freshnessLagMs ?? null,
      createdAt: alert.createdAt.toISOString(),
      metadata: alert.metadata ?? null,
    })

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

    if (!response.ok) {
      return {
        delivered: false,
        channels: ['webhook'],
        error: `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    return { delivered: true, channels: ['webhook'] }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { delivered: false, channels: ['webhook'], error: message }
  }
}
