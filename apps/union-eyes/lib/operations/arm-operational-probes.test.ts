import { afterEach, describe, expect, it, vi } from 'vitest'
import { armPageUrl, BASE_WORKER_CADENCES, measureAutomaticBackup, measureWorkerExecutions,
  parseOperationalArmConfiguration, probeAzureOperations } from './arm-operational-probes'

const mocks = vi.hoisted(() => ({ token: vi.fn() }))
vi.mock('@azure/identity', () => ({ ManagedIdentityCredential: class { getToken = mocks.token } }))
const group = '/subscriptions/11111111-1111-4111-8111-111111111111/resourceGroups/ue-staging'
const database = `${group}/providers/Microsoft.DBforPostgreSQL/flexibleServers/ue-staging-db`
const job = `${group}/providers/Microsoft.App/jobs/ue-staging-job`
const configuration = { postgresResourceId: database,
  jobs: Object.keys(BASE_WORKER_CADENCES).map(code => ({ code, resourceId: `${job}-${code}` })) }
const now = Date.parse('2026-11-17T08:00:00Z')
const at = (minutes: number) => new Date(now - minutes * 60_000).toISOString()
const backup = (minutes: number) => ({ properties: { backupType: 'Full', source: 'Automatic', completedTime: at(minutes) } })
const run = (status: string, start: number, end?: number) => ({ properties: { status, startTime: at(start), ...(end === undefined ? {} : { endTime: at(end) }) } })
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('measured backup and core worker freshness', () => {
  it('requires a real recent automatic full backup, independent of response order', () => {
    expect(measureAutomaticBackup([backup(3000), backup(60), backup(2500)], now).state).toBe('ok')
    expect(measureAutomaticBackup([backup(1600)], now).state).toBe('fail')
    expect(measureAutomaticBackup([backup(-10)], now).state).toBe('fail')
    expect(measureAutomaticBackup([], now).state).toBe('fail')
    expect(measureAutomaticBackup([{ properties: { ...backup(1).properties, source: 'Customer Initiated' } }], now).state).toBe('fail')
  })
  it('refuses malformed timestamps and never treats an unmeasured backup as healthy', () => {
    expect(measureAutomaticBackup([{ properties: { ...backup(1).properties, completedTime: 'bad' } }], now).state).toBe('fail')
    expect(measureAutomaticBackup([{}], now).state).toBe('fail')
  })
  it('requires actual completed successful execution within each declared cadence budget', () => {
    expect(measureWorkerExecutions([run('Failed', 30, 29), run('Succeeded', 5, 4)], 5, now).state).toBe('ok')
    expect(measureWorkerExecutions([run('Succeeded', 20, 19)], 5, now).state).toBe('fail')
    expect(measureWorkerExecutions([run('Succeeded', 20, 19)], 30, now).state).toBe('ok')
    expect(measureWorkerExecutions([run('Succeeded', 1)], 5, now).state).toBe('fail')
    expect(measureWorkerExecutions([run('Running', 1)], 5, now).state).toBe('fail')
  })
  it('detects newer failures, stuck runs and impossible clocks even with an earlier success', () => {
    for (const latest of [run('Failed', 1, 0), run('Unknown', 1), run('Running', 6), run('Succeeded', -10, -11)]) {
      expect(measureWorkerExecutions([run('Succeeded', 10, 9), latest], 5, now).state).toBe('fail')
    }
    expect(measureWorkerExecutions([run('Succeeded', 10, 9), run('Running', 1)], 5, now).state).toBe('ok')
  })
  it('binds exactly the six core job resources to the database resource group', () => {
    expect(parseOperationalArmConfiguration(JSON.stringify(configuration)).jobs).toHaveLength(6)
    for (const invalid of [{}, { ...configuration, jobs: [] }, { ...configuration, jobs: configuration.jobs.map(() => configuration.jobs[0]) },
      { ...configuration, jobs: configuration.jobs.map(j => ({ ...j, resourceId: j.resourceId.replace('ue-staging/', 'elsewhere/') })) }]) {
      expect(() => parseOperationalArmConfiguration(JSON.stringify(invalid))).toThrow('CONFIGURATION_INVALID')
    }
  })
  it('will not forward an ARM token to a redirect, other resource, other origin or URL credential', () => {
    expect(armPageUrl(database, 'backups').searchParams.get('api-version')).toBe('2025-08-01')
    for (const next of ['https://example.invalid', `https://management.azure.com${job}/executions`,
      `https://user:pass@management.azure.com${database}/backups`, `http://management.azure.com${database}/backups`]) {
      expect(() => armPageUrl(database, 'backups', next)).toThrow('PAGE_SCOPE_INVALID')
    }
  })
  it('strips raw execution templates and secrets from collected results', async () => {
    vi.useFakeTimers(); vi.setSystemTime(now)
    mocks.token.mockResolvedValue({ token: 'synthetic-access-only' })
    const fetcher = vi.fn(async (url: URL) => ({ ok: true, json: async () => ({ value:
      url.pathname.endsWith('/backups') ? [backup(60)] : [{ ...run('Succeeded', 5, 4),
        name: 'private-name', template: { env: [{ name: 'SECRET', value: 'never-serialize-this-value' }] } }] }) }))
    vi.stubGlobal('fetch', fetcher)
    try {
      const result = await probeAzureOperations(parseOperationalArmConfiguration(JSON.stringify(configuration)), '11111111-1111-4111-8111-111111111111')
      expect(Object.values(result).every(check => check.state === 'ok')).toBe(true)
      expect(JSON.stringify(result)).not.toContain('never-serialize')
      expect(fetcher).toHaveBeenCalledTimes(7)
    } finally { vi.useRealTimers() }
  })
  it('fails every measurement if identity access is unavailable and sanitizes provider errors', async () => {
    mocks.token.mockRejectedValue(new Error('secret-and-provider-internals'))
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    const result = await probeAzureOperations(parseOperationalArmConfiguration(JSON.stringify(configuration)), '11111111-1111-4111-8111-111111111111')
    expect(Object.values(result).every(check => check.state === 'fail')).toBe(true)
    expect(fetcher).not.toHaveBeenCalled()
    expect(JSON.stringify(result)).not.toContain('provider-internals')
  })
})
