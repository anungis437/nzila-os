import { afterEach, describe, expect, it, vi } from 'vitest'
import { BASE_OPERATIONAL_MEASUREMENTS, baseOperationalReport, emitBaseOperationalMonitor } from './base-monitor-telemetry'

const healthy = () => Object.fromEntries(BASE_OPERATIONAL_MEASUREMENTS.map(name => [name, { state: 'ok' as const, note: 'Measured fixture' }]))

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs() })
describe('production monitor output consumed by the external alert', () => {
  it.each(['ok', 'fail'] as const)('emits a parseable flat heartbeat with state %s in production', state => {
    vi.stubEnv('NODE_ENV', 'production')
    const stdout = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const source = 'a'.repeat(40)
    emitBaseOperationalMonitor(source, baseOperationalReport({ ...healthy(), backup: { state, note: 'Measured fixture' } }))
    expect(stdout).toHaveBeenCalledTimes(1)
    const record = JSON.parse(stdout.mock.calls[0][0] as string)
    // The actual KQL reads j.event/j.ok, not a development-only message or
    // a nested context. A silent production info logger would fail this seam.
    expect(record.event).toBe('UE_BASE_OPERATIONAL_MONITOR_V1')
    expect(record.ok).toBe(state === 'ok')
    expect(record.sourceSha).toBe(source)
    expect(Date.parse(record.measuredAt)).toBeGreaterThan(0)
    expect(record.checks.backup.state).toBe(state)
  })

  it('fails closed for an empty or incomplete set of measurements', () => {
    expect(baseOperationalReport({})).toMatchObject({ ok: false, attempted: 11, succeeded: 0 })
    const checks = healthy(); delete checks.mail
    expect(baseOperationalReport(checks)).toMatchObject({ ok: false, attempted: 11, succeeded: 10,
      failures: [{ scope: 'mail', reason: 'Required operational measurement is missing' }] })
  })

  it('does not emit unexpected raw fields as healthy measurement names', () => {
    const stdout = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const report = baseOperationalReport({ ...healthy(), privatePayload: { state: 'ok', note: 'do-not-emit-this' } })
    expect(report.ok).toBe(false)
    emitBaseOperationalMonitor('a'.repeat(40), report)
    expect(stdout.mock.calls[0][0]).not.toContain('do-not-emit-this')
  })
})
