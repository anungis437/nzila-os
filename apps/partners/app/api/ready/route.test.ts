import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  dbExecute: vi.fn(),
  normalizeHealthChecks: vi.fn(),
  isReadyFromChecks: vi.fn(),
  getBuildMetadata: vi.fn(),
}))

vi.mock('@nzila/db', () => ({
  db: { execute: mocks.dbExecute },
}))

vi.mock('drizzle-orm', () => ({
  sql: (_parts: TemplateStringsArray) => ({ text: 'sql' }),
}))

vi.mock('@nzila/os-core/health', () => ({
  normalizeHealthChecks: mocks.normalizeHealthChecks,
  isReadyFromChecks: mocks.isReadyFromChecks,
  getBuildMetadata: mocks.getBuildMetadata,
}))

import { GET } from './route'

describe('GET /api/ready', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.dbExecute.mockResolvedValue({ rows: [{ ok: 1 }] })
    mocks.normalizeHealthChecks.mockImplementation((checks) => checks)
    mocks.isReadyFromChecks.mockReturnValue(true)
    mocks.getBuildMetadata.mockReturnValue({ app: 'partners', version: '1.0.0' })
  })

  it('returns ready status when checks pass', async () => {
    const response = await GET()
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ready: true,
      status: 'ready',
      app: 'partners',
      version: '1.0.0',
      checks: {
        process: true,
        database: true,
        queue: 'unknown',
        storage: 'unknown',
        thirdParty: 'unknown',
      },
    })
  })

  it('returns not_ready when database check fails', async () => {
    mocks.dbExecute.mockRejectedValue(new Error('db down'))
    mocks.isReadyFromChecks.mockReturnValue(false)

    const response = await GET()
    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.ready).toBe(false)
    expect(body.status).toBe('not_ready')
    expect(body.checks.database).toBe(false)
  })
})
