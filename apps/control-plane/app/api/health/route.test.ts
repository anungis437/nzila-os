import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  checkDb: vi.fn().mockResolvedValue(true),
}))

vi.mock('@nzila/db', () => ({
  db: { execute: mocks.checkDb },
}))

vi.mock('drizzle-orm', () => ({
  sql: (strs: TemplateStringsArray) => strs[0],
}))

const originalEnv = {
  vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA,
  githubSha: process.env.GITHUB_SHA,
  npmPackageVersion: process.env.npm_package_version,
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key]
  } else {
    process.env[key] = value
  }
}

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.checkDb.mockResolvedValue(true)
  })

  afterEach(() => {
    restoreEnv('VERCEL_GIT_COMMIT_SHA', originalEnv.vercelGitCommitSha)
    restoreEnv('GITHUB_SHA', originalEnv.githubSha)
    restoreEnv('npm_package_version', originalEnv.npmPackageVersion)
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('returns ok when db is healthy', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.app).toBe('@nzila/control-plane')
    expect(body.checks.db).toBe(true)
    expect(body.buildInfo).toBeDefined()
    expect(body.buildInfo.version).toBeDefined()
    expect(body.buildInfo.commit).toBeDefined()
  })

  it('returns degraded when db check fails', async () => {
    mocks.checkDb.mockRejectedValue(new Error('db connection failed'))

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.status).toBe('degraded')
    expect(body.checks.db).toBe(false)
  })

  it('includes timestamp in response', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(body.timestamp).toBeDefined()
    expect(() => new Date(body.timestamp)).not.toThrow()
  })

  it('falls back to default version when npm_package_version is missing', async () => {
    vi.resetModules()
    delete process.env.npm_package_version

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.buildInfo.version).toBe('0.0.0')
  })

  it('falls back to local when no commit SHA env vars are set', async () => {
    vi.resetModules()
    delete process.env.VERCEL_GIT_COMMIT_SHA
    delete process.env.GITHUB_SHA

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.buildInfo.commit).toBe('local')
  })

  it('reports db failure when the check settles as rejected', async () => {
    vi.spyOn(Promise, 'allSettled').mockResolvedValueOnce([
      { status: 'rejected', reason: new Error('db settle failed') } as PromiseRejectedResult,
    ])

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.status).toBe('degraded')
    expect(body.checks.db).toBe(false)
  })
})
