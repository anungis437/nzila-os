import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  dbExecute: vi.fn(),
  blobGetProperties: vi.fn(),
}))

vi.mock('@nzila/db', () => ({
  db: {
    execute: mocks.dbExecute,
  },
}))

vi.mock('drizzle-orm', () => ({
  sql: (_parts: TemplateStringsArray) => ({ text: 'SELECT 1' }),
}))

vi.mock('@nzila/blob', () => ({
  container: () => ({
    getProperties: mocks.blobGetProperties,
  }),
}))

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.dbExecute.mockResolvedValue({})
    mocks.blobGetProperties.mockResolvedValue({})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 200 and ok when all checks pass', async () => {
    vi.stubEnv('npm_package_version', '1.0.0')
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'sha-123')

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.app).toBe('@nzila/nacp-exams')
    expect(body.buildInfo).toEqual({ version: '1.0.0', commit: 'sha-123' })
    expect(body.checks).toEqual({ db: true, blob: true })
    expect(Number.isNaN(new Date(body.timestamp).getTime())).toBe(false)
  })

  it('returns 503 degraded when db check fails', async () => {
    mocks.dbExecute.mockRejectedValue(new Error('db down'))

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.status).toBe('degraded')
    expect(body.checks).toEqual({ db: false, blob: true })
  })

  it('returns 503 degraded when blob check fails', async () => {
    mocks.blobGetProperties.mockRejectedValue(new Error('blob down'))

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.status).toBe('degraded')
    expect(body.checks).toEqual({ db: true, blob: false })
  })

  it('uses github sha when vercel sha is missing', async () => {
    delete process.env.VERCEL_GIT_COMMIT_SHA
    vi.stubEnv('GITHUB_SHA', 'github-sha')

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(body.buildInfo.commit).toBe('github-sha')
  })

  it('uses local commit and default version when env vars are missing', async () => {
    delete process.env.VERCEL_GIT_COMMIT_SHA
    delete process.env.GITHUB_SHA
    delete process.env.npm_package_version

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(body.buildInfo).toEqual({ version: '0.0.0', commit: 'local' })
  })

  it('handles Promise.allSettled rejected checks branch', async () => {
    const allSettledSpy = vi
      .spyOn(Promise, 'allSettled')
      .mockResolvedValueOnce([
        { status: 'rejected', reason: new Error('db fail') },
        { status: 'fulfilled', value: true },
      ] as PromiseSettledResult<boolean>[])

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.checks).toEqual({ db: false, blob: true })
    allSettledSpy.mockRestore()
  })

  it('handles Promise.allSettled blob rejected branch', async () => {
    const allSettledSpy = vi
      .spyOn(Promise, 'allSettled')
      .mockResolvedValueOnce([
        { status: 'fulfilled', value: true },
        { status: 'rejected', reason: new Error('blob fail') },
      ] as PromiseSettledResult<boolean>[])

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.checks).toEqual({ db: true, blob: false })
    allSettledSpy.mockRestore()
  })
})
