import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  dbExecute: vi.fn(),
}))

vi.mock('@nzila/db', () => ({
  db: {
    execute: mocks.dbExecute,
  },
}))

vi.mock('drizzle-orm', () => ({
  sql: (_parts: TemplateStringsArray) => ({ text: 'SELECT 1' }),
}))

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.dbExecute.mockResolvedValue({})
  })

  it('returns ok when db is healthy', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.app).toBe('cora')
    expect(body.checks).toEqual({ db: true })
    expect(body.buildInfo).toEqual({
      version: process.env.npm_package_version ?? '0.0.0',
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'local',
    })
  })

  it('returns degraded when db check fails', async () => {
    mocks.dbExecute.mockRejectedValue(new Error('db down'))

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.status).toBe('degraded')
    expect(body.checks).toEqual({ db: false })
  })

  it('uses local commit fallback when env vars are missing', async () => {
    delete process.env.VERCEL_GIT_COMMIT_SHA
    delete process.env.GITHUB_SHA

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(body.buildInfo.commit).toBe('local')
  })

  it('uses 0.0.0 version fallback when npm_package_version is missing', async () => {
    delete process.env.npm_package_version

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(body.buildInfo.version).toBe('0.0.0')
  })

  it('handles Promise.allSettled rejected branch', async () => {
    const allSettledSpy = vi
      .spyOn(Promise, 'allSettled')
      .mockResolvedValueOnce([
        { status: 'rejected', reason: new Error('db fail') },
      ] as PromiseSettledResult<boolean>[])

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.checks).toEqual({ db: false })
    allSettledSpy.mockRestore()
  })
})
