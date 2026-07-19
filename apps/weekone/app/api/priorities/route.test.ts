import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getDb: vi.fn(),
  calculateRunway: vi.fn(),
  rankPriorities: vi.fn(),
  dbExecute: vi.fn(),
}))

vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: mocks.auth,
}))

vi.mock('@/lib/db', () => ({
  getDb: mocks.getDb,
}))

vi.mock('@/domain/runway', () => ({
  calculateRunway: mocks.calculateRunway,
}))

vi.mock('@/domain/priorities', () => ({
  rankPriorities: mocks.rankPriorities,
}))

vi.mock('drizzle-orm', () => ({
  sql: (_parts: TemplateStringsArray) => ({ text: 'sql' }),
}))

import { GET } from './route'

describe('GET /api/priorities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ userId: 'user_1' })
    mocks.rankPriorities.mockReturnValue([{ key: 'revenue' }])
    mocks.calculateRunway.mockReturnValue(180)
    mocks.dbExecute.mockResolvedValue({ rows: [] })
    mocks.getDb.mockResolvedValue({ execute: mocks.dbExecute })
  })

  it('returns 401 when unauthenticated', async () => {
    mocks.auth.mockResolvedValue({ userId: null })

    const response = await GET()
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' })
  })

  it('returns default priorities when db is unavailable', async () => {
    mocks.getDb.mockResolvedValue(null)

    const response = await GET()
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: [{ key: 'revenue' }] })
    expect(mocks.rankPriorities).toHaveBeenCalledWith({
      runwayDays: 180,
      pipelineValue: 0,
      overdueInvoices: 0,
    })
  })

  it('returns computed priorities when db queries succeed', async () => {
    mocks.dbExecute
      .mockResolvedValueOnce({
        rows: [{ cash_on_hand: 100000, monthly_burn: 20000, overdue_invoices: 2 }],
      })
      .mockResolvedValueOnce({
        rows: [{ weighted: 45000, top_name: 'Big Deal', top_value: 90000 }],
      })
    mocks.calculateRunway.mockReturnValue(150)

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: [{ key: 'revenue' }] })
    expect(mocks.calculateRunway).toHaveBeenCalledWith({
      cashOnHand: 100000,
      monthlyBurn: 20000,
    })
    expect(mocks.rankPriorities).toHaveBeenCalledWith({
      runwayDays: 150,
      pipelineValue: 45000,
      overdueInvoices: 2,
      topDeal: { name: 'Big Deal', value: 90000 },
    })
  })

  it('falls back to defaults when settled results are rejected', async () => {
    mocks.dbExecute
      .mockRejectedValueOnce(new Error('snap fail'))
      .mockResolvedValueOnce({ rows: [{ weighted: 0, top_name: null, top_value: null }] })

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: [{ key: 'revenue' }] })
    expect(mocks.rankPriorities).toHaveBeenCalledWith({
      runwayDays: 180,
      pipelineValue: 0,
      overdueInvoices: 0,
      topDeal: undefined,
    })
  })

  it('handles rejected deals query while using snapshot data', async () => {
    mocks.dbExecute
      .mockResolvedValueOnce({
        rows: [{ cash_on_hand: 60000, monthly_burn: 15000, overdue_invoices: 1 }],
      })
      .mockRejectedValueOnce(new Error('deals fail'))
    mocks.calculateRunway.mockReturnValue(120)

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: [{ key: 'revenue' }] })
    expect(mocks.rankPriorities).toHaveBeenCalledWith({
      runwayDays: 120,
      pipelineValue: 0,
      overdueInvoices: 1,
      topDeal: undefined,
    })
  })

  it('returns 500 when ranking logic throws', async () => {
    mocks.rankPriorities.mockImplementation(() => {
      throw new Error('ranking failed')
    })

    const response = await GET()

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'ranking failed' })
  })

  it('returns unknown error when a non-Error is thrown', async () => {
    mocks.rankPriorities.mockImplementation(() => {
      throw 'bad'
    })

    const response = await GET()

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Unknown error' })
  })
})
