import { beforeEach, describe, expect, it, vi } from 'vitest'

const captured = vi.hoisted(() => ({ options: [] as Array<Record<string, unknown>> }))
vi.mock('@/lib/api/framework', () => ({
  withApi: (options: Record<string, unknown>, handler: unknown) => {
    captured.options.push(options)
    return handler
  },
}))

const metricModules = {
  mrr: () => import('../platform/metrics/mrr/route'),
  churn: () => import('../platform/metrics/churn/route'),
  'unit-economics': () => import('../platform/metrics/unit-economics/route'),
}

beforeEach(() => { captured.options.length = 0; vi.resetModules() })

describe('DEF-0B10-OPL-12 platform financial metrics are never fabricated', () => {
  it.each(['mrr', 'churn', 'unit-economics'])('%s returns 501 with no fake financial or usage figures', async (metric) => {
    const module = await metricModules[metric as keyof typeof metricModules]()
    expect(captured.options[0]).toMatchObject({ auth: { required: true, minRole: 'system_admin' } })
    const response = await (module.GET as any)({})
    expect(response.status).toBe(501)
    expect(response.headers.get('cache-control')).toContain('no-store')
    const body = await response.json()
    expect(body).toMatchObject({ capability: `platform.metrics.${metric}`, capabilityState: 'NOT_IMPLEMENTED' })
    expect(body.error).toBe(`PLATFORM_${metric.replace(/-/g, '_').toUpperCase()}_NOT_IMPLEMENTED`)
    expect(body).not.toHaveProperty('activeUsers')
    expect(body).not.toHaveProperty('requestsToday')
    expect(body).not.toHaveProperty('errorRate')
    expect(body).not.toHaveProperty('mrr')
    expect(body).not.toHaveProperty('churn')
    expect(body).not.toHaveProperty('unitEconomics')
  })
})
