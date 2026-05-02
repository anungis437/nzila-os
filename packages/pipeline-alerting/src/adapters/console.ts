import type { PipelineAlert } from '../types'

/**
 * Console adapter: logs the alert as structured JSON to stdout.
 */
export function sendConsoleAlert(alert: PipelineAlert): void {
  console.log(
    JSON.stringify({
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
    }),
  )
}
