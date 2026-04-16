/**
 * Orchestrator API instrumentation bootstrap.
 */
import { initMetrics, initOtel } from '@nzila/os-core/telemetry'

export async function register(): Promise<void> {
  await initOtel({ appName: 'orchestrator-api' })
  initMetrics('orchestrator-api')
}
