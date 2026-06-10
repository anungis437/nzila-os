import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  dbExecute: vi.fn(),
  container: vi.fn(),
  normalizeHealthChecks: vi.fn(),
  healthStatusFromChecks: vi.fn(),
  getBuildMetadata: vi.fn(),
}))

vi.mock('@nzila/db', () => ({
  db: { execute: mocks.dbExecute },
}))

vi.mock('drizzle-orm', () => ({
  sql: (_parts: TemplateStringsArray) => ({ text: 'sql' }),
}))

vi.mock('@nzila/blob', () => ({
  container: mocks.container,
}))

vi.mock('@nzila/os-core/health', () => ({
  normalizeHealthChecks: mocks.normalizeHealthChecks,
  healthStatusFromChecks: mocks.healthStatusFromChecks,
  getBuildMetadata: mocks.getBuildMetadata,
}))

import { GET } from './route'

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.dbExecute.mockResolvedValue({ rows: [{ ok: 1 }] })
    mocks.container.mockReturnValue({ getProperties: vi.fn().mockResolvedValue({}) })
    mocks.normalizeHealthChecks.mockImplementation((checks) => checks)
    mocks.healthStatusFromChecks.mockReturnValue('ok')
    mocks.getBuildMetadata.mockReturnValue({ app: 'partners', version: '1.0.0' })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 200 and healthy payload when checks pass', async () => {
    const response = await GET()
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      app: 'partners',
      version: '1.0.0',
      checks: {
        process: true,
        db: true,
        blob: true,
      },
    })
  })

  it('returns 503 when dependency checks fail', async () => {
    mocks.dbExecute.mockRejectedValue(new Error('db down'))
    mocks.container.mockImplementation(() => {
      throw new Error('blob down')
    })
    mocks.healthStatusFromChecks.mockReturnValue('degraded')

    const response = await GET()
    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.status).toBe('degraded')
    expect(body.checks).toEqual({ process: true, db: false, blob: false })
  })

  it('handles rejected Promise.allSettled entries', async () => {
    vi.spyOn(Promise, 'allSettled').mockResolvedValueOnce([
      { status: 'rejected', reason: new Error('db settle') } as PromiseRejectedResult,
      { status: 'rejected', reason: new Error('blob settle') } as PromiseRejectedResult,
    ])
    mocks.healthStatusFromChecks.mockReturnValue('fail')

    const response = await GET()
    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.checks).toEqual({ process: true, db: false, blob: false })
  })
})
