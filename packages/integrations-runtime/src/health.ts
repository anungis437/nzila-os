/**
 * Nzila OS — Integration Runtime: Health checker
 *
 * Runs health checks across all registered adapters.
 */
import type {
  HealthCheckResult,
  IntegrationAdapter,
  IntegrationProvider,
  IntegrationType,
} from '@nzila/integrations-core'

export interface HealthCheckerPorts {
  listAdapters(): readonly IntegrationAdapter[]
  getCredentials(provider: IntegrationProvider, channel: IntegrationType): Promise<Record<string, unknown>>
}

export interface AggregateHealthResult {
  readonly overall: 'ok' | 'degraded' | 'down'
  readonly results: readonly HealthCheckResult[]
  readonly checkedAt: string
}

export async function checkAllIntegrations(
  ports: HealthCheckerPorts,
): Promise<AggregateHealthResult> {
  const adapters = ports.listAdapters()
  const results: HealthCheckResult[] = []

  for (const adapter of adapters) {
    try {
      const creds = await ports.getCredentials(adapter.provider, adapter.channel)
      const result = await adapter.healthCheck(creds)
      results.push(result)
    } catch (err) {
      results.push({
        provider: adapter.provider,
        status: 'down',
        latencyMs: 0,
        details: err instanceof Error ? err.message : String(err),
        checkedAt: new Date().toISOString(),
      })
    }
  }

  const hasDown = results.some((r) => r.status === 'down')
  const hasDegraded = results.some((r) => r.status === 'degraded')
  const overall = hasDown ? 'down' : hasDegraded ? 'degraded' : 'ok'

  return {
    overall,
    results,
    checkedAt: new Date().toISOString(),
  }
}
