import { describe, it, expect, vi } from 'vitest'
import {
  checkOrgBudget,
  shouldBlockRequest,
  type BudgetPorts,
  type BudgetCheckResult,
} from './budget'

const ORG_ID = '00000000-0000-0000-0000-000000000001'

function makeBudgetPorts(overrides?: Partial<BudgetPorts>): BudgetPorts {
  return {
    getOrgBudgetPolicy: vi.fn().mockResolvedValue(null),
    getOrgDailySpend: vi.fn().mockResolvedValue(0),
    getOrgMonthlySpend: vi.fn().mockResolvedValue(0),
    getOrgCategorySpend: vi.fn().mockResolvedValue([]),
    recordBudgetBreach: vi.fn().mockResolvedValue(undefined),
    emitAudit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('checkOrgBudget', () => {
  it('returns ok when no policy exists', async () => {
    const ports = makeBudgetPorts()
    const result = await checkOrgBudget(ORG_ID, ports)
    expect(result.state).toBe('ok')
    expect(result.enforced).toBe(false)
  })

  it('returns ok when under budget', async () => {
    const ports = makeBudgetPorts({
      getOrgBudgetPolicy: vi.fn().mockResolvedValue({
        orgId: ORG_ID,
        dailyBudgetUsd: 100,
        monthlyBudgetUsd: 3000,
        enforce: true,
        exemptRoutes: [],
      }),
      getOrgDailySpend: vi.fn().mockResolvedValue(50),
      getOrgMonthlySpend: vi.fn().mockResolvedValue(500),
    })
    const result = await checkOrgBudget(ORG_ID, ports)
    expect(result.state).toBe('ok')
    expect(result.enforced).toBe(true)
  })

  it('returns warning at 80% utilization', async () => {
    const ports = makeBudgetPorts({
      getOrgBudgetPolicy: vi.fn().mockResolvedValue({
        orgId: ORG_ID,
        dailyBudgetUsd: 100,
        monthlyBudgetUsd: 3000,
        enforce: true,
        exemptRoutes: [],
      }),
      getOrgDailySpend: vi.fn().mockResolvedValue(85),
      getOrgMonthlySpend: vi.fn().mockResolvedValue(500),
    })
    const result = await checkOrgBudget(ORG_ID, ports)
    expect(result.state).toBe('warning')
  })

  it('keeps utilization at zero when budgets are zero', async () => {
    const ports = makeBudgetPorts({
      getOrgBudgetPolicy: vi.fn().mockResolvedValue({
        orgId: ORG_ID,
        dailyBudgetUsd: 0,
        monthlyBudgetUsd: 0,
        enforce: true,
        exemptRoutes: [],
      }),
      getOrgDailySpend: vi.fn().mockResolvedValue(0),
      getOrgMonthlySpend: vi.fn().mockResolvedValue(0),
    })

    const result = await checkOrgBudget(ORG_ID, ports)

    expect(result.state).toBe('ok')
    expect(result.dailyUtilization).toBe(0)
    expect(result.monthlyUtilization).toBe(0)
  })

  it('returns exceeded when daily budget breached', async () => {
    const ports = makeBudgetPorts({
      getOrgBudgetPolicy: vi.fn().mockResolvedValue({
        orgId: ORG_ID,
        dailyBudgetUsd: 100,
        monthlyBudgetUsd: 3000,
        enforce: true,
        exemptRoutes: [],
      }),
      getOrgDailySpend: vi.fn().mockResolvedValue(150),
      getOrgMonthlySpend: vi.fn().mockResolvedValue(500),
    })
    const result = await checkOrgBudget(ORG_ID, ports)
    expect(result.state).toBe('exceeded')
    expect(ports.recordBudgetBreach).toHaveBeenCalledOnce()
    expect(ports.emitAudit).toHaveBeenCalledOnce()
  })

  it('detects category breaches', async () => {
    const ports = makeBudgetPorts({
      getOrgBudgetPolicy: vi.fn().mockResolvedValue({
        orgId: ORG_ID,
        dailyBudgetUsd: 1000,
        monthlyBudgetUsd: 30000,
        enforce: true,
        exemptRoutes: [],
        categoryCaps: [{ category: 'integration_call', dailyLimit: 100 }],
      }),
      getOrgDailySpend: vi.fn().mockResolvedValue(50),
      getOrgMonthlySpend: vi.fn().mockResolvedValue(500),
      getOrgCategorySpend: vi.fn().mockResolvedValue([
        { category: 'integration_call', spent: 150 },
      ]),
    })
    const result = await checkOrgBudget(ORG_ID, ports)
    expect(result.state).toBe('exceeded')
    expect(result.categoryBreaches).toHaveLength(1)
    expect(result.categoryBreaches[0].category).toBe('integration_call')
  })
})

describe('shouldBlockRequest', () => {
  const baseResult: BudgetCheckResult = {
    orgId: ORG_ID,
    state: 'exceeded',
    dailySpendUsd: 150,
    dailyBudgetUsd: 100,
    monthlySpendUsd: 500,
    monthlyBudgetUsd: 3000,
    dailyUtilization: 1.5,
    monthlyUtilization: 0.17,
    categoryBreaches: [],
    lastBreachAt: new Date(),
    enforced: true,
  }

  it('blocks non-exempt routes when exceeded', () => {
    const result = shouldBlockRequest(baseResult, '/api/orgs/123/invoices')
    expect(result.blocked).toBe(true)
    expect(result.statusCode).toBe(402)
  })

  it('allows admin routes when exceeded', () => {
    const result = shouldBlockRequest(baseResult, '/api/admin/settings')
    expect(result.blocked).toBe(false)
  })

  it('allows export routes when exceeded', () => {
    const result = shouldBlockRequest(baseResult, '/api/export/proof-pack')
    expect(result.blocked).toBe(false)
  })

  it('allows proof routes when exceeded', () => {
    const result = shouldBlockRequest(baseResult, '/api/proof/latest')
    expect(result.blocked).toBe(false)
  })

  it('allows health endpoint when exceeded', () => {
    const result = shouldBlockRequest(baseResult, '/api/health')
    expect(result.blocked).toBe(false)
  })

  it('does not block when not enforced', () => {
    const result = shouldBlockRequest({ ...baseResult, enforced: false }, '/api/orgs/123/invoices')
    expect(result.blocked).toBe(false)
  })

  it('does not block when state is ok', () => {
    const result = shouldBlockRequest({ ...baseResult, state: 'ok' }, '/api/orgs/123/invoices')
    expect(result.blocked).toBe(false)
  })
})
