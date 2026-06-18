import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  dbExecute: vi.fn(),
  container: vi.fn(),
}))

const original = {
  vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA,
  githubSha: process.env.GITHUB_SHA,
  npmPackageVersion: process.env.npm_package_version,
}

vi.mock('@nzila/db', () => ({
  db: { execute: mocks.dbExecute },
}))

vi.mock('drizzle-orm', () => ({
  sql: (_parts: TemplateStringsArray) => ({ text: 'sql' }),
}))

vi.mock('@nzila/blob', () => ({
  container: mocks.container,
}))

async function loadRoute() {
  const routeModule = await import('./route')
  return routeModule.GET
}

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.dbExecute.mockResolvedValue({ rows: [{ ok: 1 }] })
    mocks.container.mockReturnValue({ getProperties: vi.fn().mockResolvedValue({}) })
  })

  afterEach(() => {
    process.env.VERCEL_GIT_COMMIT_SHA = original.vercelGitCommitSha
    process.env.GITHUB_SHA = original.githubSha
    process.env.npm_package_version = original.npmPackageVersion
    vi.restoreAllMocks()
  })

  it('returns ok when db and blob checks pass', async () => {
    const GET = await loadRoute()
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.app).toBe('agrimo')
    expect(body.checks).toEqual({ db: true, blob: true })
  })

  it('returns degraded when dependency checks fail', async () => {
    mocks.dbExecute.mockRejectedValue(new Error('db unavailable'))
    mocks.container.mockImplementation(() => {
      throw new Error('blob unavailable')
    })

    const GET = await loadRoute()
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.status).toBe('degraded')
    expect(body.checks).toEqual({ db: false, blob: false })
  })

  it('handles rejected Promise.allSettled entries safely', async () => {
    vi.spyOn(Promise, 'allSettled').mockResolvedValueOnce([
      { status: 'rejected', reason: new Error('db settle fail') } as PromiseRejectedResult,
      { status: 'rejected', reason: new Error('blob settle fail') } as PromiseRejectedResult,
    ])

    const GET = await loadRoute()
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.status).toBe('degraded')
    expect(body.checks).toEqual({ db: false, blob: false })
  })

  it('uses environment build metadata when provided', async () => {
    vi.resetModules()
    process.env.VERCEL_GIT_COMMIT_SHA = 'vercel-commit'
    process.env.npm_package_version = '2.0.0'

    const GET = await loadRoute()
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.buildInfo).toEqual({ version: '2.0.0', commit: 'vercel-commit' })
  })

  it('falls back to GITHUB_SHA when Vercel commit SHA is absent', async () => {
    vi.resetModules()
    delete process.env.VERCEL_GIT_COMMIT_SHA
    process.env.GITHUB_SHA = 'github-commit'

    const GET = await loadRoute()
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.buildInfo.commit).toBe('github-commit')
  })

  it('falls back to default version when npm_package_version is missing', async () => {
    vi.resetModules()
    delete process.env.npm_package_version

    const GET = await loadRoute()
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.buildInfo.version).toBe('0.0.0')
  })
})
