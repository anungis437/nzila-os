import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import {
  getDlqEntries,
  getMarketplaceProviders,
  getProviderHealthDetail,
} from '../server-data'

describe('integrations server-data defensiveness', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns conservative provider health detail when upstream fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network down')
    }))

    const detail = await getProviderHealthDetail('slack')

    expect(detail.health.status).toBe('down')
    expect(detail.health.lastErrorCode).toBe('no_data')
    expect(detail.metrics.successRate).toBe(0)
  })

  it('returns empty DLQ when orgId is not supplied', async () => {
    const entries = await getDlqEntries()
    expect(entries).toEqual([])
  })

  it('returns catalog-driven marketplace providers as not installed by default', async () => {
    const providers = await getMarketplaceProviders()

    expect(providers.length).toBeGreaterThan(0)
    expect(providers.every((provider) => provider.installed === false)).toBe(true)
    expect(providers.every((provider) => provider.status === 'inactive')).toBe(true)
  })
})
