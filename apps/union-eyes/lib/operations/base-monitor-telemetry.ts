import { logger, redactFields } from '@nzila/os-core/telemetry'
import type { OperationalMeasurement } from './arm-operational-probes'
import { BASE_WORKER_CODES } from './base-worker-scope'

export const BASE_OPERATIONAL_MEASUREMENTS = [
  'backup', ...BASE_WORKER_CODES, 'dependencies', 'audit', 'queue', 'mail',
] as const

/** A missing collector result must not turn Object.every([]) into success. */
export function baseOperationalReport(input: Record<string, OperationalMeasurement>) {
  const checks: Record<string, OperationalMeasurement> = Object.fromEntries(BASE_OPERATIONAL_MEASUREMENTS.map(name =>
    [name, input[name] ?? { state: 'fail', note: 'Required operational measurement is missing' }]))
  if (Object.keys(input).some(name => !(BASE_OPERATIONAL_MEASUREMENTS as readonly string[]).includes(name))) {
    checks.measurementContract = { state: 'fail', note: 'Unexpected operational measurements were received' }
  }
  const failures = Object.entries(checks).flatMap(([scope, check]) => check.state === 'ok' ? [] : [{ scope, reason: check.note }])
  return { checks, failures, attempted: Object.keys(checks).length,
    succeeded: Object.keys(checks).length - failures.length, ok: failures.length === 0 }
}

/** Flat JSON fields are consumed by the deployment's Azure log alert. The
 * shared logger emits info in production; the older app logger suppresses it. */
export function emitBaseOperationalMonitor(sourceSha: string, report: ReturnType<typeof baseOperationalReport>) {
  logger.info('UE_BASE_OPERATIONAL_MONITOR_V1', { event: 'UE_BASE_OPERATIONAL_MONITOR_V1', sourceSha,
    measuredAt: new Date().toISOString(), ok: report.ok, checks: redactFields(report.checks) })
}
