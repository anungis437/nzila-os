/**
 * Orchestrator API instrumentation bootstrap.
 *
 * Exposes a single registration entrypoint for tracing and metrics so the app
 * has an explicit observability surface like the other GA-ready apps.
 */
import { initMetrics, initOtel } from '@nzila/os-core/telemetry'

export async function register(): Promise<void> {
  await initOtel({ appName: 'orchestrator-api' })
  initMetrics('orchestrator-api')
}
