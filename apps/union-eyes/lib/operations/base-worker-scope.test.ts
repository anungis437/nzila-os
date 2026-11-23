import { describe, expect, it } from 'vitest'
import scheduled from './scheduled-jobs.json'
import { BASE_WORKER_CADENCES, BASE_WORKER_CODES } from './base-worker-scope'
import { BASE_OPERATIONAL_MEASUREMENTS } from './base-monitor-telemetry'
import { parseOperationalArmConfiguration } from './arm-operational-probes'

describe('active base workers and dormant generic signing boundary', () => {
  it('retains every active worker with its unchanged cadence in the shared manifest', () => {
    expect(BASE_WORKER_CADENCES).toEqual({ dlrem: 5, dlovd: 15, alert: 10, sla: 15, reap: 30 })
    expect(BASE_WORKER_CODES).toEqual(Object.keys(BASE_WORKER_CADENCES))
    expect(BASE_OPERATIONAL_MEASUREMENTS.filter(name => name in BASE_WORKER_CADENCES)).toEqual(BASE_WORKER_CODES)
    expect(BASE_OPERATIONAL_MEASUREMENTS).toHaveLength(10)
    expect(scheduled.jobs.find(job => job.code === 'sigexp')).toMatchObject({ stagingManualOnly: true })
    expect(BASE_WORKER_CODES).not.toContain('sigexp')
  })
  it('rejects a dormant worker in place of any required active worker', () => {
    const group = '/subscriptions/11111111-1111-4111-8111-111111111111/resourceGroups/ue-staging'
    const jobs = BASE_WORKER_CODES.map(code => ({ code, resourceId: `${group}/providers/Microsoft.App/jobs/ue-${code}` }))
    const configuration = { postgresResourceId: `${group}/providers/Microsoft.DBforPostgreSQL/flexibleServers/ue-db`, jobs }
    expect(parseOperationalArmConfiguration(JSON.stringify(configuration)).jobs).toHaveLength(5)
    for (let i = 0; i < jobs.length; i++) {
      const replaced = jobs.map((job, index) => index === i ? { ...job, code: 'sigexp' } : job)
      expect(() => parseOperationalArmConfiguration(JSON.stringify({ ...configuration, jobs: replaced }))).toThrow()
    }
  })
})
